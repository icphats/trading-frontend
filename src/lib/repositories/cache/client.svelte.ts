/**
 * IndexedDB Client
 *
 * Low-level IndexedDB connection manager for repository caching.
 * Handles database initialization, schema migrations, and transactions.
 */

const DB_NAME = 'trading_cache';
const DB_VERSION = 7;

export const STORES = {
  TOKEN_METADATA: 'token_metadata',
  CANDLE_DATA: 'candle_data',
  USER_PREFERENCES: 'user_preferences',
  PRICE_ARCHIVE: 'price_archive',
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

class IndexedDbClient {
  private db: IDBDatabase | null = null;

  public isInitialized = $state(false);
  public isInitializing = $state(false);
  public error = $state<string | null>(null);

  /**
   * Ensure a database connection is available before running operations.
   */
  async ensureDatabase(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    if (typeof window === 'undefined' || !window.indexedDB) {
      throw new Error('IndexedDB is not available in this environment');
    }

    if (!this.isInitialized && !this.isInitializing) {
      await this.initialize();
    } else if (this.isInitializing) {
      await this.waitForInitialization();
    }

    if (!this.db) {
      throw new Error('IndexedDB failed to initialize');
    }

    return this.db;
  }

  /**
   * Run a callback inside a transaction and await completion.
   */
  async withTransaction<T>(
    stores: StoreName[],
    mode: IDBTransactionMode,
    callback: (tx: IDBTransaction) => Promise<T> | T
  ): Promise<T> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(stores, mode);

    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    });

    try {
      const result = await callback(transaction);
      await done;
      return result;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // ignore abort errors
      }
      await done.catch(() => {
        /* swallow to avoid masking original error */
      });
      throw error;
    }
  }

  /**
   * Close the current database connection.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) {
      return;
    }

    this.isInitializing = true;
    this.error = null;

    try {
      this.db = await this.openDatabase();
      this.isInitialized = true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Failed to initialize IndexedDB';
      console.error('[IndexedDB] Initialization failed:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  private waitForInitialization(): Promise<void> {
    return new Promise((resolve, reject) => {
      const check = () => {
        if (this.isInitialized) {
          resolve();
        } else if (this.error) {
          reject(new Error(this.error));
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        console.warn('[IndexedDB] Upgrade blocked. Close other tabs using the app.');
      };
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = (event as IDBVersionChangeEvent).oldVersion;

        // Migration from version 3 to 4: Fix keyPath
        if (oldVersion < 4 && db.objectStoreNames.contains(STORES.TOKEN_METADATA)) {
          console.warn('[IndexedDB] Migrating to v4: Clearing token metadata cache due to schema change');
          db.deleteObjectStore(STORES.TOKEN_METADATA);
        }

        if (!db.objectStoreNames.contains(STORES.TOKEN_METADATA)) {
          const tokenStore = db.createObjectStore(STORES.TOKEN_METADATA, {
            keyPath: 'ledgerCanisterId', // Internal storage key
          });
          tokenStore.createIndex('tokenSymbol', 'tokenSymbol', { unique: false });
          tokenStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.CANDLE_DATA)) {
          const candleStore = db.createObjectStore(STORES.CANDLE_DATA, {
            keyPath: 'id',
          });
          candleStore.createIndex('symbol', 'symbol', { unique: false });
          candleStore.createIndex('timeframe', 'timeframe', { unique: false });
          candleStore.createIndex('timestamp', 'timestamp', { unique: false });
          candleStore.createIndex('symbol_timeframe', ['symbol', 'timeframe'], { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.USER_PREFERENCES)) {
          const prefsStore = db.createObjectStore(STORES.USER_PREFERENCES, {
            keyPath: 'key',
          });
          prefsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // v7: Price archive store (immutable oracle price history)
        // One record per symbol, entries stored as sorted [timestamp, price] tuples
        if (!db.objectStoreNames.contains(STORES.PRICE_ARCHIVE)) {
          db.createObjectStore(STORES.PRICE_ARCHIVE, { keyPath: 'symbol' });
        }

        // Migration v6: Remove allowance cache (now always queries ledger)
        if (db.objectStoreNames.contains('allowance_cache')) {
          db.deleteObjectStore('allowance_cache');
        }
      };
    });
  }
}

export const indexedDbClient = new IndexedDbClient();
