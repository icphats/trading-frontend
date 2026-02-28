/**
 * Polling Coordinator
 *
 * Unified polling system with three cadence tiers:
 * - Fast (500ms): Active trading pair — version-gated conditional hydration
 * - Medium (8s): Visible rows — indexer data for viewport-visible markets/tokens
 * - Slow (15s): User data across all user markets (skips active market)
 *
 * Shared: single visibility gate, single auth guard, single lifecycle.
 *
 * Replaces both TickerService and SpotMarket's internal polling.
 * See md/canon/frontend/10-Polling.md for full documentation.
 */

import { marketRepository } from '$lib/repositories/market.repository';
import { entityStore } from './entity-store.svelte';
import {
  indexerDataToUpserts,
  createTokenContribution,
  aggregateTokenContributions,
  deriveBasePriceUsdE12,
} from './ticker-transforms';
import type { MarketTokenContribution } from './ticker-transforms';
import type { SpotMarket } from '$lib/domain/markets/state/spot-market.svelte';
import type { PollVersions } from '$lib/actors/services/spot.service';
import type { Principal } from '@dfinity/principal';
import { bpsToPercent } from '$lib/domain/markets/utils/math';

// ============================================
// Token Registration Types (from TickerService)
// ============================================

interface TokenRegistration {
  baseMarkets: string[];
  quoteMarkets: string[];
}

interface CanisterTokenRef {
  tokenCanisterId: string;
  role: 'base' | 'quote';
}

// ============================================
// Polling Coordinator
// ============================================

class PollingCoordinator {
  // Diagnostic state (reactive, for dev tools)
  isRunning = $state(false);
  visibleCount = $state(0);
  userMarketCount = $state(0);

  // Cadence constants (1s on mobile, 500ms on desktop)
  private readonly FAST_MS = typeof window !== 'undefined' && window.innerWidth < 768 ? 1_000 : 500;
  private readonly MEDIUM_MS = 8_000;
  private readonly SLOW_MS = 15_000;

  // Timer handles
  private fastTimer: ReturnType<typeof setInterval> | null = null;
  private mediumTimer: ReturnType<typeof setInterval> | null = null;
  private slowTimer: ReturnType<typeof setInterval> | null = null;

  // Fetch guards (prevent concurrent ticks)
  private isFetchingFast = false;
  private isFetchingMedium = false;
  private isFetchingSlow = false;

  // Shared visibility gate
  private isDocumentVisible = true;
  private visibilityCleanup: (() => void) | null = null;

  // Fast tier: active market + version counters
  private activeMarketId: string | null = null;
  private activeSpotMarket: SpotMarket | null = null;
  private platformVersion = 0n;
  private orderbookVersion = 0n;
  private candleVersion = 0n;
  private userVersion = 0n;

  // Medium tier: ref-counted visible registrations + token fan-out
  private visibleRefCounts = new Map<string, number>();
  private tokenRegistrations = new Map<string, TokenRegistration>();
  private canisterToTokens = new Map<string, CanisterTokenRef[]>();
  private tokenContributions = new Map<string, Map<string, MarketTokenContribution>>();

  // Slow tier: auth state + per-market user version tracking
  private currentPrincipal: Principal | null = null;
  private slowUserVersions = new Map<string, bigint>();

  // ============================================
  // Lifecycle
  // ============================================

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Attach visibility listener
    if (typeof document !== 'undefined') {
      this.isDocumentVisible = document.visibilityState === 'visible';

      const handler = () => {
        const wasHidden = !this.isDocumentVisible;
        this.isDocumentVisible = document.visibilityState === 'visible';

        // On resume from hidden, fire all tiers immediately
        if (this.isDocumentVisible && wasHidden) {
          this.fastTick();
          this.mediumTick();
          this.slowTick();
        }
      };

      document.addEventListener('visibilitychange', handler);
      this.visibilityCleanup = () => document.removeEventListener('visibilitychange', handler);
    }

