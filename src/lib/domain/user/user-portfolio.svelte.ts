/**
 * User Portfolio State
 *
 * Unified state manager for all user assets:
 * - Token wallet holdings (from ICRC ledgers)
 * - Spot market positions, orders, triggers, balances (from entityStore)
 *
 * ## Data Flow
 *
 * ```
 * User Assets
 *       │
 *       ├── Wallet Balances: Fetched via tokenRepository from ICRC ledgers
 *       │
 *       ├── Spot Market Data: Derived from entityStore (single source of truth)
 *       │     ├── Orders (limit orders in book)
 *       │     ├── Triggers (stop-loss / take-profit)
 *       │     ├── Positions (LP positions)
 *       │     └── Cached Balances (deposited in spot canisters)
 *       │
 *       └── Token Metadata: Derived from entityStore (normalized)
 * ```
 *
 * Responsibilities:
 * - Track which tokens the user has added (via storage layer)
 * - Store user-specific wallet balances
 * - Derive spot market data from entityStore
 * - Orchestrate fetching of all user spot market data
 *
 * Does NOT:
 * - Create actors
 * - Make direct canister calls
 * - Store token metadata (comes from entityStore)
 * - Store spot market data (comes from entityStore)
 */

import type { Principal } from '@dfinity/principal';
import { tokenRepository } from '$lib/repositories/token.repository';
import { indexerRepository } from '$lib/repositories/indexer.repository';
import { userRepository } from '$lib/repositories/user.repository';
import { marketRepository } from '$lib/repositories/market.repository';
import { userScopedPreferences } from '$lib/repositories/storage';
import { entityStore, type NormalizedToken, type NormalizedUserMarketData } from '$lib/domain/orchestration/entity-store.svelte';
import { canisterIds } from '$lib/constants/app.constants';
import { formatToken } from '$lib/utils/format.utils';
import { user } from './auth.svelte';
import type { OrderView, TriggerView, PositionViewEnhanced } from '$lib/actors/services/spot.service';
import { bpsToPercent } from '$lib/domain/markets/utils/math';

// ============================================
// Types
// ============================================

/**
 * User-specific token balance data
 * Token metadata comes from entityStore
 */
export interface PortfolioBalance {
  canisterId: string;
  balance: bigint;
  formattedBalance: string;
}

/**
 * Portfolio pool/position for UI display
 * Enriched with token metadata from entityStore
 */
export interface PortfolioPool {
  id: string;
  canisterId: string;
  positionId: bigint;
  base: { symbol: string; displaySymbol: string; logo?: string };
  quote: { symbol: string; displaySymbol: string; logo?: string };
  fee: number;
  liquidity: string;
  valueUsd: number;
  feesUsd: number;
  apr?: number;
  inRange?: boolean;
  lockedUntil: bigint | null;
}

/**
 * Enriched portfolio token for display
 * Combines user balance with normalized token data from entityStore
 *
 * All fields are guaranteed non-null (thanks to entityStore normalization)
 */
export interface PortfolioToken {
  // From entityStore (normalized, never null)
  canisterId: string;
  symbol: string;
  displaySymbol: string;
  name: string;
  displayName: string;
  decimals: number;
  fee: bigint;
  logo: string | null;
  priceUsd: bigint;       // E12 (12 decimals) per 06-Precision.md

  // User-specific (from this state)
  balance: bigint;
  formattedBalance: string;

  // Computed
  value: number;          // USD value = balance × price
}

// ============================================
// Helpers
// ============================================

/** Format balance for display */
function formatBalance(balance: bigint, decimals: number): string {
  return formatToken({
    value: balance,
    unitName: decimals,
    displayDecimals: 4,
    commas: true,
  });
}

/**
 * Get stored holdings for current user
 * Uses abstracted storage layer (user-scoped by principal)
 */
function getStoredHoldings(): string[] {
  const principal = user.principalText;
  if (!principal) return [];
  return userScopedPreferences.getHoldings(principal);
}

/**
 * Save holdings for current user
 * Uses abstracted storage layer (user-scoped by principal)
 */
function saveHoldings(ids: string[]): void {
  const principal = user.principalText;
  if (!principal) return;
  userScopedPreferences.setHoldings(principal, ids);
}

// ============================================
// User Portfolio State
// ============================================

class UserPortfolioState {
  // Core state: token IDs and their balances
  private holdingIds = $state<string[]>([]);
  private balances = $state<Map<string, PortfolioBalance>>(new Map());

