import { SvelteMap } from 'svelte/reactivity';

// Re-export all types from shared types for backwards compatibility
export type {
  NormalizedToken,
  NormalizedMarket,
  NormalizedPool,
  NormalizedUserMarketData,
  TokenUpsert,
  MarketUpsert,
  PoolUpsert,
  UserMarketDataUpsert,
  TokenPairAmounts,
  LockedBalancesBreakdown,
  PriceSource,
  EntitySource,
} from '$lib/types/entity.types';

import type {
  NormalizedToken,
  NormalizedMarket,
  NormalizedPool,
  NormalizedUserMarketData,
  TokenUpsert,
  MarketUpsert,
  PoolUpsert,
  UserMarketDataUpsert,
  PriceSource,
  EntitySource,
} from '$lib/types/entity.types';

import { CK_TOKEN_MAP, CK_DISPLAY_NAMES } from '$lib/domain/markets';

// ============================================
// Price Source Priority
// ============================================

/** Canonical priority for price sources. Higher = more authoritative. */
const PRICE_SOURCE_PRIORITY: Record<PriceSource, number> = {
  oracle: 5,    // Frontend-derived best price (Coinbase, tick × quoteUsd, fixed stablecoin)
  canister: 4,  // Direct from spot canister's baked current_price_usd_e12
  indexer: 3,   // Platform indexer (aggregated, may use stale oracle snapshots)
  static: 1,    // Hardcoded fallback
  unknown: 0,
};

// ============================================
// Treasury Types
// ============================================

/**
 * DataPoint for treasury time series charts
 */
export interface TreasuryDataPoint {
  timestamp: number; // Unix seconds
  value: number;
}

export type TreasuryMetric =
  | 'fees_icp'
  | 'fees_usd_e6'
  | 'cycles_out'
  | 'cycles_expense_usd_e6';

/**
 * Entity Store
 *
 * Centralized, normalized store for all platform entities (tokens, markets, pools).
 * This is the SINGLE SOURCE OF TRUTH for entity data.
 *
 * ## Design Principles
 *
 * 1. **Normalize on write**: All data is validated and normalized when inserted
 * 2. **Merge semantics**: Updates merge with existing data (partial updates work)
 * 3. **No nulls for required fields**: Defaults are applied for missing data
 * 4. **Any source can update**: Indexer bulk, canister polling, Coinbase - all merge
 *
 * ## Data Flow
 *
 * ```
 * indexerRepository.getAllTokens() ──┐
 *                                    │
 * marketRepository.poll() ───────────┼──► entityStore.upsertToken()
 *                                    │         │
 * pricingRepository.fetchPrices() ───┘         ▼
 *                                    ┌─────────────────────┐
 *                                    │  Normalized Token   │
 *                                    │  - symbol: string   │
 *                                    │  - priceUsd: bigint │
 *                                    │  - etc.             │
 *                                    └─────────────────────┘
 *                                              │
 *                   ┌────────────────┬─────────┴────────┐
 *                   ▼                ▼                  ▼
 *              discovery       userPortfolio       components
 *              (derives)        (derives)          (derives)
 * ```
 */

// ============================================
// Default Values
// ============================================

const DEFAULT_TOKEN: Omit<NormalizedToken, 'canisterId'> = {
  symbol: 'UNKNOWN',
  displaySymbol: 'UNKNOWN',
  name: 'Unknown Token',
  displayName: 'Unknown Token',
  decimals: 8,
  fee: 0n,
  logo: null,
  priceUsd: 0n,
  priceChange24h: 0,
  priceSource: 'unknown',
  priceUpdatedAt: 0,
  volume24h: 0n,
  volume7d: 0n,
  volume30d: 0n,
  tvl: 0n,
  totalSupply: null,
  baseMarkets: [],
  quoteMarkets: [],
  source: 'discovered',
  lastUpdatedAt: Date.now(),
};

/**
 * Compute display symbol for a token.
 * ck-tokens get normalized (CKBTC → BTC), others stay as-is.
 */
function computeDisplaySymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  const lower = symbol.toLowerCase();
  // Check if it's a known ck-token
  if (lower in CK_TOKEN_MAP) {
    return CK_TOKEN_MAP[lower].toUpperCase();
  }
  return upper;
}

/**
 * Compute display name for a token.
 * ck-tokens get a human-readable name (e.g., "Chain Key USDT" → "Tether USD").
 */
