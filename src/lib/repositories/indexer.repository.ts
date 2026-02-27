/**
 * Indexer Repository
 *
 * Data access layer for market/pool/token discovery and search.
 * Uses the pre-initialized anonymous indexer actor from api.state.
 *
 * ## Architecture
 *
 * ```
 * Pages → indexerRepository → api.indexer (anonymous actor)
 *                ↓
 *         entityStore (domain layer)
 * ```
 *
 * - Repository handles: API calls, caching, error handling
 * - Domain layer handles: normalized entities (no API calls)
 * - Pages handle: UI state (pagination, loading)
 */

import { api } from '$lib/actors/api.svelte';
import { MemoryCache } from './cache';
import { type Result } from './shared/result';
import { cacheCleanupManager } from './shared/cleanup';
import type {
  MarketListResponse,
  MarketListItem,
  PoolListResponse,
  PoolListItem,
  TokenListResponse,
  TokenListItem,
  FrozenTokenEntry,
  FrozenPlatformStats,
  SearchResponse,
  SearchFilter,
  VolumeCursor,
  QuoteTokenSnapshotsResponse,
} from 'declarations/indexer/indexer.did';
import type { TokenUpsert, MarketUpsert, PoolUpsert } from '$lib/types/entity.types';
import { bpsToPercent } from '$lib/domain/markets/utils/math';

// Re-export types for consumers
export type { Result } from './shared/result';
export type { SearchFilter, SearchResponse } from 'declarations/indexer/indexer.did';

// ============================================
// Indexer → EntityStore Transformers
// ============================================

/**
 * Transform indexer TokenListItem to normalized TokenUpsert
 * Note: Backend uses E6 precision for USD accumulators (volume, TVL)
 * and E12 precision for prices
 */
export function tokenItemToUpsert(item: TokenListItem): TokenUpsert {
  return {
    canisterId: item.token_ledger.toString(),
    symbol: item.symbol || 'UNKNOWN',
    name: item.name || 'Unknown Token',
    decimals: item.decimals,
    priceUsd: item.current_price_usd_e12,
    priceChange24h: bpsToPercent(item.price_change_24h_bps),
    priceSource: 'indexer',
    volume24h: item.volume_24h_usd_e6,
    volume7d: item.volume_7d_usd_e6,
    volume30d: item.volume_30d_usd_e6,
    tvl: item.tvl_usd_e6,
    baseMarkets: item.base_markets.map((p) => p.toString()),
    quoteMarkets: item.quote_markets.map((p) => p.toString()),
    source: 'indexer',
  };
}

/**
 * Transform indexer MarketListItem to normalized MarketUpsert
 * Note: Backend uses E6 for volume, E12 for prices
 */
export function marketItemToUpsert(item: MarketListItem): MarketUpsert {
  return {
    canisterId: item.canister_id.toString(),
    symbol: item.symbol || 'UNKNOWN/UNKNOWN',
    baseToken: item.base_token.toString(),
    quoteToken: item.quote_token.toString(),
    volume24h: item.volume_24h_usd_e6,
    lastTradePrice: item.last_price_usd_e12,
    priceChange24h: bpsToPercent(item.price_change_24h_bps),
    isActive: true,
    source: 'indexer',
  };
}

/**
 * Transform indexer PoolListItem to normalized PoolUpsert
 * Note: Backend uses E6 precision for USD accumulators (volume, TVL, fees)
 */
export function poolItemToUpsert(item: PoolListItem): PoolUpsert {
  const spotCanisterId = item.spot_canister.toString();
  return {
    poolId: `${spotCanisterId}:${item.fee_pips}`,
    spotCanisterId,
    symbol: item.symbol || 'UNKNOWN/UNKNOWN',
    feePips: item.fee_pips, // Keep as pips (100-10000)
    tvl: item.tvl_usd_e6,
    volume24h: item.volume_24h_usd_e6,
    apr: bpsToPercent(item.apr_bps),
    source: 'indexer',
  };
}

// ============================================
// Indexer Repository Class
// ============================================

export class IndexerRepository {
  // Data caches (longer TTL for discovery data)
  private marketsCache: MemoryCache<MarketListResponse>;
  private poolsCache: MemoryCache<PoolListResponse>;
  private tokensCache: MemoryCache<TokenListResponse>;
  private tokenMetadataCache: MemoryCache<FrozenTokenEntry[]>;
  private platformStatsCache: MemoryCache<FrozenPlatformStats>;
  private searchCache: MemoryCache<SearchResponse>;
  private marketByPairCache: MemoryCache<string | null>;
  private quoteSnapshotsCache: MemoryCache<QuoteTokenSnapshotsResponse>;

