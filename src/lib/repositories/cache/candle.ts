/**
 * Candle Cache (IndexedDB L2)
 *
 * Persistent cache for OHLCV candle data.
 * Used for chart rendering and historical data.
 */

import { indexedDbClient, STORES } from './client.svelte';

// ============================================
// Types
// ============================================

export interface CandleRecord {
  id: string;
  symbol: string;
  timeframe: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  updatedAt: number;
}

export interface CandleInput extends Omit<CandleRecord, 'id' | 'updatedAt'> {}

export interface CandleQuery {
  symbol: string;
  timeframe: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

// ============================================
// Internal Helpers
// ============================================

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });

const generateCandleId = (symbol: string, timeframe: string, timestamp: number): string =>
  `${symbol}_${timeframe}_${timestamp}`;

// ============================================
// Candle Cache
// ============================================

export const candleCache = {
  /**
   * Store a single candle
   */
  async put(candle: CandleInput): Promise<void> {
    const record: CandleRecord = {
      ...candle,
      id: generateCandleId(candle.symbol, candle.timeframe, candle.timestamp),
      updatedAt: Date.now(),
    };

    return indexedDbClient.withTransaction(
      [STORES.CANDLE_DATA],
      'readwrite',
      async (tx) => {
        const store = tx.objectStore(STORES.CANDLE_DATA);
        await requestToPromise(store.put(record));
      }
    );
  },

  /**
   * Store multiple candles
   */
  async putMany(candles: CandleInput[]): Promise<void> {
    if (candles.length === 0) return;

    return indexedDbClient.withTransaction(
      [STORES.CANDLE_DATA],
      'readwrite',
      async (tx) => {
        const store = tx.objectStore(STORES.CANDLE_DATA);
        await Promise.all(
          candles.map(candle => {
            const record: CandleRecord = {
              ...candle,
              id: generateCandleId(candle.symbol, candle.timeframe, candle.timestamp),
              updatedAt: Date.now(),
            };
            return requestToPromise(store.put(record));
          })
        );
      }
    );
  },

  /**
   * Query candles by symbol and timeframe
   */
  async query(query: CandleQuery): Promise<CandleRecord[]> {
    return indexedDbClient.withTransaction(
      [STORES.CANDLE_DATA],
      'readonly',
      async (tx) => {
        const store = tx.objectStore(STORES.CANDLE_DATA);
        const index = store.index('symbol_timeframe');
        const range = IDBKeyRange.only([query.symbol, query.timeframe]);
        const results = await requestToPromise<CandleRecord[]>(index.getAll(range));

        let filtered = results;
        if (query.startTime !== undefined) {
          filtered = filtered.filter(c => c.timestamp >= query.startTime!);
        }
        if (query.endTime !== undefined) {
          filtered = filtered.filter(c => c.timestamp <= query.endTime!);
        }
        filtered.sort((a, b) => a.timestamp - b.timestamp);
        if (query.limit !== undefined) {
          filtered = filtered.slice(0, query.limit);
        }
        return filtered;
      }
    );
  },

  /**
   * Delete candles for a specific symbol/timeframe pair
   */
  async delete(symbol: string, timeframe: string): Promise<void> {
    return indexedDbClient.withTransaction(
      [STORES.CANDLE_DATA],
      'readwrite',
      async (tx) => {
        const store = tx.objectStore(STORES.CANDLE_DATA);
        const index = store.index('symbol_timeframe');
        const range = IDBKeyRange.only([symbol, timeframe]);

        await new Promise<void>((resolve, reject) => {
          const cursorRequest = index.openCursor(range);
          cursorRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            } else {
              resolve();
            }
          };
          cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error('IndexedDB cursor failed'));
        });
      }
    );
  },

  /**
   * Clear candles older than a timestamp
   */
  async clearOlderThan(timestamp: number): Promise<void> {
    return indexedDbClient.withTransaction(
      [STORES.CANDLE_DATA],
      'readwrite',
      async (tx) => {
        const store = tx.objectStore(STORES.CANDLE_DATA);
        const index = store.index('timestamp');
        const range = IDBKeyRange.upperBound(timestamp);

        await new Promise<void>((resolve, reject) => {
          const cursorRequest = index.openCursor(range);
          cursorRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            } else {
              resolve();
            }
          };
          cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error('IndexedDB cursor failed'));
        });
      }
    );
  },

  /**
   * Clear all candle data
   */
  async clear(): Promise<void> {
    return indexedDbClient.withTransaction(
      [STORES.CANDLE_DATA],
      'readwrite',
      async (tx) => {
        const store = tx.objectStore(STORES.CANDLE_DATA);
        await requestToPromise(store.clear());
      }
    );
  },
};
