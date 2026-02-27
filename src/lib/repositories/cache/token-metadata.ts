/**
 * Token Metadata Cache (IndexedDB L2)
 *
 * Persistent cache for token metadata (ICRC-1 data).
 * Used as L2 cache by tokenRepository.
 *
 * Internal storage uses different field names for historical reasons,
 * but the public API uses domain-aligned names (canisterId, symbol, logo).
 */

import { indexedDbClient, STORES } from './client.svelte';
import type { TokenMetadata } from '../token.repository';
import { CK_TOKEN_MAP, CK_DISPLAY_NAMES } from '$lib/domain/markets/quote-token.types';

// ============================================
// Public Types (domain-aligned)
// ============================================

/**
 * Cache record with domain-aligned field names
 * Extends TokenMetadata with cache-specific metadata
 */
export interface TokenMetadataCacheRecord extends TokenMetadata {
  metadataUpdatedAt: number;
  logoUpdatedAt?: number;
  tradingCanisterId?: string;
}

/**
 * Input for upserting token metadata to cache
 * Uses domain-aligned field names
 */
export interface TokenMetadataCacheInput {
  canisterId: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  fee?: bigint;
  logo?: string | null;
  tradingCanisterId?: string;
}

// Cache TTLs
export const METADATA_CACHE_TTL_MS = Number.POSITIVE_INFINITY; // Metadata (name, symbol, decimals) rarely changes
export const LOGO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days - logos can change (rebrands)

export const isMetadataFresh = (
  record: TokenMetadataCacheRecord,
  ttl: number = METADATA_CACHE_TTL_MS
): boolean => {
  if (!record.metadataUpdatedAt) return false;
  return Date.now() - record.metadataUpdatedAt < ttl;
};

export const isLogoFresh = (
  record: TokenMetadataCacheRecord,
  ttl: number = LOGO_CACHE_TTL_MS
): boolean => {
  if (!record.logoUpdatedAt) return false;
  return Date.now() - record.logoUpdatedAt < ttl;
};

// ============================================
// Internal: IndexedDB Storage Format
// ============================================

/**
 * Internal row format stored in IndexedDB
 * Uses different field names for historical/schema reasons
 */
interface TokenMetadataRow {
  ledgerCanisterId: string;  // Maps to canisterId
  name?: string;
  tokenSymbol?: string;      // Maps to symbol
  decimals?: number;
  fee?: string;              // bigint as string
  metadataUpdatedAt?: number;
  base64?: string;           // Logo data
  mimeType?: string;         // Logo mime type
  logoUpdatedAt?: number;
  tradingCanisterId?: string;
  updatedAt?: number;
}

// ============================================
// Internal: Helpers
// ============================================

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });

const parseDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return {
      mimeType: 'image/png',
      base64: dataUrl.replace(/^data:[^;]+;base64,/, ''),
    };
  }
  return {
    mimeType: match[1],
    base64: match[2],
  };
};

/**
 * Convert internal row to public cache record
 */
const rowToCacheRecord = (row: TokenMetadataRow | undefined): TokenMetadataCacheRecord | null => {
  if (!row) return null;

  const logo =
    row.base64 && row.mimeType ? `data:${row.mimeType};base64,${row.base64}` : undefined;

  const metadataUpdatedAt = row.metadataUpdatedAt ?? row.updatedAt ?? 0;

  const symbol = row.tokenSymbol ?? 'TOKEN';
  const upperSymbol = symbol.toUpperCase();
  const lowerSymbol = symbol.toLowerCase();
  const displaySymbol = lowerSymbol in CK_TOKEN_MAP ? CK_TOKEN_MAP[lowerSymbol].toUpperCase() : upperSymbol;
  const name = row.name ?? 'Unknown Token';
  const displayName = displaySymbol !== upperSymbol
    ? (CK_DISPLAY_NAMES[displaySymbol.toLowerCase()] ?? name)
    : name;

  return {
    canisterId: row.ledgerCanisterId,
    name,
    displayName,
    symbol,
    displaySymbol,
    decimals: row.decimals ?? 8,
    fee: row.fee !== undefined ? BigInt(row.fee) : 0n,
    logo,
    metadataUpdatedAt,
    logoUpdatedAt: row.logoUpdatedAt ?? row.updatedAt,
    tradingCanisterId: row.tradingCanisterId,
  };
};