  // Loading states
  isInitialized = $state(false);
  isLoading = $state(false);
  isLoadingBalances = $state(false);
  isDiscovering = $state(false);
  isLoadingSpotMarkets = $state(false);
  spotMarketsError = $state<string | null>(null);

  // ============================================
  // Derived State
  // ============================================

  /**
   * All portfolio tokens enriched with data from entityStore
   *
   * REACTIVE: Updates automatically when:
   * - Balances change (via refreshBalances)
   * - entityStore updates (via discovery, pricing, etc.)
   *
   * Sorted by: tokens with balance first, then by USD value descending
   */
  allTokens = $derived.by(() => {
    return Array.from(this.balances.values())
      .map(balanceData => {
        const token = entityStore.getToken(balanceData.canisterId);

        // If token not in entityStore, create minimal version
        // This handles edge cases where balance exists but token not discovered yet
        const priceUsd = token?.priceUsd ?? 0n;
        const decimals = token?.decimals ?? 8;
        const value = this.calculateUsdValue(balanceData.balance, priceUsd, decimals);

        return {
          canisterId: balanceData.canisterId,
          symbol: token?.symbol ?? 'UNKNOWN',
          displaySymbol: token?.displaySymbol ?? 'UNKNOWN',
          name: token?.name ?? 'Unknown Token',
          displayName: token?.displayName ?? 'Unknown Token',
          decimals,
          fee: token?.fee ?? 0n,
          logo: token?.logo ?? null,
          priceUsd,
          balance: balanceData.balance,
          formattedBalance: balanceData.formattedBalance,
          value,
        } as PortfolioToken;
      })
      .sort((a, b) => {
        // Tokens with balance first
        if ((a.balance > 0n) !== (b.balance > 0n)) {
          return a.balance > 0n ? -1 : 1;
        }
        // Then by value descending
        return b.value - a.value;
      });
  });

  /** Only tokens with balance > 0 */
  tokensWithBalance = $derived(this.allTokens.filter(t => t.balance > 0n));

  /** Number of tokens with balance > 0 */
  activeTokenCount = $derived(this.tokensWithBalance.length);

  /**
   * Total portfolio value in USD
   * REACTIVE: Updates when any token price or balance changes
   */
  totalValue = $derived(this.allTokens.reduce((sum, t) => sum + t.value, 0));

  /** Number of tokens being tracked */
  tokenCount = $derived(this.holdingIds.length);

  // ============================================
  // Spot Market Derived State (from entityStore)
  // ============================================

  /** All user market data entries */
  spotMarkets = $derived(entityStore.allUserMarkets);

  /** Number of spot markets where user has involvement */
  spotMarketCount = $derived(entityStore.userMarketCount);

  /** All orders across all spot markets */
  allOrders = $derived(entityStore.allUserOrders);

  /** All triggers across all spot markets */
  allTriggers = $derived(entityStore.allUserTriggers);

  /** All LP positions across all spot markets */
  allPositions = $derived(entityStore.allUserPositions);

  /** Total LP positions TVL in USD (E6 precision) */
  totalPositionsTvlE6 = $derived(entityStore.totalPositionsTvlE6);

  /** Total LP positions fees in USD (E6 precision) */
  totalPositionsFeesE6 = $derived(entityStore.totalPositionsFeesE6);

  /** Whether user has any spot market data */
  hasSpotData = $derived(entityStore.hasUserData);

  /** Order count across all markets */
  orderCount = $derived(entityStore.allUserOrders.length);

  /** Trigger count across all markets */
  triggerCount = $derived(entityStore.allUserTriggers.length);

  /** Position count across all markets */
  positionCount = $derived(entityStore.allUserPositions.length);

