/**
 * Hybrid Cache System
 *
 * Two-tier caching strategy:
 * - **L1 (Memory)**: Fast session cache with TTL (seconds to minutes)
 * - **L2 (IndexedDB)**: Persistent cache across page refreshes (hours to days)
 *
 * Cache Strategy by Data Type:
 * - Platform data (orderbook, funding): L1 only (1-5 min TTL, real-time)
 * - User data (positions, orders): L1 only (30s-2 min TTL, real-time)
 * - Transaction history: L1 only (5 min TTL, recent changes)
 * - Historical candles: L1 + L2 (L1: 5 min, L2: 24h, large datasets)
 * - Token metadata: L1 + L2 (L1: 1h, L2: ∞, static data)
 * - Market config: L1 + L2 (L1: 30 min, L2: 24h, semi-static)
 */

import { candleCache, type CandleInput } from './candle';
import { tokenMetadataCache } from './token-metadata';

// ============================================
// Cache Entry Types
// ============================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheOptions {
  /** Time-to-live in milliseconds */
  ttl: number;
  /** Use IndexedDB for persistent storage (default: false) */
  persistent?: boolean;
  /** IndexedDB store key prefix (required if persistent: true) */
  storePrefix?: string;
}

// ============================================
// In-Memory Cache (L1)
// ============================================

/**
 * Fast in-memory cache with TTL
 * Use for real-time data that doesn't need to persist across refreshes
 */
export class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  /**
   * Get cached value if not expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cache value with TTL
   */
  set(key: string, data: T, ttl: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Invalidate specific key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching prefix
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries (periodic cleanup)
   */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.cache.size,
      active,
      expired
    };
  }
}

// ============================================
// Hybrid Cache (L1 + L2)
// ============================================

/**
 * Two-tier cache combining memory and IndexedDB
 * Use for data that should persist across page refreshes
 */
export class HybridCache<T> {
  private memoryCache: MemoryCache<T>;
  private l1Ttl: number;
  private l2Ttl: number;
  private storeType: 'candles' | 'metadata' | null;

  /**
   * @param l1Ttl - L1 (memory) cache TTL in ms
   * @param l2Ttl - L2 (IndexedDB) cache TTL in ms
   * @param storeType - IndexedDB store type ('candles' or 'metadata')
   */
  constructor(l1Ttl: number, l2Ttl: number, storeType: 'candles' | 'metadata' | null = null) {
    this.memoryCache = new MemoryCache<T>();
    this.l1Ttl = l1Ttl;
    this.l2Ttl = l2Ttl;
    this.storeType = storeType;
  }

  /**
   * Get cached value (L1 → L2 → null)
   */
  async get(key: string): Promise<T | null> {
    // Try L1 (memory) first
    const memResult = this.memoryCache.get(key);
    if (memResult !== null) {
      return memResult;
    }

    // Try L2 (IndexedDB) if configured
    if (this.storeType === 'metadata') {
      const record = await tokenMetadataCache.getToken(key);
      if (record && this.isL2Fresh(record.metadataUpdatedAt)) {
        // Promote to L1
        this.memoryCache.set(key, record as unknown as T, this.l1Ttl);
        return record as unknown as T;
      }
    }

    return null;
  }

  /**
   * Set cache value (L1 + optional L2)
   */
  async set(key: string, data: T): Promise<void> {
    // Always set L1
    this.memoryCache.set(key, data, this.l1Ttl);

    // Optionally set L2 for persistent data
    if (this.storeType === 'metadata') {
      // Store token metadata in IndexedDB
      await tokenMetadataCache.setToken({
        canisterId: key,
        ...(data as any),
      });
    }
  }

  /**
   * Check if L2 (IndexedDB) entry is fresh
   */
  private isL2Fresh(timestamp: number): boolean {
    const now = Date.now();
    return now - timestamp < this.l2Ttl;
  }

  /**
   * Invalidate key from both caches
   */
  async invalidate(key: string): Promise<void> {
    this.memoryCache.invalidate(key);

    if (this.storeType === 'metadata') {
      await tokenMetadataCache.removeToken(key);
    }
  }

  /**
   * Invalidate all keys with prefix
   */
  invalidatePrefix(prefix: string): void {
    this.memoryCache.invalidatePrefix(prefix);
    // Note: IndexedDB doesn't support prefix invalidation easily
    // Individual keys need to be removed explicitly
  }

  /**
   * Clear L1 cache
   */
  clear(): void {
    this.memoryCache.clear();
  }

  /**
   * Prune expired L1 entries
   */
  prune(): void {
    this.memoryCache.prune();
  }
}

// ============================================
// Cache Factory & Presets
// ============================================

export const CachePresets = {
  /** Real-time platform data (orderbook, funding) - 1 min memory only */
  PLATFORM: { ttl: 60_000, persistent: false },

  /** User data (positions, orders) - 30s memory only */
  USER: { ttl: 30_000, persistent: false },

  /** Transaction history - 5 min memory only */
  TRANSACTIONS: { ttl: 300_000, persistent: false },

  /** Market configuration - 30 min memory + 24h IndexedDB */
  CONFIG: { ttl: 1_800_000, persistent: true, l2Ttl: 86_400_000 },

  /** Token metadata - 1h memory + ∞ IndexedDB */
  TOKEN_METADATA: { ttl: 3_600_000, persistent: true, l2Ttl: Number.POSITIVE_INFINITY },

  /** Historical candles - 5 min memory + 24h IndexedDB */
  CANDLES: { ttl: 300_000, persistent: true, l2Ttl: 86_400_000 }
};

/**
 * Create a cache instance based on preset
 */
export function createCache<T>(preset: keyof typeof CachePresets): MemoryCache<T> | HybridCache<T> {
  const config = CachePresets[preset];

  if (config.persistent && 'l2Ttl' in config) {
    const storeType = preset === 'TOKEN_METADATA' ? 'metadata' : null;
    return new HybridCache<T>(config.ttl, config.l2Ttl, storeType);
  }

  return new MemoryCache<T>();
}

// ============================================
// Candle Cache Helpers
// ============================================

/**
 * Store historical candles in IndexedDB
 */
export async function storeCandlesInIndexedDB(
  symbol: string,
  timeframe: string,
  candles: CandleInput[]
): Promise<void> {
  await candleCache.putMany(candles);
}

/**
 * Load historical candles from IndexedDB
 */
export async function loadCandlesFromIndexedDB(
  symbol: string,
  timeframe: string,
  startTime?: number,
  endTime?: number
): Promise<CandleInput[]> {
  return await candleCache.query({
    symbol,
    timeframe,
    startTime,
    endTime
  });
}

/**
 * Clear old candles from IndexedDB (cleanup)
 */
export async function clearOldCandles(olderThanMs: number): Promise<void> {
  const threshold = Date.now() - olderThanMs;
  await candleCache.clearOlderThan(threshold);
}