function computeDisplayName(name: string, displaySymbol: string, symbol: string): string {
  if (displaySymbol !== symbol) {
    return CK_DISPLAY_NAMES[displaySymbol.toLowerCase()] ?? name;
  }
  return name;
}

const DEFAULT_MARKET: Omit<NormalizedMarket, 'canisterId'> = {
  symbol: 'UNKNOWN/UNKNOWN',
  baseToken: '',
  quoteToken: '',
  lastTradeTick: null,
  referenceTick: null,
  lastTradePrice: 0n,
  lastTradeSqrtPriceX96: null,
  liquidity: 0n,
  volume24h: 0n,
  tvl: 0n,
  priceChange24h: 0,
  feePips: 0,
  isActive: true,
  source: 'discovered',
  lastUpdatedAt: Date.now(),
};

const DEFAULT_POOL: Omit<NormalizedPool, 'poolId' | 'spotCanisterId'> = {
  symbol: 'UNKNOWN/UNKNOWN',
  base: '',
  quote: '',
  feePips: 0,
  liquidity: 0n,
  tvl: 0n,
  volume24h: 0n,
  volume7d: 0n,
  fees24h: 0n,
  apr: 0,
  baseReserve: null,
  quoteReserve: null,
  source: 'discovered',
  lastUpdatedAt: Date.now(),
};

const DEFAULT_USER_MARKET_DATA: Omit<NormalizedUserMarketData, 'spotCanisterId'> = {
  orders: [],
  triggers: [],
  positions: [],
  available: { base: 0n, quote: 0n },
  locked: {
    orders: { base: 0n, quote: 0n },
    triggers: { base: 0n, quote: 0n },
    positions: { base: 0n, quote: 0n },
  },
  fees: { base: 0n, quote: 0n },
  totalPositionsTvlE6: 0n,
  totalPositionsFeesE6: 0n,
  weightedAvgApy: 0,
  lastUpdatedAt: Date.now(),
};

// ============================================
// Entity Store Class
// ============================================

class EntityStoreState {
  // Core state (reactive via SvelteMap)
  private _tokens = new SvelteMap<string, NormalizedToken>();
  private _markets = new SvelteMap<string, NormalizedMarket>();
  private _pools = new SvelteMap<string, NormalizedPool>();
  private _userMarkets = new SvelteMap<string, NormalizedUserMarketData>();

  // Symbol index for fast lookup
  private _tokensBySymbol = new SvelteMap<string, string>(); // symbol -> canisterId

  // Treasury snapshots storage
  // Key format: `${interval}:${metric}` (e.g., '1W:cycles_balance')
  private _treasurySnapshots = new SvelteMap<string, TreasuryDataPoint[]>();

  // ============================================
  // Derived State
  // ============================================

  /** All tokens as array (reactive) */
  allTokens = $derived(Array.from(this._tokens.values()));

  /** All markets as array (reactive) */
  allMarkets = $derived(Array.from(this._markets.values()));

  /** All pools as array (reactive) */
  allPools = $derived(Array.from(this._pools.values()));

  /** Token count */
  tokenCount = $derived(this._tokens.size);

  /** Market count */
  marketCount = $derived(this._markets.size);

  /** Pool count */
  poolCount = $derived(this._pools.size);

  // ============================================
  // User Market Data Derived State
  // ============================================

  /** All user market data as array (reactive) */
  allUserMarkets = $derived(Array.from(this._userMarkets.values()));

  /** User market count */
  userMarketCount = $derived(this._userMarkets.size);

  /** Aggregate: all user orders across all markets */
  allUserOrders = $derived(
    this.allUserMarkets.flatMap(m => m.orders)
  );

  /** Aggregate: all user triggers across all markets */
  allUserTriggers = $derived(
    this.allUserMarkets.flatMap(m => m.triggers)
  );

  /** Aggregate: all user positions across all markets */
  allUserPositions = $derived(
    this.allUserMarkets.flatMap(m => m.positions)
  );

  /** Total positions TVL across all markets (E6 precision) */
  totalPositionsTvlE6 = $derived(
    this.allUserMarkets.reduce((sum, m) => sum + m.totalPositionsTvlE6, 0n)
  );

  /** Total positions fees across all markets (E6 precision) */
  totalPositionsFeesE6 = $derived(
    this.allUserMarkets.reduce((sum, m) => sum + m.totalPositionsFeesE6, 0n)
  );

  /** Whether user has any data in any market */
  hasUserData = $derived(this._userMarkets.size > 0);

  // ============================================
  // Token Operations
  // ============================================