  constructor() {
    this.marketsCache = new MemoryCache<MarketListResponse>();
    this.poolsCache = new MemoryCache<PoolListResponse>();
    this.tokensCache = new MemoryCache<TokenListResponse>();
    this.tokenMetadataCache = new MemoryCache<FrozenTokenEntry[]>();
    this.platformStatsCache = new MemoryCache<FrozenPlatformStats>();
    this.searchCache = new MemoryCache<SearchResponse>();
    this.marketByPairCache = new MemoryCache<string | null>();
    this.quoteSnapshotsCache = new MemoryCache<QuoteTokenSnapshotsResponse>();
  }

  // ============================================
  // Actor Access (via api.state)
  // ============================================

  private getActor() {
    if (!api.indexer) {
      throw new Error('Indexer not initialized. Ensure api.initPublic() has been called.');
    }
    return api.indexer;
  }

  // ============================================
  // Market Discovery
  // ============================================

  /**
   * Get all markets with pagination
   * Uses cache with 5-minute TTL
   */
  async getMarkets(
    limit: bigint = 100n,
    cursor?: VolumeCursor,
    useCache: boolean = true
  ): Promise<Result<MarketListResponse>> {
    const cacheKey = `markets:${limit}:${cursor?.id.toString() ?? 'none'}`;

    if (useCache) {
      const cached = this.marketsCache.get(cacheKey);
      if (cached) {
        return { ok: cached };
      }
    }

    try {
      const actor = this.getActor();

      const result = await actor.get_markets({ limit, cursor: cursor ? [cursor] : [] });

      this.marketsCache.set(cacheKey, result, 300_000); // 5 min
      return { ok: result };
    } catch (error) {
      console.error('Failed to fetch markets:', error);
      return { err: error instanceof Error ? error.message : 'Failed to fetch markets' };
    }
  }

  /**
   * Get spot market canister ID for a base/quote token pair.
   * Returns null if no market exists for this pair.
   *
   * @param baseToken - Base token ledger canister ID
   * @param quoteToken - Quote token ledger canister ID
   */
  async getMarketByPair(
    baseToken: string,
    quoteToken: string,
    useCache: boolean = true
  ): Promise<Result<string | null>> {
    const cacheKey = `pair:${baseToken}:${quoteToken}`;

    if (useCache) {
      const cached = this.marketByPairCache.get(cacheKey);
      if (cached !== null) {
        return { ok: cached };
      }
    }

    try {
      const actor = this.getActor();
      const { Principal } = await import('@dfinity/principal');

      const result = await actor.get_market_by_pair(
        Principal.fromText(baseToken),
        Principal.fromText(quoteToken)
      );

      // Convert Principal[] (opt) to string | null
      const spotCanisterId = result[0]?.toString() ?? null;

      this.marketByPairCache.set(cacheKey, spotCanisterId, 300_000); // 5 min
      return { ok: spotCanisterId };
    } catch (error) {
      console.error('Failed to get market by pair:', error);
      return { err: error instanceof Error ? error.message : 'Failed to get market by pair' };
    }
  }

  /**
   * Get spot market canister ID by token symbols (e.g., "BOOM", "ICP").
   * Case-insensitive. Returns null if tokens or market not found.
   * Primary endpoint for URL-based market resolution (e.g., /trade/BOOM/ICP).
   *
   * @param baseSymbol - Base token symbol (e.g., "BOOM")
   * @param quoteSymbol - Quote token symbol (e.g., "ICP")
   */
  async getMarketBySymbols(
    baseSymbol: string,
    quoteSymbol: string,
    useCache: boolean = true
  ): Promise<Result<string | null>> {
    // Normalize to uppercase for cache key
    const cacheKey = `symbols:${baseSymbol.toUpperCase()}:${quoteSymbol.toUpperCase()}`;

    if (useCache) {
      const cached = this.marketByPairCache.get(cacheKey);
      if (cached !== null) {
        return { ok: cached };
      }
    }

    try {
      const actor = this.getActor();

      const result = await actor.get_market_by_symbols(baseSymbol, quoteSymbol);

      // Convert Principal[] (opt) to string | null
      const spotCanisterId = result[0]?.toString() ?? null;

      // Only cache successful lookups - don't cache null results
      if (spotCanisterId) {
        this.marketByPairCache.set(cacheKey, spotCanisterId, 300_000); // 5 min
      }
      return { ok: spotCanisterId };
    } catch (error) {
      console.error('Failed to get market by symbols:', error);
      return { err: error instanceof Error ? error.message : 'Failed to get market by symbols' };
    }
  }

