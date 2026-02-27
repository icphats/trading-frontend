/**
 * Price Archive Cache (IndexedDB)
 *
 * Persistent cache for oracle price archive data (USD conversion for charts/display).
 * One IndexedDB record per symbol. Entries stored as a sorted array
 * of [timestamp_ms, price_e12] tuples for minimal overhead.
 *
 * Age-based compaction on each write keeps the cache bounded:
 *   < 24h  → keep all (1m resolution)
 *   < 7d   → one per 15m
 *   < 30d  → one per 1h
 *   >= 30d → one per 1d
 */

import { indexedDbClient, STORES } from './client.svelte';

// ============================================
// Types
// ============================================

/** [timestamp_ms, price_e12] — both stored as numbers (price_e12 fits in Number.MAX_SAFE_INTEGER for realistic USD prices) */
export type PriceEntry = [number, number];

/** One record per symbol in IndexedDB */
export interface PriceArchiveRecord {
  /** Token symbol (keyPath), e.g. "icp" */
  symbol: string;
  /** Sorted array of [timestamp_ms, price_e12] tuples */
  entries: PriceEntry[];
}

export interface PriceArchiveInput {
  symbol: string;
  timestamp: bigint;
  price_e12: bigint;
}

// ============================================
// Internal Helpers
// ============================================

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });

/** Binary search for first index where timestamp >= target */
function lowerBound(entries: PriceEntry[], target: number): number {
  let lo = 0;
  let hi = entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (entries[mid][0] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ============================================
// Compaction
// ============================================

const MS_24H  =      24 * 60 * 60_000; //  1 day
const MS_7D   =  7 * 24 * 60 * 60_000; //  7 days
const MS_30D  = 30 * 24 * 60 * 60_000; // 30 days

const STEP_15M =      15 * 60_000;
const STEP_1H  =      60 * 60_000;
const STEP_1D  = 24 * 60 * 60_000;

/** Returns the step size for an entry based on its age relative to `now`. */
function stepForAge(age: number): number {
  if (age < MS_24H) return 0;        // keep all
  if (age < MS_7D)  return STEP_15M;
  if (age < MS_30D) return STEP_1H;
  return STEP_1D;
}

/**
 * Single-pass compaction: downsample old entries by age tier.
 * Entries must be sorted by timestamp ascending.
 */
function compact(entries: PriceEntry[], now: number): PriceEntry[] {
  if (entries.length === 0) return entries;

  const result: PriceEntry[] = [];
  let nextBucket = 0;

  for (const entry of entries) {
    const age = now - entry[0];
    const step = stepForAge(age);

    if (step === 0 || entry[0] >= nextBucket) {
      result.push(entry);
      if (step > 0) nextBucket = entry[0] + step;
    }
  }

  return result;
}

// ============================================
// Price Archive Cache
// ============================================

export const priceArchiveCache = {
  /**
   * Merge new price entries into the cache for a symbol.
   * Deduplicates by timestamp, maintains sorted order.
   */
  async putMany(inputs: PriceArchiveInput[]): Promise<void> {
    if (inputs.length === 0) return;

    const symbol = inputs[0].symbol;

    return indexedDbClient.withTransaction(
      [STORES.PRICE_ARCHIVE],
      'readwrite',
      async (tx) => {
        const store = tx.objectStore(STORES.PRICE_ARCHIVE);

        // Load existing record
        const existing = await requestToPromise<PriceArchiveRecord | undefined>(store.get(symbol));
        const entries = existing?.entries ?? [];

        // Build a set of existing timestamps for dedup
        const existingTs = new Set(entries.map(e => e[0]));

        // Append only new entries
        let added = false;
        for (const input of inputs) {
          const ts = Number(input.timestamp);
          if (!existingTs.has(ts)) {
            entries.push([ts, Number(input.price_e12)]);
            added = true;
          }
        }

        if (added) {
          entries.sort((a, b) => a[0] - b[0]);
          const compacted = compact(entries, Date.now());
          await requestToPromise(store.put({ symbol, entries: compacted }));
        }
      }
    );
  },

  /**
   * Query prices by symbol and optional time range.
   * Returns slice of sorted [timestamp, price_e12] tuples.
   */
  async query(symbol: string, startTime?: number, endTime?: number): Promise<PriceEntry[]> {
    return indexedDbClient.withTransaction(
      [STORES.PRICE_ARCHIVE],
      'readonly',
      async (tx) => {
        const store = tx.objectStore(STORES.PRICE_ARCHIVE);
        const record = await requestToPromise<PriceArchiveRecord | undefined>(store.get(symbol));
        if (!record) return [];

        const entries = record.entries;
        const from = startTime !== undefined ? lowerBound(entries, startTime) : 0;
        const to = endTime !== undefined ? lowerBound(entries, endTime + 1) : entries.length;

        return entries.slice(from, to);
      }
    );
  },

  /**
   * Get the latest cached timestamp for a symbol.
   * Used to determine what range still needs fetching.
   */
  async getLatestTimestamp(symbol: string): Promise<number | null> {
    return indexedDbClient.withTransaction(
      [STORES.PRICE_ARCHIVE],
      'readonly',
      async (tx) => {
        const store = tx.objectStore(STORES.PRICE_ARCHIVE);
        const record = await requestToPromise<PriceArchiveRecord | undefined>(store.get(symbol));
        if (!record || record.entries.length === 0) return null;
        return record.entries[record.entries.length - 1][0];
      }
    );
  },

  /**
   * Clear all price archive data for a symbol
   */
  async deleteSymbol(symbol: string): Promise<void> {
    return indexedDbClient.withTransaction(
      [STORES.PRICE_ARCHIVE],
      'readwrite',
      async (tx) => {
        const store = tx.objectStore(STORES.PRICE_ARCHIVE);
        await requestToPromise(store.delete(symbol));
      }
    );
  },

  /**
   * Clear all price archive data
   */
  async clear(): Promise<void> {
    return indexedDbClient.withTransaction(
      [STORES.PRICE_ARCHIVE],
      'readwrite',
      async (tx) => {
        const store = tx.objectStore(STORES.PRICE_ARCHIVE);
        await requestToPromise(store.clear());
      }
    );
  },
};