  /**
   * Upsert a token (insert or update)
   * Merges with existing data, applies defaults for missing fields
   */
  upsertToken(data: TokenUpsert): NormalizedToken {
    const existing = this._tokens.get(data.canisterId);
    const now = Date.now();

    // Protect higher-priority price from being overwritten by lower-priority upserts.
    // e.g. oracle-derived price (5) must not be stomped by indexer (3).
    const incomingPricePriority = PRICE_SOURCE_PRIORITY[
      (data.priceSource ?? data.source ?? 'unknown') as PriceSource
    ] ?? 0;
    const existingPricePriority = existing
      ? PRICE_SOURCE_PRIORITY[existing.priceSource] ?? 0
      : -1;
    const protectPrice = existing
      && existing.priceUsd !== 0n
      && data.priceUsd !== undefined
      && incomingPricePriority < existingPricePriority;

    const normalized: NormalizedToken = {
      // Start with defaults
      ...DEFAULT_TOKEN,
      // Merge existing (if any)
      ...(existing ?? {}),
      // Apply new data
      ...data,
      // Restore protected price if incoming source is lower priority
      ...(protectPrice ? { priceUsd: existing!.priceUsd, priceSource: existing!.priceSource, priceUpdatedAt: existing!.priceUpdatedAt } : {}),
      // Ensure canisterId is set
      canisterId: data.canisterId,
      // Update timestamp
      lastUpdatedAt: now,
    };

    // Normalize symbol to uppercase for consistency
    normalized.symbol = normalized.symbol.toUpperCase();
    // Compute display symbol (ck-tokens → normalized, others → same as symbol)
    normalized.displaySymbol = computeDisplaySymbol(normalized.symbol);
    // Compute display name (ck-tokens → human-readable, others → same as name)
    normalized.displayName = computeDisplayName(normalized.name, normalized.displaySymbol, normalized.symbol);

    // Update maps
    this._tokens.set(data.canisterId, normalized);
    this._tokensBySymbol.set(normalized.symbol, data.canisterId);

    return normalized;
  }

  /**
   * Batch upsert tokens (more efficient for bulk operations)
   */
  upsertTokens(tokens: TokenUpsert[]): void {
    const now = Date.now();

    for (const data of tokens) {
      const existing = this._tokens.get(data.canisterId);

      // Same price protection as upsertToken
      const incomingPricePriority = PRICE_SOURCE_PRIORITY[
        (data.priceSource ?? data.source ?? 'unknown') as PriceSource
      ] ?? 0;
      const existingPricePriority = existing
        ? PRICE_SOURCE_PRIORITY[existing.priceSource] ?? 0
        : -1;
      const protectPrice = existing
        && existing.priceUsd !== 0n
        && data.priceUsd !== undefined
        && incomingPricePriority < existingPricePriority;

      const normalized: NormalizedToken = {
        ...DEFAULT_TOKEN,
        ...(existing ?? {}),
        ...data,
        ...(protectPrice ? { priceUsd: existing!.priceUsd, priceSource: existing!.priceSource, priceUpdatedAt: existing!.priceUpdatedAt } : {}),
        canisterId: data.canisterId,
        lastUpdatedAt: now,
      };

      normalized.symbol = normalized.symbol.toUpperCase();
      normalized.displaySymbol = computeDisplaySymbol(normalized.symbol);
      normalized.displayName = computeDisplayName(normalized.name, normalized.displaySymbol, normalized.symbol);
      this._tokens.set(data.canisterId, normalized);
      this._tokensBySymbol.set(normalized.symbol, data.canisterId);
    }
  }

  /**
   * Update token price specifically
   * Convenience method for price-only updates
   */
  updateTokenPrice(
    canisterId: string,
    priceUsd: bigint,
    source: PriceSource = 'unknown'
  ): void {
    const existing = this._tokens.get(canisterId);
    if (!existing) {
      // Create minimal token with price
      this.upsertToken({ canisterId, priceUsd, priceSource: source });
      return;
    }

    // Only update if we have a "better" source or newer data
    const sourcePriority = PRICE_SOURCE_PRIORITY;

    if (sourcePriority[source] >= sourcePriority[existing.priceSource]) {
      this._tokens.set(canisterId, {
        ...existing,
        priceUsd,
        priceSource: source,
        priceUpdatedAt: Date.now(),
        lastUpdatedAt: Date.now(),
      });
    }
  }

  /**
   * Get token by canister ID
   */
  getToken(canisterId: string): NormalizedToken | undefined {
    return this._tokens.get(canisterId);
  }