  /**
   * Unified search for tokens, markets, or both
   * Returns SearchResponse with tokens and markets arrays
   * Backend enforces 2-char minimum (returns empty arrays if < 2)
   *
   * @param filter - 'all' | 'tokens' | 'markets'
   */
  async search(
    searchTerm: string,
    limit: bigint = 20n,
    filter: SearchFilter = { all: null },
    useCache: boolean = true
  ): Promise<Result<SearchResponse>> {
    const filterKey = 'all' in filter ? 'all' : 'tokens' in filter ? 'tokens' : 'markets';
    const cacheKey = `search:${searchTerm.toLowerCase()}:${limit}:${filterKey}`;

    if (useCache) {
      const cached = this.searchCache.get(cacheKey);
      if (cached) {
        return { ok: cached };
      }
    }

    try {
      const actor = this.getActor();

      const result = await actor.search(searchTerm, limit, filter);

      this.searchCache.set(cacheKey, result, 60_000); // 1 min
      return { ok: result };
    } catch (error) {
      console.error('Failed to search:', error);
      return { err: error instanceof Error ? error.message : 'Failed to search' };
    }
  }

  // ============================================
  // Pool Discovery
  // ============================================

  /**
   * Get all pools with cursor-based pagination
   * Uses cache with 5-minute TTL
   */
  async getPools(
    limit: bigint = 100n,
    cursor?: VolumeCursor,
    useCache: boolean = true
  ): Promise<Result<PoolListResponse>> {
    const cacheKey = `pools:${limit}:${cursor?.id.toString() ?? 'none'}`;

    if (useCache) {
      const cached = this.poolsCache.get(cacheKey);
      if (cached) {
        return { ok: cached };
      }
    }

    try {
      const actor = this.getActor();

      const result = await actor.get_pools({ limit, cursor: cursor ? [cursor] : [] });

      this.poolsCache.set(cacheKey, result, 300_000); // 5 min
      return { ok: result };
    } catch (error) {
      console.error('Failed to fetch pools:', error);
      return { err: error instanceof Error ? error.message : 'Failed to fetch pools' };
    }
  }

  // ============================================
  // Token Discovery
  // ============================================

  /**
   * Get all tokens with cursor-based pagination
   * Uses cache with 5-minute TTL
   */
  async getTokens(
    limit: bigint = 100n,
    cursor?: VolumeCursor,
    useCache: boolean = true
  ): Promise<Result<TokenListResponse>> {
    const cacheKey = `tokens:${limit}:${cursor?.id.toString() ?? 'none'}`;

    if (useCache) {
      const cached = this.tokensCache.get(cacheKey);
      if (cached) {
        return { ok: cached };
      }
    }

    try {
      const actor = this.getActor();

      const result = await actor.get_tokens({ limit, cursor: cursor ? [cursor] : [] });

      this.tokensCache.set(cacheKey, result, 300_000); // 5 min
      return { ok: result };
    } catch (error) {
      console.error('Failed to fetch tokens:', error);
      return { err: error instanceof Error ? error.message : 'Failed to fetch tokens' };
    }
  }

  /**
   * Get all token metadata for initial hydration
   * Static ICRC-1 metadata - cached for full 5 minutes
   */
  async getTokenMetadata(
    useCache: boolean = true
  ): Promise<Result<FrozenTokenEntry[]>> {
    const cacheKey = 'token-metadata';

    if (useCache) {
      const cached = this.tokenMetadataCache.get(cacheKey);
      if (cached) {
        return { ok: cached };
      }
    }

    try {
      const actor = this.getActor();

      const result = await actor.get_hydration();

      this.tokenMetadataCache.set(cacheKey, result, 300_000); // 5 min
      return { ok: result };
    } catch (error) {
      console.error('Failed to fetch token metadata:', error);
      return { err: error instanceof Error ? error.message : 'Failed to fetch token metadata' };
    }
  }

