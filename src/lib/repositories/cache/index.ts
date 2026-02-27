/**
 * Cache Layer
 *
 * Two-tier caching system:
 * - L1 (Memory): Fast session cache with TTL
 * - L2 (IndexedDB): Persistent cache across page refreshes
 *
 * Usage:
 * - Import specific caches for domain data
 * - Import MemoryCache/HybridCache for custom caching needs
 */

// IndexedDB Client
export { indexedDbClient, STORES } from './client.svelte';

// Domain Caches
export { tokenMetadataCache } from './token-metadata';
export type {
  TokenMetadataCacheRecord,
  TokenMetadataCacheInput,
} from './token-metadata';
export { isMetadataFresh, isLogoFresh, METADATA_CACHE_TTL_MS, LOGO_CACHE_TTL_MS } from './token-metadata';

// Market State Cache (L2 localStorage)
export {
  getCachedMarketState,
  setCachedMarketState,
  removeCachedMarketState,
  clearAllCachedMarketStates,
  pruneExpiredMarketStates,
} from './market-state';
export type { CachedMarketState } from './market-state';

export { candleCache } from './candle';
export type { CandleRecord, CandleInput, CandleQuery } from './candle';

export { priceArchiveCache } from './price-archive';
export type { PriceEntry, PriceArchiveRecord, PriceArchiveInput } from './price-archive';


export { ActorCache, SingletonActorCache, actorRegistry } from './actor';

// Memory/Hybrid Cache Utilities
export {
  MemoryCache,
  HybridCache,
  CachePresets,
  createCache,
  storeCandlesInIndexedDB,
  loadCandlesFromIndexedDB,
  clearOldCandles,
} from './memory';
export type { CacheEntry, CacheOptions } from './memory';