  /**
   * Get token by symbol (case-insensitive)
   */
  getTokenBySymbol(symbol: string): NormalizedToken | undefined {
    const canisterId = this._tokensBySymbol.get(symbol.toUpperCase());
    return canisterId ? this._tokens.get(canisterId) : undefined;
  }

  /**
   * Check if token exists
   */
  hasToken(canisterId: string): boolean {
    return this._tokens.has(canisterId);
  }

  /**
   * Get multiple tokens by IDs
   */
  getTokens(canisterIds: string[]): NormalizedToken[] {
    return canisterIds
      .map(id => this._tokens.get(id))
      .filter((t): t is NormalizedToken => t !== undefined);
  }

  // ============================================
  // Market Operations
  // ============================================

  /**
   * Upsert a market
   */
  upsertMarket(data: MarketUpsert): NormalizedMarket {
    const existing = this._markets.get(data.canisterId);
    const now = Date.now();

    const normalized: NormalizedMarket = {
      ...DEFAULT_MARKET,
      ...(existing ?? {}),
      ...data,
      canisterId: data.canisterId,
      lastUpdatedAt: now,
    };

    this._markets.set(data.canisterId, normalized);
    return normalized;
  }

  /**
   * Batch upsert markets
   */
  upsertMarkets(markets: MarketUpsert[]): void {
    const now = Date.now();

    for (const data of markets) {
      const existing = this._markets.get(data.canisterId);

      const normalized: NormalizedMarket = {
        ...DEFAULT_MARKET,
        ...(existing ?? {}),
        ...data,
        canisterId: data.canisterId,
        lastUpdatedAt: now,
      };

      this._markets.set(data.canisterId, normalized);
    }
  }

  /**
   * Get market by canister ID
   */
  getMarket(canisterId: string): NormalizedMarket | undefined {
    return this._markets.get(canisterId);
  }

  /**
   * Check if market exists
   */
  hasMarket(canisterId: string): boolean {
    return this._markets.has(canisterId);
  }

  // ============================================
  // Pool Operations
  // ============================================

  /**
   * Upsert a pool
   */
  upsertPool(data: PoolUpsert): NormalizedPool {
    const existing = this._pools.get(data.poolId);
    const now = Date.now();

    const normalized: NormalizedPool = {
      ...DEFAULT_POOL,
      ...(existing ?? {}),
      ...data,
      poolId: data.poolId,
      spotCanisterId: data.spotCanisterId,
      lastUpdatedAt: now,
    };

    this._pools.set(data.poolId, normalized);
    return normalized;
  }

  /**
   * Batch upsert pools
   */
  upsertPools(pools: PoolUpsert[]): void {
    const now = Date.now();

    for (const data of pools) {
      const existing = this._pools.get(data.poolId);

      const normalized: NormalizedPool = {
        ...DEFAULT_POOL,
        ...(existing ?? {}),
        ...data,
        poolId: data.poolId,
        spotCanisterId: data.spotCanisterId,
        lastUpdatedAt: now,
      };

      this._pools.set(data.poolId, normalized);
    }
  }

  /**
   * Get pool by ID
   */
  getPool(poolId: string): NormalizedPool | undefined {
    return this._pools.get(poolId);
  }

  /**
   * Get pools for a specific market
   */
  getPoolsForMarket(spotCanisterId: string): NormalizedPool[] {
    return this.allPools.filter(p => p.spotCanisterId === spotCanisterId);
  }

  // ============================================
  // User Market Data Operations
  // ============================================

  /**
   * Upsert user market data
   * Called by Portfolio coordinator after fetching from spot.get_user()
   * Also called by SpotMarket after user operations (orders, deposits, etc.)
   */
  upsertUserMarketData(data: UserMarketDataUpsert): NormalizedUserMarketData {
    const existing = this._userMarkets.get(data.spotCanisterId);
    const now = Date.now();

    const normalized: NormalizedUserMarketData = {
      // Start with defaults
      ...DEFAULT_USER_MARKET_DATA,
      // Merge existing (if any)
      ...(existing ?? {}),
      // Apply new data
      ...data,
      // Ensure identity is set
      spotCanisterId: data.spotCanisterId,
      // Update timestamp
      lastUpdatedAt: now,
    };

    this._userMarkets.set(data.spotCanisterId, normalized);
    return normalized;
  }