  // ============================================
  // Platform Statistics
  // ============================================

  /**
   * Get platform-wide aggregate statistics
   * Uses cache with 5-minute TTL
   */
  async getPlatformStats(
    useCache: boolean = true
  ): Promise<Result<FrozenPlatformStats>> {
    const cacheKey = 'platform-stats';

    if (useCache) {
      const cached = this.platformStatsCache.get(cacheKey);
      if (cached) {
        return { ok: cached };
      }
    }

    try {
      const actor = this.getActor();

      const result = await actor.get_platform_stats();

      this.platformStatsCache.set(cacheKey, result, 300_000); // 5 min
      return { ok: result };
    } catch (error) {
      console.error('Failed to fetch platform stats:', error);
      return { err: error instanceof Error ? error.message : 'Failed to fetch platform stats' };
    }
  }

  // ============================================
  // Quote Token Snapshots
  // ============================================

  /**
   * Get snapshots for a quote token at any interval (aggregated across all markets).
   * interval_hours: 1 (1D), 6 (1W) → hourly buffer. 24 (1M/1Y) → daily Region.
   * Mirrors spot canister's getMarketSnapshots(before_timestamp, limit, interval_hours).
   */
  async getQuoteTokenSnapshots(
    tokenLedger: string,
    intervalHours: number,
    limit: bigint = 365n,
    beforeTimestamp?: bigint,
    useCache: boolean = true
  ): Promise<Result<QuoteTokenSnapshotsResponse>> {
    const cacheKey = `qt-snap:${tokenLedger}:${intervalHours}:${limit}:${beforeTimestamp ?? 'latest'}`;

    if (useCache) {
      const cached = this.quoteSnapshotsCache.get(cacheKey);
      if (cached) return { ok: cached };
    }

    try {
      const actor = this.getActor();
      const { Principal } = await import('@dfinity/principal');
      const beforeOpt: [] | [bigint] = beforeTimestamp !== undefined ? [beforeTimestamp] : [];

      const result = await actor.get_quote_token_snapshots(
        Principal.fromText(tokenLedger),
        beforeOpt,
        limit,
        BigInt(intervalHours),
      );

      this.quoteSnapshotsCache.set(cacheKey, result, 300_000); // 5 min
      return { ok: result };
    } catch (error) {
      console.error('Failed to fetch quote token snapshots:', error);
      return { err: error instanceof Error ? error.message : 'Failed to fetch quote token snapshots' };
    }
  }

  // ============================================
  // Cache Management
  // ============================================

  /**
   * Invalidate all caches
   */
  invalidateAll(): void {
    this.marketsCache.clear();
    this.poolsCache.clear();
    this.tokensCache.clear();
    this.tokenMetadataCache.clear();
    this.platformStatsCache.clear();
    this.searchCache.clear();
    this.marketByPairCache.clear();
    this.quoteSnapshotsCache.clear();
  }

  /**
   * Invalidate markets cache only
   */
  invalidateMarkets(): void {
    this.marketsCache.clear();
  }

  /**
   * Invalidate pools cache only
   */
  invalidatePools(): void {
    this.poolsCache.clear();
  }

  /**
   * Invalidate tokens cache only
   */
  invalidateTokens(): void {
    this.tokensCache.clear();
  }

  /**
   * Run periodic cleanup of expired cache entries
   */
  pruneExpiredCaches(): void {
    this.marketsCache.prune();
    this.poolsCache.prune();
    this.tokensCache.prune();
    this.tokenMetadataCache.prune();
    this.platformStatsCache.prune();
    this.searchCache.prune();
    this.marketByPairCache.prune();
    this.quoteSnapshotsCache.prune();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      markets: this.marketsCache.getStats(),
      pools: this.poolsCache.getStats(),
      tokens: this.tokensCache.getStats(),
      tokenMetadata: this.tokenMetadataCache.getStats(),
      platformStats: this.platformStatsCache.getStats(),
      search: this.searchCache.getStats(),
      marketByPair: this.marketByPairCache.getStats(),
      quoteSnapshots: this.quoteSnapshotsCache.getStats()
    };
  }
}

// ============================================
// Singleton Export
// ============================================

export const indexerRepository = new IndexerRepository();

// Register with centralized cleanup manager
cacheCleanupManager.register(() => indexerRepository.pruneExpiredCaches());