/**
 * Convert public input to internal row format
 */
const cacheInputToRow = (
  existing: TokenMetadataRow | undefined,
  input: TokenMetadataCacheInput
): TokenMetadataRow => {
  const now = Date.now();
  const base: TokenMetadataRow = existing
    ? { ...existing }
    : { ledgerCanisterId: input.canisterId };

  if (input.name !== undefined) {
    base.name = input.name;
  }
  if (input.symbol !== undefined) {
    base.tokenSymbol = input.symbol;
  }
  if (input.decimals !== undefined) {
    base.decimals = input.decimals;
  }
  if (input.fee !== undefined) {
    base.fee = input.fee.toString();
  }
  if (input.tradingCanisterId !== undefined) {
    base.tradingCanisterId = input.tradingCanisterId;
  }

  if (input.logo !== undefined) {
    if (input.logo === null) {
      base.base64 = undefined;
      base.mimeType = undefined;
      base.logoUpdatedAt = now;
    } else if (input.logo) {
      const { base64, mimeType } = parseDataUrl(input.logo);
      base.base64 = base64;
      base.mimeType = mimeType;
      base.logoUpdatedAt = now;
    }
  }

  base.metadataUpdatedAt = now;
  base.updatedAt = now;
  return base;
};

// ============================================
// Token Metadata Cache
// ============================================

export const tokenMetadataCache = {
  /**
   * Get token metadata by canister ID
   */
  async getToken(canisterId: string): Promise<TokenMetadataCacheRecord | null> {
    return indexedDbClient.withTransaction(
      [STORES.TOKEN_METADATA],
      'readonly',
      async (tx) => {
        const store = tx.objectStore(STORES.TOKEN_METADATA);
        const row = await requestToPromise<TokenMetadataRow | undefined>(
          store.get(canisterId)
        );
        return rowToCacheRecord(row);
      }
    );
  },

  /**
   * Get all cached token metadata
   */
  async getAllTokens(): Promise<TokenMetadataCacheRecord[]> {
    return indexedDbClient.withTransaction(
      [STORES.TOKEN_METADATA],
      'readonly',
      async (tx) => {
        const store = tx.objectStore(STORES.TOKEN_METADATA);
        const rows = await requestToPromise<TokenMetadataRow[]>(store.getAll());
        return rows
          .map(rowToCacheRecord)
          .filter((record): record is TokenMetadataCacheRecord => record !== null);
      }
    );
  },

  /**
   * Upsert token metadata
   */
  async setToken(input: TokenMetadataCacheInput): Promise<TokenMetadataCacheRecord> {
    return indexedDbClient.withTransaction(
      [STORES.TOKEN_METADATA],
      'readwrite',
      async (tx) => {
        const store = tx.objectStore(STORES.TOKEN_METADATA);
        const existing = await requestToPromise<TokenMetadataRow | undefined>(
          store.get(input.canisterId)
        );
        const merged = cacheInputToRow(existing, input);
        await requestToPromise(store.put(merged));
        return rowToCacheRecord(merged)!;
      }
    );
  },

  /**
   * Remove token metadata by canister ID
   */
  async removeToken(canisterId: string): Promise<void> {
    return indexedDbClient.withTransaction(
      [STORES.TOKEN_METADATA],
      'readwrite',
      async (tx) => {
        const store = tx.objectStore(STORES.TOKEN_METADATA);
        await requestToPromise(store.delete(canisterId));
      }
    );
  },

  /**
   * Clear all cached token metadata
   */
  async clear(): Promise<void> {
    return indexedDbClient.withTransaction(
      [STORES.TOKEN_METADATA],
      'readwrite',
      async (tx) => {
        const store = tx.objectStore(STORES.TOKEN_METADATA);
        await requestToPromise(store.clear());
      }
    );
  },
};