  /**
   * Batch upsert user market data (for initial portfolio hydration)
   */
  upsertUserMarkets(markets: UserMarketDataUpsert[]): void {
    const now = Date.now();

    for (const data of markets) {
      const existing = this._userMarkets.get(data.spotCanisterId);

      const normalized: NormalizedUserMarketData = {
        ...DEFAULT_USER_MARKET_DATA,
        ...(existing ?? {}),
        ...data,
        spotCanisterId: data.spotCanisterId,
        lastUpdatedAt: now,
      };

      this._userMarkets.set(data.spotCanisterId, normalized);
    }
  }

  /**
   * Get user data for a specific market
   */
  getUserMarketData(spotCanisterId: string): NormalizedUserMarketData | undefined {
    return this._userMarkets.get(spotCanisterId);
  }

  /**
   * Get user data for multiple markets
   */
  getUserMarkets(spotCanisterIds: string[]): NormalizedUserMarketData[] {
    return spotCanisterIds
      .map(id => this._userMarkets.get(id))
      .filter((m): m is NormalizedUserMarketData => m !== undefined);
  }

  /**
   * Clear all user data (logout)
   * Preserves market/token/pool data
   */
  clearUserData(): void {
    this._userMarkets.clear();
  }

  /**
   * Clear user data for a specific market
   */
  clearUserMarketData(spotCanisterId: string): void {
    this._userMarkets.delete(spotCanisterId);
  }

  // ============================================
  // Treasury Snapshot Operations
  // ============================================

  /**
   * Upsert treasury snapshots for a specific interval and metric.
   * Called by Treasury coordinator after fetching from repository.
   *
   * @param interval - Time interval (e.g., '1D', '1W', '1M', '1Y')
   * @param metric - Metric type (e.g., 'cumulative_fees_icp', 'cumulative_cycles_out')
   * @param data - Array of data points
   */
  upsertTreasurySnapshots(interval: string, metric: TreasuryMetric, data: TreasuryDataPoint[]): void {
    const key = `${interval}:${metric}`;
    this._treasurySnapshots.set(key, data);
  }

  /**
   * Get treasury snapshots for a specific interval and metric.
   * Returns empty array if not found (caller should trigger fetch).
   *
   * @param interval - Time interval (e.g., '1D', '1W', '1M', '1Y')
   * @param metric - Metric type (e.g., 'cumulative_fees_icp', 'cumulative_cycles_out')
   */
  getTreasurySnapshots(interval: string, metric: TreasuryMetric): TreasuryDataPoint[] {
    const key = `${interval}:${metric}`;
    return this._treasurySnapshots.get(key) ?? [];
  }

  /**
   * Check if treasury snapshots exist for a specific interval and metric.
   */
  hasTreasurySnapshots(interval: string, metric: TreasuryMetric): boolean {
    const key = `${interval}:${metric}`;
    return this._treasurySnapshots.has(key);
  }

  /**
   * Clear treasury snapshots (e.g., on data refresh)
   */
  clearTreasurySnapshots(): void {
    this._treasurySnapshots.clear();
  }

  // ============================================
  // Bulk Operations
  // ============================================

  /**
   * Clear all entities
   */
  clear(): void {
    this._tokens.clear();
    this._markets.clear();
    this._pools.clear();
    this._tokensBySymbol.clear();
  }

  /**
   * Clear stale entries (older than TTL)
   */
  pruneStale(ttlMs: number = 5 * 60 * 1000): void {
    const cutoff = Date.now() - ttlMs;

    for (const [id, token] of this._tokens) {
      if (token.lastUpdatedAt < cutoff) {
        this._tokens.delete(id);
        this._tokensBySymbol.delete(token.symbol);
      }
    }

    for (const [id, market] of this._markets) {
      if (market.lastUpdatedAt < cutoff) {
        this._markets.delete(id);
      }
    }

    for (const [id, pool] of this._pools) {
      if (pool.lastUpdatedAt < cutoff) {
        this._pools.delete(id);
      }
    }
  }

  // ============================================
  // Debug
  // ============================================

  /**
   * Get store statistics
   */
  getStats() {
    return {
      tokens: this._tokens.size,
      markets: this._markets.size,
      pools: this._pools.size,
      tokenSymbols: this._tokensBySymbol.size,
      userMarkets: this._userMarkets.size,
      userOrders: this.allUserOrders.length,
      userTriggers: this.allUserTriggers.length,
      userPositions: this.allUserPositions.length,
      treasurySnapshots: this._treasurySnapshots.size,
    };
  }

}

// ============================================
// Singleton Export
// ============================================

export const entityStore = new EntityStoreState();

// Development helper
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).entityStore = entityStore;
}