  /**
   * Portfolio pools - enriched LP positions for UI display
   * Transforms raw positions into PortfolioPool with token metadata
   */
  portfolioPools = $derived.by((): PortfolioPool[] => {
    const result: PortfolioPool[] = [];

    for (const marketData of entityStore.allUserMarkets) {
      const market = entityStore.getMarket(marketData.spotCanisterId);
      const currentTick = market?.lastTradeTick ?? 0;

      // Get token metadata from entityStore
      const baseToken = market?.baseToken ? entityStore.getToken(market.baseToken) : undefined;
      const quoteToken = market?.quoteToken ? entityStore.getToken(market.quoteToken) : undefined;

      for (const pos of marketData.positions) {
        // Determine if position is in range
        const inRange = currentTick >= pos.tick_lower && currentTick <= pos.tick_upper;

        result.push({
          id: `${marketData.spotCanisterId}-${pos.position_id.toString()}`,
          canisterId: marketData.spotCanisterId,
          positionId: pos.position_id,
          base: {
            symbol: baseToken?.symbol ?? 'TOKEN',
            displaySymbol: baseToken?.displaySymbol ?? baseToken?.symbol ?? 'TOKEN',
            logo: baseToken?.logo ?? undefined,
          },
          quote: {
            symbol: quoteToken?.symbol ?? 'ICP',
            displaySymbol: quoteToken?.displaySymbol ?? quoteToken?.symbol ?? 'ICP',
            logo: quoteToken?.logo ?? undefined,
          },
          fee: pos.fee_pips / 10000, // pips to percentage
          liquidity: pos.liquidity.toString(),
          valueUsd: Number(pos.usd_value_e6) / 1e6,
          feesUsd: Number(pos.fees_usd_value_e6) / 1e6,
          apr: bpsToPercent(pos.apr_bps),
          inRange,
          lockedUntil: pos.locked_until?.[0] ?? null,
        });
      }
    }

    // Sort by value descending
    return result.sort((a, b) => b.valueUsd - a.valueUsd);
  });

  /** Total portfolio pools value in USD */
  portfolioPoolsTotalValue = $derived(
    this.portfolioPools.reduce((sum, p) => sum + p.valueUsd, 0)
  );

  /** Number of active pool positions */
  activePoolPositionsCount = $derived(this.portfolioPools.length);

  /** Only in-range pools */
  inRangePools = $derived(this.portfolioPools.filter((p) => p.inRange === true));

  // ============================================
  // Value Calculation
  // ============================================

  /**
   * Calculate USD value from balance and price
   *
   * @param balance - Token balance (with token decimals)
   * @param price - USD price (E12 per 06-Precision.md)
   * @param decimals - Token decimals
   * @returns USD value as number
   */
  private calculateUsdValue(balance: bigint, price: bigint, decimals: number): number {
    if (balance === 0n || price === 0n) return 0;

    // value = (balance / 10^decimals) × (price / 10^12)
    const balanceFloat = Number(balance) / (10 ** decimals);
    const priceFloat = Number(price) / 1e12;
    return balanceFloat * priceFloat;
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * Initialize from localStorage
   * Loads stored token IDs and creates empty balance entries
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.isLoading = true;

    try {
      // Load stored holdings
      this.holdingIds = getStoredHoldings();

      // Create empty balance entries for all holdings
      const next = new Map(this.balances);
      for (const canisterId of this.holdingIds) {
        if (!next.has(canisterId)) {
          next.set(canisterId, {
            canisterId,
            balance: 0n,
            formattedBalance: '0',
          });
        }
      }
      this.balances = next;

      this.isInitialized = true;
    } finally {
      this.isLoading = false;
    }
  }

  // ============================================
  // Token Management
  // ============================================

  /**
   * Add a token to portfolio
   * Note: Token metadata comes from entityStore, not fetched here
   */
  addToken(canisterId: string): void {
    if (this.holdingIds.includes(canisterId)) {
      return;
    }


    // Update state
    this.holdingIds = [...this.holdingIds, canisterId];
    const next = new Map(this.balances);
    next.set(canisterId, {
      canisterId,
      balance: 0n,
      formattedBalance: '0',
    });
    this.balances = next;

    // Persist
    saveHoldings(this.holdingIds);
  }

  /**
   * Remove a token from portfolio
   */
  removeToken(canisterId: string): void {
    this.holdingIds = this.holdingIds.filter(id => id !== canisterId);
    const next = new Map(this.balances);
    next.delete(canisterId);
    this.balances = next;
    saveHoldings(this.holdingIds);
  }

  /**
   * Check if token is in portfolio
   */
  hasToken(canisterId: string): boolean {
    return this.holdingIds.includes(canisterId);
  }

  /**
   * Get enriched token data by canister ID
   */
  getToken(canisterId: string): PortfolioToken | undefined {
    return this.allTokens.find(t => t.canisterId === canisterId);
  }

  // ============================================
  // Data Fetching (via Repository)
  // ============================================

