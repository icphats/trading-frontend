/**
 * Oracle Repository
 *
 * Data access layer for the Oracle canister's price archive.
 * Uses IndexedDB as persistent cache — immutable price history survives
 * page refreshes indefinitely. Only fetches gaps from the canister.
 *
 * Purpose: USD conversion for charts, snapshots, and archival display.
 */

import { api } from '$lib/actors/api.svelte';
import { priceArchiveCache, type PriceEntry } from './cache';
import type { Result } from './shared/result';

// Re-export for consumers
export type { PriceEntry };

// ============================================
// Oracle Repository Class
// ============================================

export class OracleRepository {

  /**
   * Get price archive for a token in a time range.
   *
   * Strategy:
   * 1. Check IndexedDB for the latest cached timestamp
   * 2. Fetch only the gap (after latest cached) from the canister
   * 3. Merge into IndexedDB, return the requested range
   *
   * @param tokenSymbol - Token symbol (e.g., "ICP", "BTC")
   * @param fromMs - Start timestamp in milliseconds
   * @param toMs - End timestamp in milliseconds
   * @returns Sorted array of [timestamp_ms, price_e12] tuples
   */
  async fetchPriceArchive(
    tokenSymbol: string,
    fromMs: bigint,
    toMs: bigint,
    stepMs: bigint = 60_000n
  ): Promise<Result<PriceEntry[]>> {
    const symbol = tokenSymbol.toLowerCase();

    // Check what we already have cached
    const latestCached = await priceArchiveCache.getLatestTimestamp(symbol);

    // Fetch only the gap from the canister
    const fetchFromMs = latestCached !== null && BigInt(latestCached) >= fromMs
      ? BigInt(latestCached) + 1n
      : fromMs;

    if (fetchFromMs <= toMs) {
      const actor = api.oracle;
      if (actor) {
        try {
          const rawResult = await actor.get_price_archive(tokenSymbol, fetchFromMs, toMs, stepMs);
          const result = rawResult.length > 0 && rawResult[0] !== undefined ? rawResult[0] : null;

          if (result !== null && result.data.length > 0) {
            await priceArchiveCache.putMany(
              result.data.map(entry => ({
                symbol,
                timestamp: entry.timestamp,
                price_e12: entry.price_e12,
              }))
            );
          }
        } catch (error) {
          // If fetch fails, return whatever is cached
          console.warn(`[OracleRepository] Failed to fetch archive for ${symbol}:`, error);
        }
      }
    }

    // Return the requested range from cache
    try {
      const entries = await priceArchiveCache.query(symbol, Number(fromMs), Number(toMs));
      return { ok: entries };
    } catch (error) {
      return { err: error instanceof Error ? error.message : 'Failed to read price archive cache' };
    }
  }

  // ============================================
  // Cache Management
  // ============================================

  async invalidateToken(tokenSymbol: string): Promise<void> {
    await priceArchiveCache.deleteSymbol(tokenSymbol.toLowerCase());
  }

  async clear(): Promise<void> {
    await priceArchiveCache.clear();
  }
}

// ============================================
// Singleton Export
// ============================================

export const oracleRepository = new OracleRepository();
