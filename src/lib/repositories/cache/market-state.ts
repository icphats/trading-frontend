/**
 * Market State Cache (L2 - localStorage)
 *
 * Lightweight persistent cache for market state.
 * Enables instant UI rendering on page load with last known values.
 *
 * Uses localStorage instead of IndexedDB because:
 * 1. Market state is small (< 1KB per market)
 * 2. Synchronous access for instant UI
 * 3. No schema migrations needed
 * 4. Simple serialization (JSON)
 *
 * This follows the "optimistic UI" pattern:
 * 1. Show cached state immediately
 * 2. Fetch fresh data in background
 * 3. Update UI when fresh data arrives
 */

const STORAGE_KEY_PREFIX = 'market_state:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================
// Types
// ============================================

export interface CachedMarketState {
  canisterId: string;
  quoteTokenSymbol: 'icp' | 'usdc' | 'usdt';
  lastTradeTick: number | null;
  lastTradeSqrtPriceX96: string | null; // bigint as string, null if uninitialized
  liquidity: string; // bigint as string
  volume24h: string; // bigint as string
  priceChange24h: number;
  base: {
    canisterId: string;
    symbol: string;
    decimals: number;
  } | null;
  quote: {
    canisterId: string;
    symbol: string;
    decimals: number;
  } | null;
  updatedAt: number;
}

// ============================================
// Cache Operations
// ============================================

/**
 * Get cached market state
 * Returns null if not found or expired
 */
export function getCachedMarketState(
  canisterId: string,
  quoteTokenSymbol: 'icp' | 'usdc' | 'usdt' = 'icp'
): CachedMarketState | null {
  if (typeof window === 'undefined') return null;

  try {
    const key = `${STORAGE_KEY_PREFIX}${canisterId}:${quoteTokenSymbol}`;
    const stored = localStorage.getItem(key);

    if (!stored) return null;

    const state: CachedMarketState = JSON.parse(stored);

    // Check TTL
    if (Date.now() - state.updatedAt > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }

    return state;
  } catch (error) {
    console.warn('[MarketStateCache] Failed to read cache:', error);
    return null;
  }
}

/**
 * Cache market state
 */
export function setCachedMarketState(state: CachedMarketState): void {
  if (typeof window === 'undefined') return;

  try {
    const key = `${STORAGE_KEY_PREFIX}${state.canisterId}:${state.quoteTokenSymbol}`;
    localStorage.setItem(key, JSON.stringify({
      ...state,
      updatedAt: Date.now(),
    }));
  } catch (error) {
    console.warn('[MarketStateCache] Failed to write cache:', error);
  }
}

/**
 * Remove cached market state
 */
export function removeCachedMarketState(
  canisterId: string,
  quoteTokenSymbol: 'icp' | 'usdc' | 'usdt' = 'icp'
): void {
  if (typeof window === 'undefined') return;

  try {
    const key = `${STORAGE_KEY_PREFIX}${canisterId}:${quoteTokenSymbol}`;
    localStorage.removeItem(key);
  } catch (error) {
    // Ignore
  }
}

/**
 * Clear all cached market states
 */
export function clearAllCachedMarketStates(): void {
  if (typeof window === 'undefined') return;

  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('[MarketStateCache] Failed to clear cache:', error);
  }
}

/**
 * Prune expired market states
 */
export function pruneExpiredMarketStates(): void {
  if (typeof window === 'undefined') return;

  try {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const state: CachedMarketState = JSON.parse(stored);
            if (now - state.updatedAt > CACHE_TTL_MS) {
              keysToRemove.push(key);
            }
          }
        } catch {
          // Invalid JSON, remove it
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));

    if (keysToRemove.length > 0) {
    }
  } catch (error) {
    console.warn('[MarketStateCache] Failed to prune cache:', error);
  }
}