  /**
   * Fetch balances for all tokens
   */
  async refreshBalances(owner: Principal): Promise<void> {
    this.isLoadingBalances = true;

    try {
      const results = await Promise.allSettled(
        this.holdingIds.map(async (canisterId) => {
          const result = await tokenRepository.fetchBalance(canisterId, owner);
          if ('ok' in result) {
            return { canisterId, balance: result.ok };
          }
          return { canisterId, balance: 0n };
        })
      );

      const next = new Map(this.balances);

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { canisterId, balance } = result.value;
          // Get decimals from entityStore for formatting
          const token = entityStore.getToken(canisterId);
          const decimals = token?.decimals ?? 8;

          next.set(canisterId, {
            canisterId,
            balance,
            formattedBalance: formatBalance(balance, decimals),
          });
        }
      }

      this.balances = next;
    } finally {
      this.isLoadingBalances = false;
    }
  }

  // ============================================
  // Discovery
  // ============================================

  /**
   * Discover tokens with non-zero balance from indexer
   * Uses entityStore for token data, only stores balances locally
   */
  async discoverHoldings(owner: Principal): Promise<void> {
    if (this.isDiscovering) return;
    if (!canisterIds.indexer) {
      console.warn('[UserPortfolio] No indexer configured');
      return;
    }

    this.isDiscovering = true;

    try {
      // Get all known tokens from indexer
      const result = await indexerRepository.getTokens(500n);

      if ('err' in result) {
        console.error('[UserPortfolio] Failed to fetch tokens:', result.err);
        return;
      }

      const items = result.ok.data;
      let discovered = 0;

      // Check balance for tokens not already in portfolio
      for (const item of items) {
        const canisterId = item.token_ledger.toString();

        if (this.holdingIds.includes(canisterId)) continue;

        const balanceResult = await tokenRepository.fetchBalance(canisterId, owner, undefined, false);

        if ('ok' in balanceResult && balanceResult.ok > 0n) {

          // Add to portfolio (token data comes from entityStore, which was populated by discovery)
          const balance = balanceResult.ok;

          this.holdingIds = [...this.holdingIds, canisterId];
          const next = new Map(this.balances);
          next.set(canisterId, {
            canisterId,
            balance,
            formattedBalance: formatBalance(balance, item.decimals),
          });
          this.balances = next;

          discovered++;
        }
      }

      // Persist
      saveHoldings(this.holdingIds);

    } finally {
      this.isDiscovering = false;
    }
  }

  /**
   * Sync balances with entityStore
   * Checks balances for ALL tokens in entityStore, not just stored holdingIds
   * This is the aggressive approach - ensures any token visible in UI has a fresh balance
   */
  async syncWithEntityStore(owner: Principal): Promise<void> {
    // Guard: prevent concurrent syncs (can happen when entityStore.tokenCount changes rapidly)
    if (this.isLoadingBalances) {
      return;
    }

    const allTokenIds = entityStore.allTokens.map(t => t.canisterId);

    if (allTokenIds.length === 0) {
      return;
    }

    this.isLoadingBalances = true;

    try {
      // Check balances for ALL tokens in entityStore (parallel with concurrency limit)
      const BATCH_SIZE = 10;
      const next = new Map(this.balances);
      let discovered = 0;

      for (let i = 0; i < allTokenIds.length; i += BATCH_SIZE) {
        const batch = allTokenIds.slice(i, i + BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(async (canisterId) => {
            const result = await tokenRepository.fetchBalance(canisterId, owner, undefined, false);
            if ('ok' in result) {
              return { canisterId, balance: result.ok };
            }
            return { canisterId, balance: 0n };
          })
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            const { canisterId, balance } = result.value;
            const token = entityStore.getToken(canisterId);
            const decimals = token?.decimals ?? 8;

            // Always update balance (even if 0)
            next.set(canisterId, {
              canisterId,
              balance,
              formattedBalance: formatBalance(balance, decimals),
            });

            // Track holdings if balance > 0 and not already tracked
            if (balance > 0n && !this.holdingIds.includes(canisterId)) {
              this.holdingIds = [...this.holdingIds, canisterId];
              discovered++;
            }
          }
        }
      }

      this.balances = next;

      if (discovered > 0) {
        saveHoldings(this.holdingIds);
      }

    } finally {
      this.isLoadingBalances = false;
    }
  }

  /**
   * Check balance for a single token
   * Used for on-demand balance checking when a token is accessed
   */
  async checkBalance(canisterId: string, owner: Principal): Promise<bigint> {
    const result = await tokenRepository.fetchBalance(canisterId, owner, undefined, false);

    if ('ok' in result) {
      const balance = result.ok;
      const token = entityStore.getToken(canisterId);
      const decimals = token?.decimals ?? 8;

      // Update balance
      const next = new Map(this.balances);
      next.set(canisterId, {
        canisterId,
        balance,
        formattedBalance: formatBalance(balance, decimals),
      });
      this.balances = next;

      // Track if has balance and not already tracked
      if (balance > 0n && !this.holdingIds.includes(canisterId)) {
        this.holdingIds = [...this.holdingIds, canisterId];
        saveHoldings(this.holdingIds);
      }

      return balance;
    }

    return 0n;
  }

  // ============================================
  // Spot Market Data (from entityStore)
  // ============================================

  /**
   * Hydrate all spot market data for the current user
   * Fetches from indexer → spot canisters → pushes to entityStore
   *
   * Flow:
   * 1. indexer.get_user_markets(user) → [spot_1, spot_2, ...]
   * 2. For each: spot.get_user() → UserData
   * 3. entityStore.upsertUserMarketData(canisterId, data)
   */
  async hydrateSpotMarkets(): Promise<void> {
    console.log('[UserPortfolio] hydrateSpotMarkets() called');

    const principal = user.principal;
    if (!principal) {
      console.log('[UserPortfolio] No principal, skipping');
      return;
    }

    if (this.isLoadingSpotMarkets) {
      console.log('[UserPortfolio] Already loading, skipping');
      return;
    }

    if (!canisterIds.indexer) {
      console.warn('[UserPortfolio] No indexer configured');
      this.spotMarketsError = 'Configuration error: indexer canister ID missing';
      return;
    }

    this.isLoadingSpotMarkets = true;
    this.spotMarketsError = null;

    try {
      // 1. Get all spot markets where user has involvement
      console.log(`[UserPortfolio] Calling indexer.get_user_markets() for ${principal.toString().slice(0, 10)}...`);
      const marketsResult = await userRepository.getUserMarkets(
        canisterIds.indexer,
        principal as any
      );

      if ('err' in marketsResult) {
        console.error('[UserPortfolio] indexer.get_user_markets() failed:', marketsResult.err);
        this.spotMarketsError = marketsResult.err;
        return;
      }

      const marketIds = marketsResult.ok;
      console.log(`[UserPortfolio] indexer returned ${marketIds.length} markets:`, marketIds.map(p => p.toString()));

      if (marketIds.length === 0) {
        console.log('[UserPortfolio] No markets found, clearing user data');
        // No markets - clear any stale data
        entityStore.clearUserData();
        return;
      }

      // 2. Fetch user data AND market config from each market in parallel
      console.log(`[UserPortfolio] Fetching user data from ${marketIds.length} markets...`);
      const results = await Promise.allSettled(
        marketIds.map(async (marketId) => {
          const canisterId = marketId.toString();
          console.log(`[UserPortfolio] → Calling get_user() on ${canisterId}`);

          // Fetch user data (market metadata already in entityStore from market-loader)
          const userDataResult = await marketRepository.fetchUserData(canisterId);

          if ('ok' in userDataResult && userDataResult.ok.length > 0) {
            const userData = userDataResult.ok[0];
            if (userData) {
              console.log(`[UserPortfolio] ✓ ${canisterId}: orders=${userData.orders.length}, triggers=${userData.triggers.length}, positions=${userData.positions.length}, available=(${userData.available.base}, ${userData.available.quote})`);

              // Compute position aggregates
              let totalTvl = 0n;
              let totalFees = 0n;
              let weightedApyNumerator = 0;
              for (const pos of userData.positions) {
                totalTvl += pos.usd_value_e6;
                totalFees += pos.fees_usd_value_e6;
                weightedApyNumerator += Number(pos.apr_bps) * Number(pos.usd_value_e6);
              }

              // 3. Push to entityStore
              entityStore.upsertUserMarketData({
                spotCanisterId: canisterId,
                orders: userData.orders,
                triggers: userData.triggers,
                positions: userData.positions,
                available: userData.available,
                locked: userData.locked,
                fees: userData.fees,
                totalPositionsTvlE6: totalTvl,
                totalPositionsFeesE6: totalFees,
                weightedAvgApy: totalTvl > 0n ? bpsToPercent(weightedApyNumerator / Number(totalTvl)) : 0,
              });
              return { canisterId, success: true };
            } else {
              console.log(`[UserPortfolio] ✗ ${canisterId}: userData[0] is null`);
              return { canisterId, success: false, reason: 'userData[0] null' };
            }
          } else {
            const errMsg = 'err' in userDataResult ? userDataResult.err : 'empty result';
            console.log(`[UserPortfolio] ✗ ${canisterId}: ${errMsg}`);
            return { canisterId, success: false, reason: errMsg };
          }
        })
      );

      // Log summary
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');
      console.log(`[UserPortfolio] Fetch complete: ${fulfilled.length} fulfilled, ${rejected.length} rejected`);

      for (const result of results) {
        if (result.status === 'rejected') {
          console.error('[UserPortfolio] Failed to fetch market data:', result.reason);
        }
      }

      console.log(`[UserPortfolio] entityStore now has ${entityStore.allUserMarkets.length} user markets`);
    } catch (error) {
      this.spotMarketsError = error instanceof Error ? error.message : 'Failed to load spot market data';
      console.error('[UserPortfolio] hydrateSpotMarkets failed:', error);
    } finally {
      this.isLoadingSpotMarkets = false;
    }
  }

  /**
   * Refresh spot market data for a specific market
   * Called after mutations (order create, deposit, etc.)
   */
  async refreshSpotMarket(spotCanisterId: string): Promise<void> {
    try {
      const userDataResult = await marketRepository.fetchUserData(spotCanisterId);

      if ('ok' in userDataResult && userDataResult.ok.length > 0) {
        const userData = userDataResult.ok[0];
        if (userData) {
          // Compute position aggregates
          let totalTvl = 0n;
          let totalFees = 0n;
          let weightedApyNumerator = 0;
          for (const pos of userData.positions) {
            totalTvl += pos.usd_value_e6;
            totalFees += pos.fees_usd_value_e6;
            weightedApyNumerator += Number(pos.apr_bps) * Number(pos.usd_value_e6);
          }

          entityStore.upsertUserMarketData({
            spotCanisterId,
            orders: userData.orders,
            triggers: userData.triggers,
            positions: userData.positions,
            available: userData.available,
            locked: userData.locked,
            fees: userData.fees,
            totalPositionsTvlE6: totalTvl,
            totalPositionsFeesE6: totalFees,
            weightedAvgApy: totalTvl > 0n ? bpsToPercent(weightedApyNumerator / Number(totalTvl)) : 0,
          });
        }
      }
    } catch (error) {
      console.error(`[UserPortfolio] Failed to refresh market ${spotCanisterId}:`, error);
    }
  }

  /**
   * Get user data for a specific spot market
   */
  getSpotMarketData(spotCanisterId: string): NormalizedUserMarketData | undefined {
    return entityStore.getUserMarketData(spotCanisterId);
  }

  /**
   * Get orders for a specific spot market
   */
  getOrdersForMarket(spotCanisterId: string): OrderView[] {
    return entityStore.getUserMarketData(spotCanisterId)?.orders ?? [];
  }

  /**
   * Get triggers for a specific spot market
   */
  getTriggersForMarket(spotCanisterId: string): TriggerView[] {
    return entityStore.getUserMarketData(spotCanisterId)?.triggers ?? [];
  }

  /**
   * Get positions for a specific spot market
   */
  getPositionsForMarket(spotCanisterId: string): PositionViewEnhanced[] {
    return entityStore.getUserMarketData(spotCanisterId)?.positions ?? [];
  }

  /**
   * Invalidate caches and refresh spot market data
   * Used after mutations (add/remove liquidity, collect fees)
   */
  async invalidateAndRefreshSpotMarkets(): Promise<void> {
    const principal = user.principal;
    if (principal) {
      userRepository.invalidateUser(principal as any);
    }
    await this.hydrateSpotMarkets();
  }

  // ============================================
  // Reset
  // ============================================

  /**
   * Reset state (on logout/identity change)
   * Clears in-memory state completely.
   * Also clears user data from entityStore.
   * localStorage is user-scoped by principal, so no action needed there -
   * the correct data will load on next initialize() for the new user.
   */
  reset(): void {
    this.holdingIds = [];
    this.balances = new Map();
    this.isInitialized = false;
    this.spotMarketsError = null;
    // Clear user data from entityStore
    entityStore.clearUserData();
  }

  /**
   * Clear all data including localStorage and entityStore
   */
  clearAll(): void {
    this.holdingIds = [];
    this.balances = new Map();
    this.isInitialized = false;
    this.spotMarketsError = null;
    saveHoldings([]);
    entityStore.clearUserData();
  }

  // ============================================
  // Debug
  // ============================================

}

// ============================================
// Singleton Export
// ============================================

export const userPortfolio = new UserPortfolioState();