    // Start timers
    this.fastTimer = setInterval(() => this.fastTick(), this.FAST_MS);
    this.mediumTimer = setInterval(() => this.mediumTick(), this.MEDIUM_MS);
    this.slowTimer = setInterval(() => this.slowTick(), this.SLOW_MS);
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.fastTimer) { clearInterval(this.fastTimer); this.fastTimer = null; }
    if (this.mediumTimer) { clearInterval(this.mediumTimer); this.mediumTimer = null; }
    if (this.slowTimer) { clearInterval(this.slowTimer); this.slowTimer = null; }

    if (this.visibilityCleanup) {
      this.visibilityCleanup();
      this.visibilityCleanup = null;
    }
  }

  destroy(): void {
    this.stop();
    this.activeMarketId = null;
    this.activeSpotMarket = null;
    this.platformVersion = 0n;
    this.orderbookVersion = 0n;
    this.candleVersion = 0n;
    this.userVersion = 0n;
    this.visibleRefCounts.clear();
    this.tokenRegistrations.clear();
    this.canisterToTokens.clear();
    this.tokenContributions.clear();
    this.currentPrincipal = null;
    this.slowUserVersions.clear();
    this.visibleCount = 0;
    this.userMarketCount = 0;
  }

  // ============================================
  // Fast Tier — Active Trading Pair
  // ============================================

  setActiveMarket(canisterId: string, market: SpotMarket): void {
    this.activeMarketId = canisterId;
    this.activeSpotMarket = market;
    // Reset versions so first tick fetches everything
    this.platformVersion = 0n;
    this.orderbookVersion = 0n;
    this.candleVersion = 0n;
    this.userVersion = 0n;
    // Immediate tick
    this.fastTick();
  }

  clearActiveMarket(): void {
    this.activeMarketId = null;
    this.activeSpotMarket = null;
    this.platformVersion = 0n;
    this.orderbookVersion = 0n;
    this.candleVersion = 0n;
    this.userVersion = 0n;
  }

  /**
   * Apply mutation-returned versions and immediately hydrate changed data.
   * Skips the poll_versions() call — we already know what changed.
   */
  applyMutationVersions(canisterId: string, versions: PollVersions): void {
    if (canisterId === this.activeMarketId && this.activeSpotMarket) {
      // Fast tier: diff against cached, hydrate what changed, then update cache
      const fetchPromises: Promise<void>[] = [];

      if (versions.platform !== this.platformVersion) {
        fetchPromises.push(this.activeSpotMarket.hydratePlatformData());
        fetchPromises.push(this.activeSpotMarket.hydrateTransactions());
      } else if (versions.orderbook !== this.orderbookVersion) {
        fetchPromises.push(this.activeSpotMarket.hydrateOrderBookOnly());
      }

      if (versions.candle !== this.candleVersion) {
        fetchPromises.push(this.activeSpotMarket.hydrateChartOnly());
      }

      if (versions.user !== this.userVersion && this.currentPrincipal) {
        fetchPromises.push(this.activeSpotMarket.hydrateUserDataOnly());
      }

      // Update cached versions so next fastTick() is a no-op
      this.platformVersion = versions.platform;
      this.orderbookVersion = versions.orderbook;
      this.candleVersion = versions.candle;
      this.userVersion = versions.user;

      // Fire and forget — hydrations run in background
      if (fetchPromises.length > 0) {
        Promise.all(fetchPromises).catch(() => {});
      }
    } else {
      // Slow tier: update per-market user version cache
      this.slowUserVersions.set(canisterId, versions.user);
    }
  }

  // ============================================
  // Medium Tier — Visible Rows (market/pool/token)
  // ============================================

  registerVisible(spotCanisterId: string): void {
    const count = this.visibleRefCounts.get(spotCanisterId) ?? 0;
    this.visibleRefCounts.set(spotCanisterId, count + 1);
    this.visibleCount = this.visibleRefCounts.size;
  }

  unregisterVisible(spotCanisterId: string): void {
    const count = this.visibleRefCounts.get(spotCanisterId) ?? 0;
    if (count <= 1) {
      this.visibleRefCounts.delete(spotCanisterId);
    } else {
      this.visibleRefCounts.set(spotCanisterId, count - 1);
    }
    this.visibleCount = this.visibleRefCounts.size;
  }

  registerTokenVisible(tokenCanisterId: string): void {
    if (this.tokenRegistrations.has(tokenCanisterId)) return;

    const token = entityStore.getToken(tokenCanisterId);
    if (!token) return;

    const baseMarkets = token.baseMarkets ?? [];
    const quoteMarkets = token.quoteMarkets ?? [];
    if (baseMarkets.length === 0 && quoteMarkets.length === 0) return;

    this.tokenRegistrations.set(tokenCanisterId, { baseMarkets, quoteMarkets });

    for (const canisterId of baseMarkets) {
      this.addCanisterTokenRef(canisterId, tokenCanisterId, 'base');
      this.addVisibleRef(canisterId);
    }
    for (const canisterId of quoteMarkets) {
      this.addCanisterTokenRef(canisterId, tokenCanisterId, 'quote');
      this.addVisibleRef(canisterId);
    }
  }

  unregisterTokenVisible(tokenCanisterId: string): void {
    const reg = this.tokenRegistrations.get(tokenCanisterId);
    if (!reg) return;

    for (const canisterId of reg.baseMarkets) {
      this.removeCanisterTokenRef(canisterId, tokenCanisterId);
      this.removeVisibleRef(canisterId);
    }
    for (const canisterId of reg.quoteMarkets) {
      this.removeCanisterTokenRef(canisterId, tokenCanisterId);
      this.removeVisibleRef(canisterId);
    }

    this.tokenRegistrations.delete(tokenCanisterId);
    this.tokenContributions.delete(tokenCanisterId);
  }

  // ============================================
  // Slow Tier — User Principal
  // ============================================

  setUserPrincipal(principal: Principal | null): void {
    this.currentPrincipal = principal;
    // Reset per-market versions (different user = different version counters)
    this.slowUserVersions.clear();
    // Immediate tick on login
    if (principal) {
      this.slowTick();
      // Also kick fast tier to fetch user data for active market
      if (this.activeSpotMarket) {
        this.userVersion = 0n; // Force re-fetch
        this.fastTick();
      }
    }
  }

  // ============================================
  // Manual Poll
  // ============================================

  pollNow(tier?: 'fast' | 'medium' | 'slow'): void {
    if (!tier || tier === 'fast') this.fastTick();
    if (!tier || tier === 'medium') this.mediumTick();
    if (!tier || tier === 'slow') this.slowTick();
  }

  // ============================================
  // Fast Tick — Version-Gated Active Market
  // ============================================

  private async fastTick(): Promise<void> {
    if (this.isFetchingFast) return;
    if (!this.isDocumentVisible) return;
    if (!this.activeMarketId || !this.activeSpotMarket) return;

    this.isFetchingFast = true;

    try {
      const versionResult = await marketRepository.fetchPollVersions(this.activeMarketId);
      if ('err' in versionResult) return;

      const newVersions = versionResult.ok;
      const fetchPromises: Promise<void>[] = [];

      // Platform version changed → trade, liquidity change, or oracle update
      if (newVersions.platform !== this.platformVersion) {
        fetchPromises.push(this.activeSpotMarket.hydratePlatformData());
        fetchPromises.push(this.activeSpotMarket.hydrateTransactions());
      }
      // Orderbook version changed (but platform didn't) → order add/cancel without match
      else if (newVersions.orderbook !== this.orderbookVersion) {
        fetchPromises.push(this.activeSpotMarket.hydrateOrderBookOnly());
      }

      // Candle version changed → timer boundary, candle archived
      if (newVersions.candle !== this.candleVersion) {
        fetchPromises.push(this.activeSpotMarket.hydrateChartOnly());
      }

      // User version changed
      if (newVersions.user !== this.userVersion && this.currentPrincipal) {
        fetchPromises.push(this.activeSpotMarket.hydrateUserDataOnly());
      }

      if (fetchPromises.length > 0) {
        await Promise.all(fetchPromises);
      }

      // Update versions AFTER successful fetches
      this.platformVersion = newVersions.platform;
      this.orderbookVersion = newVersions.orderbook;
      this.candleVersion = newVersions.candle;
      this.userVersion = newVersions.user;
    } catch {
      // Silent error handling during polling
    } finally {
      this.isFetchingFast = false;
    }
  }

  // ============================================
  // Medium Tick — Visible Row Data (from TickerService)
  // ============================================

  private async mediumTick(): Promise<void> {
    if (this.isFetchingMedium) return;
    if (!this.isDocumentVisible) return;

    const targets = [...this.visibleRefCounts.keys()];
    if (targets.length === 0) return;

    this.isFetchingMedium = true;
    const affectedTokenIds = new Set<string>();

    try {
      await Promise.allSettled(
        targets.map((canisterId) => this.fetchAndStoreIndexerData(canisterId, affectedTokenIds)),
      );

      this.aggregateAndUpsertTokens(affectedTokenIds);
    } finally {
      this.isFetchingMedium = false;
    }
  }

  private async fetchAndStoreIndexerData(
    canisterId: string,
    affectedTokenIds: Set<string>,
  ): Promise<void> {
    try {
      const result = await marketRepository.fetchSpotIndexerData(canisterId, false);
      if ('err' in result) return;

      const data = result.ok;
      const upserts = indexerDataToUpserts(canisterId, data);

      entityStore.upsertMarket(upserts.market);
      if (upserts.pools.length > 0) {
        entityStore.upsertPools(upserts.pools);
      }

      // Token contributions for registered tokens
      const tokenRefs = this.canisterToTokens.get(canisterId);
      if (tokenRefs) {
        for (const { tokenCanisterId, role } of tokenRefs) {
          const contribution = createTokenContribution(canisterId, tokenCanisterId, role, data);

          if (!this.tokenContributions.has(tokenCanisterId)) {
            this.tokenContributions.set(tokenCanisterId, new Map());
          }
          this.tokenContributions.get(tokenCanisterId)!.set(canisterId, contribution);
          affectedTokenIds.add(tokenCanisterId);
        }
      }
    } catch {
      // Silent per-canister error
    }
  }

  private aggregateAndUpsertTokens(affectedTokenIds: Set<string>): void {
    for (const tokenId of affectedTokenIds) {
      const contributions = this.tokenContributions.get(tokenId);
      if (!contributions || contributions.size === 0) continue;

      const tokenUpsert = aggregateTokenContributions([...contributions.values()]);

      // Re-derive base token USD price from tick + quote token's frontend USD rate.
      // The canister's baked current_price_usd_e12 uses the on-chain oracle rate
      // (5-min stale). Re-deriving from the frontend's fresher quote token price
      // ensures USD consistency across both sides of a trade.
      const derivedPrice = this.deriveTokenPrice(tokenId, contributions);
      if (derivedPrice !== null) {
        tokenUpsert.priceUsd = derivedPrice;
      }

      entityStore.updateTokenPrice(tokenUpsert.canisterId, tokenUpsert.priceUsd!, 'oracle');

      // Quote tokens (ckUSDT, ICP, ckUSDC): indexer is source of truth for TVL/volume.
      // The medium tick only polls visible markets, so partial aggregation would
      // overwrite the correct indexer aggregate with an incomplete sum.
      const existing = entityStore.getToken(tokenId);
      if (existing?.isQuoteToken) {
        delete tokenUpsert.volume24h;
        delete tokenUpsert.volume7d;
        delete tokenUpsert.volume30d;
        delete tokenUpsert.tvl;
      }

      entityStore.upsertToken(tokenUpsert);
    }
  }

  /**
   * Derive a base token's USD price from tick + quote token's frontend price.
   * Returns null if derivation isn't possible (no tick or no quote price available),
   * in which case the caller falls through to the canister's baked value.
   */
  private deriveTokenPrice(
    tokenCanisterId: string,
    contributions: Map<string, MarketTokenContribution>,
  ): bigint | null {
    // Find a base-role contribution (only base tokens need re-derivation)
    let baseContribution: MarketTokenContribution | null = null;
    for (const c of contributions.values()) {
      if (c.role === 'base') {
        baseContribution = c;
        break;
      }
    }
    if (!baseContribution) return null;

    // Look up the market to get the tick and quote token
    const market = entityStore.getMarket(baseContribution.spotCanisterId);
    if (!market) return null;
    const tick = market.referenceTick ?? market.lastTradeTick;
    if (!tick) return null;

    // Look up the quote token's USD price from entity store
    const quoteToken = entityStore.getToken(market.quoteToken);
    if (!quoteToken?.priceUsd || quoteToken.priceUsd === 0n) return null;

    // Look up base token decimals
    const baseToken = entityStore.getToken(tokenCanisterId);
    if (!baseToken) return null;

    return deriveBasePriceUsdE12(
      tick,
      baseToken.decimals,
      quoteToken.decimals,
      quoteToken.priceUsd,
    );
  }

  // ============================================
  // Slow Tick — User Data Across Markets
  // ============================================

  private async slowTick(): Promise<void> {
    if (this.isFetchingSlow) return;
    if (!this.isDocumentVisible) return;
    if (!this.currentPrincipal) return;

    const userMarkets = entityStore.allUserMarkets;
    if (userMarkets.length === 0) {
      this.userMarketCount = 0;
      return;
    }

    this.isFetchingSlow = true;
    this.userMarketCount = userMarkets.length;

    try {
      // Fetch user data for each market, skipping active market (fast tier handles it)
      const promises = userMarkets
        .filter(m => m.spotCanisterId !== this.activeMarketId)
        .map(m => this.fetchUserDataForMarket(m.spotCanisterId));

      await Promise.allSettled(promises);
    } finally {
      this.isFetchingSlow = false;
    }
  }

  /**
   * Version-gated user data fetch for a single market.
   * Calls poll_versions() first (lightweight), only fetches get_user()
   * when the user version has actually changed.
   */
  private async fetchUserDataForMarket(canisterId: string): Promise<void> {
    try {
      // 1. Lightweight version check
      const versionResult = await marketRepository.fetchPollVersions(canisterId);
      if ('err' in versionResult) return;

      const newUserVersion = versionResult.ok.user;
      const cachedVersion = this.slowUserVersions.get(canisterId) ?? 0n;

      // 2. Skip if user version unchanged
      if (newUserVersion === cachedVersion) return;

      // 3. Version changed — fetch full user data
      const result = await marketRepository.fetchUserData(canisterId);

      if ('ok' in result && result.ok.length > 0) {
        const userData = result.ok[0];
        if (userData) {
          // Compute position aggregates (same logic as SpotMarket.pushUserDataToEntityStore)
          let totalTvl = 0n;
          let totalFees = 0n;
          let weightedAprBpsNumerator = 0n;
          for (const pos of userData.positions) {
            totalTvl += pos.usd_value_e6;
            totalFees += pos.fees_usd_value_e6;
            weightedAprBpsNumerator += pos.apr_bps * pos.usd_value_e6;
          }

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
            weightedAvgApy: totalTvl > 0n
              ? bpsToPercent(weightedAprBpsNumerator / totalTvl)
              : 0,
          });
        }
      }

      // 4. Update cached version AFTER successful fetch
      this.slowUserVersions.set(canisterId, newUserVersion);
    } catch {
      // Silent per-market error
    }
  }

  // ============================================
  // Internal Helpers — Ref Counting
  // ============================================

  private addVisibleRef(canisterId: string): void {
    const count = this.visibleRefCounts.get(canisterId) ?? 0;
    this.visibleRefCounts.set(canisterId, count + 1);
    this.visibleCount = this.visibleRefCounts.size;
  }

  private removeVisibleRef(canisterId: string): void {
    const count = this.visibleRefCounts.get(canisterId) ?? 0;
    if (count <= 1) {
      this.visibleRefCounts.delete(canisterId);
    } else {
      this.visibleRefCounts.set(canisterId, count - 1);
    }
    this.visibleCount = this.visibleRefCounts.size;
  }

  private addCanisterTokenRef(canisterId: string, tokenCanisterId: string, role: 'base' | 'quote'): void {
    let refs = this.canisterToTokens.get(canisterId);
    if (!refs) {
      refs = [];
      this.canisterToTokens.set(canisterId, refs);
    }
    refs.push({ tokenCanisterId, role });
  }

  private removeCanisterTokenRef(canisterId: string, tokenCanisterId: string): void {
    const refs = this.canisterToTokens.get(canisterId);
    if (!refs) return;

    const filtered = refs.filter((r) => r.tokenCanisterId !== tokenCanisterId);
    if (filtered.length === 0) {
      this.canisterToTokens.delete(canisterId);
    } else {
      this.canisterToTokens.set(canisterId, filtered);
    }
  }
}

// ============================================
// Singleton Export
// ============================================

export const pollingCoordinator = new PollingCoordinator();

// Development helper
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).pollingCoordinator = pollingCoordinator;
}
