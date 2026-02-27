/**
 * Token Repository
 *
 * Data access layer for ICRC token operations
 * - Manages ledger actors
 * - Implements hybrid caching (memory + IndexedDB) for metadata
 * - Provides token balance and transfer operations
 * - Provides token discovery for arbitrary canister IDs
 */

import type { Principal } from '@dfinity/principal';
import { idlFactory as ledgerIDL } from 'declarations/icrc_ledger/icrc_ledger.did.js';
import { MemoryCache, HybridCache, createCache, ActorCache, tokenMetadataCache, isLogoFresh } from './cache';
import type { TokenMetadataCacheRecord, TokenMetadataCacheInput } from './cache';
import { type Result } from './shared/result';
import { cacheCleanupManager } from './shared/cleanup';
import { TOKEN_DEFINITIONS } from '$lib/constants/token.constants';
import { CK_TOKEN_MAP, CK_DISPLAY_NAMES } from '$lib/domain/markets/quote-token.types';
import { convertLogoToDataUrl } from '$lib/utils/image.utils';
import type { _SERVICE as LedgerService, Account } from 'declarations/icrc_ledger/icrc_ledger.did';

// Re-export types for consumers
export type { Result } from './shared/result';
export type { TokenMetadataCacheRecord } from './cache';

export interface TokenMetadata {
  canisterId: string;
  name: string;
  displayName: string;
  symbol: string;
  displaySymbol: string;
  decimals: number;
  fee: bigint;
  logo?: string;
  totalSupply?: bigint;
}

/**
 * Token discovery source
 * - hardcoded: From TOKEN_DEFINITIONS (known platform tokens)
 * - discovered: Fetched from ledger canister (user-inputted or dynamic)
 */
export type TokenSource = 'hardcoded' | 'discovered';

// ============================================
// ICRC-1 Metadata Parsing
// ============================================

type MetadataValue = { Nat: bigint } | { Int: bigint } | { Text: string } | { Blob: Uint8Array | number[] };

/**
 * Compute displaySymbol and displayName from raw symbol/name
 */
function computeDisplayFields(symbol: string, name: string): { displaySymbol: string; displayName: string } {
  const upper = symbol.toUpperCase();
  const lower = symbol.toLowerCase();
  const displaySymbol = lower in CK_TOKEN_MAP ? CK_TOKEN_MAP[lower].toUpperCase() : upper;
  const displayName = displaySymbol !== upper ? (CK_DISPLAY_NAMES[displaySymbol.toLowerCase()] ?? name) : name;
  return { displaySymbol, displayName };
}

/**
 * Helper to extract value from MetadataValue variant
 */
function extractMetadataValue(value: MetadataValue | undefined): any {
  if (!value) return null;
  if ('Nat' in value) return value.Nat;
  if ('Int' in value) return value.Int;
  if ('Text' in value) return value.Text;
  if ('Blob' in value) return value.Blob;
  return null;
}

/**
 * Parse ICRC-1 metadata array into structured TokenMetadata
 */
export function parseMetadata(
  metadata: Array<[string, MetadataValue]>,
  canisterId: string
): TokenMetadata {
  const metadataMap = new Map(metadata);

  const logoValue = metadataMap.get('icrc1:logo');
  let logo: string | undefined;

  if (logoValue) {
    const extracted = extractMetadataValue(logoValue);
    if (typeof extracted === 'string') {
      logo = extracted;
    } else if (extracted instanceof Uint8Array) {
      logo = convertLogoToDataUrl(extracted);
    } else if (Array.isArray(extracted)) {
      logo = convertLogoToDataUrl(new Uint8Array(extracted));
    }
  }

  const rawDecimals = extractMetadataValue(metadataMap.get('icrc1:decimals'));
  const decimals = typeof rawDecimals === 'bigint' ? Number(rawDecimals) : (rawDecimals ?? 8);

  const symbol = extractMetadataValue(metadataMap.get('icrc1:symbol')) || 'UNKNOWN';
  const name = extractMetadataValue(metadataMap.get('icrc1:name')) || 'Unknown Token';
  const { displaySymbol, displayName } = computeDisplayFields(symbol, name);

  return {
    canisterId,
    name,
    displayName,
    symbol,
    displaySymbol,
    decimals,
    fee: extractMetadataValue(metadataMap.get('icrc1:fee')) || 0n,
    logo,
  };
}

export interface DiscoveredToken extends TokenMetadata {
  source: TokenSource;
  discoveredAt: number;
}

export interface TokenBalance {
  owner: Principal;
  balance: bigint;
  decimals: number;
  symbol: string;
}

// ============================================
// Token Repository Class
// ============================================

export class TokenRepository {
  private ledgerActors = new ActorCache<LedgerService>(ledgerIDL);

  private metadataCache: HybridCache<TokenMetadata>;
  private balanceCache: MemoryCache<bigint>;
  private totalSupplyCache: MemoryCache<bigint>;
  private feeCache: MemoryCache<bigint>;

  private static readonly BALANCE_TTL = 30_000;
  private static readonly TOTAL_SUPPLY_TTL = 5 * 60_000;
  private static readonly FEE_TTL = 60 * 60_000;

  constructor() {
    this.metadataCache = createCache<TokenMetadata>('TOKEN_METADATA') as HybridCache<TokenMetadata>;
    this.balanceCache = new MemoryCache<bigint>();
    this.totalSupplyCache = new MemoryCache<bigint>();
    this.feeCache = new MemoryCache<bigint>();
  }

  // ============================================
  // Actor Management (Internal)
  // ============================================

  private getActor(canisterId: string): LedgerService {
    return this.ledgerActors.get(canisterId);
  }

  // ============================================
  // Fee Resolution (single source of truth)
  // ============================================

  private async getEffectiveFee(canisterId: string, fallback: bigint = 0n): Promise<bigint> {
    const cached = this.feeCache.get(canisterId);
    if (cached !== null) return cached;

    try {
      const actor = this.getActor(canisterId);
      const fee = await actor.icrc1_fee();
      this.feeCache.set(canisterId, fee, TokenRepository.FEE_TTL);
      return fee;
    } catch {
      return fallback;
    }
  }

  // ============================================
  // Token Metadata Operations
  // ============================================

  async fetchTokenMetadata(
    canisterId: string,
    useCache: boolean = true
  ): Promise<Result<TokenMetadata>> {
    const cacheKey = canisterId;

    if (useCache) {
      const cached = await this.metadataCache.get(cacheKey);
      if (cached) {
        const fee = await this.getEffectiveFee(canisterId, cached.fee);
        return { ok: { ...cached, fee } };
      }
    }

    try {
      const actor = this.getActor(canisterId);

      const [name, symbol, rawDecimals, fee] = await Promise.all([
        actor.icrc1_name(),
        actor.icrc1_symbol(),
        actor.icrc1_decimals(),
        actor.icrc1_fee()
      ]);

      const decimals = Number(rawDecimals);

      this.feeCache.set(canisterId, fee, TokenRepository.FEE_TTL);

      const { displaySymbol, displayName } = computeDisplayFields(symbol, name);

      const metadata: TokenMetadata = {
        canisterId,
        name,
        displayName,
        symbol,
        displaySymbol,
        decimals,
        fee
      };

      await this.metadataCache.set(cacheKey, metadata);

      return { ok: metadata };
    } catch (error) {
      console.error(`Failed to fetch token metadata for ${canisterId}:`, error);
      return { err: error instanceof Error ? error.message : 'Failed to fetch metadata' };
    }
  }

  async fetchTotalSupply(canisterId: string, useCache: boolean = true): Promise<Result<bigint>> {
    if (useCache) {
      const cached = this.totalSupplyCache.get(canisterId);
      if (cached !== null) {
        return { ok: cached };
      }
    }

    try {
      const actor = this.getActor(canisterId);
      const supply = await actor.icrc1_total_supply();
      this.totalSupplyCache.set(canisterId, supply, TokenRepository.TOTAL_SUPPLY_TTL);
      return { ok: supply };
    } catch (error) {
      console.error(`Failed to fetch total supply for ${canisterId}:`, error);
      return { err: error instanceof Error ? error.message : 'Failed to fetch total supply' };
    }
  }

  // ============================================
  // Token Discovery
  // ============================================

  async discoverToken(
    canisterId: string,
    useCache: boolean = true
  ): Promise<Result<DiscoveredToken>> {
    const hardcodedDef = TOKEN_DEFINITIONS.find(def => def.canisterId === canisterId);
    if (hardcodedDef) {
      const { displaySymbol, displayName } = computeDisplayFields(hardcodedDef.symbol, hardcodedDef.name);
      const fee = await this.getEffectiveFee(canisterId, hardcodedDef.initialFee ?? 0n);

      return {
        ok: {
          canisterId: hardcodedDef.canisterId,
          name: hardcodedDef.name,
          displayName,
          symbol: hardcodedDef.symbol,
          displaySymbol,
          decimals: hardcodedDef.decimals,
          fee,
          logo: hardcodedDef.logo ?? undefined,
          source: 'hardcoded',
          discoveredAt: 0,
        }
      };
    }

    if (useCache) {
      const memCached = await this.metadataCache.get(canisterId);
      if (memCached) {
        const fee = await this.getEffectiveFee(canisterId, memCached.fee);
        return {
          ok: {
            ...memCached,
            fee,
            source: 'discovered',
            discoveredAt: Date.now(),
          }
        };
      }

      const dbCached = await tokenMetadataCache.getToken(canisterId);
      if (dbCached) {
        const fee = await this.getEffectiveFee(canisterId, dbCached.fee);
        const discovered: DiscoveredToken = {
          canisterId: dbCached.canisterId,
          name: dbCached.name,
          displayName: dbCached.displayName,
          symbol: dbCached.symbol,
          displaySymbol: dbCached.displaySymbol,
          decimals: dbCached.decimals,
          fee,
          logo: dbCached.logo ?? undefined,
          source: 'discovered',
          discoveredAt: dbCached.metadataUpdatedAt,
        };

        await this.metadataCache.set(canisterId, discovered);

        return { ok: discovered };
      }
    }

    try {
      const actor = this.getActor(canisterId);
      const rawMetadata = await actor.icrc1_metadata();

      const parsed = parseMetadata(rawMetadata, canisterId);
      const now = Date.now();

      this.feeCache.set(canisterId, parsed.fee, TokenRepository.FEE_TTL);

      const discovered: DiscoveredToken = {
        canisterId,
        name: parsed.name,
        displayName: parsed.displayName,
        symbol: parsed.symbol,
        displaySymbol: parsed.displaySymbol,
        decimals: parsed.decimals,
        fee: parsed.fee,
        logo: parsed.logo,
        source: 'discovered',
        discoveredAt: now,
      };

      await this.metadataCache.set(canisterId, discovered);

      await tokenMetadataCache.setToken({
        canisterId,
        name: parsed.name,
        symbol: parsed.symbol,
        decimals: parsed.decimals,
        fee: parsed.fee,
        logo: parsed.logo ?? null,
      });

      return { ok: discovered };
    } catch (error) {
      console.error(`Failed to discover token ${canisterId}:`, error);
      return {
        err: error instanceof Error
          ? error.message
          : 'Failed to discover token. Ensure the canister ID is a valid ICRC-1 ledger.'
      };
    }
  }

  // ============================================
  // Balance Operations
  // ============================================

  async fetchBalance(
    canisterId: string,
    owner: Principal,
    subaccount?: Uint8Array,
    useCache: boolean = true
  ): Promise<Result<bigint>> {
    const cacheKey = `${canisterId}:${owner.toString()}:${subaccount ? Buffer.from(subaccount).toString('hex') : 'default'}`;

    if (useCache) {
      const cached = this.balanceCache.get(cacheKey);
      if (cached !== null) {
        return { ok: cached };
      }
    }

    try {
      const actor = this.getActor(canisterId);

      const account: Account = {
        owner,
        subaccount: subaccount ? [subaccount] : []
      };

      const balance = await actor.icrc1_balance_of(account);

      this.balanceCache.set(cacheKey, balance, TokenRepository.BALANCE_TTL);
      return { ok: balance };
    } catch (error) {
      console.error(`Failed to fetch balance for ${canisterId}:`, error);
      return { err: error instanceof Error ? error.message : 'Failed to fetch balance' };
    }
  }

  async fetchBalanceWithMetadata(
    canisterId: string,
    owner: Principal,
    subaccount?: Uint8Array,
    useCache: boolean = true
  ): Promise<Result<TokenBalance>> {
    try {
      const [balanceResult, metadataResult] = await Promise.all([
        this.fetchBalance(canisterId, owner, subaccount, useCache),
        this.fetchTokenMetadata(canisterId, useCache)
      ]);

      if ('err' in balanceResult) {
        return { err: balanceResult.err };
      }

      if ('err' in metadataResult) {
        return { err: metadataResult.err };
      }

      return {
        ok: {
          owner,
          balance: balanceResult.ok,
          decimals: metadataResult.ok.decimals,
          symbol: metadataResult.ok.symbol
        }
      };
    } catch (error) {
      console.error(`Failed to fetch balance with metadata for ${canisterId}:`, error);
      return { err: error instanceof Error ? error.message : 'Failed to fetch balance with metadata' };
    }
  }

  // ============================================
  // Transfer Operations
  // ============================================

  async transfer(
    canisterId: string,
    to: Principal,
    amount: bigint,
    fromSubaccount?: Uint8Array,
    toSubaccount?: Uint8Array,
    memo?: Uint8Array,
    createdAtTime?: bigint
  ): Promise<Result<bigint>> {
    try {
      const actor = this.getActor(canisterId);

      const metadata = await this.fetchTokenMetadata(canisterId, true);
      if ('err' in metadata) {
        return { err: metadata.err };
      }

      const toAccount: Account = {
        owner: to,
        subaccount: toSubaccount ? [toSubaccount] : []
      };

      let fee = metadata.ok.fee;

      const result = await actor.icrc1_transfer({
        to: toAccount,
        amount,
        memo: memo ? [memo] : [],
        fee: [fee],
        from_subaccount: fromSubaccount ? [fromSubaccount] : [],
        created_at_time: createdAtTime ? [createdAtTime] : []
      });

      if ('Ok' in result) {
        this.balanceCache.invalidatePrefix(`${canisterId}:`);
        return { ok: result.Ok };
      } else if ('Err' in result) {
        if ('BadFee' in result.Err) {
          const correctFee = result.Err.BadFee.expected_fee;
          this.feeCache.set(canisterId, correctFee, TokenRepository.FEE_TTL);
          fee = correctFee;

          const retryResult = await actor.icrc1_transfer({
            to: toAccount,
            amount,
            memo: memo ? [memo] : [],
            fee: [fee],
            from_subaccount: fromSubaccount ? [fromSubaccount] : [],
            created_at_time: createdAtTime ? [createdAtTime] : []
          });
          if ('Ok' in retryResult) {
            this.balanceCache.invalidatePrefix(`${canisterId}:`);
            return { ok: retryResult.Ok };
          } else if ('Err' in retryResult) {
            return { err: JSON.stringify(retryResult.Err, (_, v) => typeof v === 'bigint' ? v.toString() : v) };
          }
        }
        return { err: JSON.stringify(result.Err, (_, v) => typeof v === 'bigint' ? v.toString() : v) };
      }

      return { err: 'Unknown transfer result' };
    } catch (error) {
      console.error(`Failed to transfer tokens for ${canisterId}:`, error);
      return { err: error instanceof Error ? error.message : 'Failed to transfer tokens' };
    }
  }

  // ============================================
  // Approval Operations (ICRC-2)
  // ============================================

  async approve(
    canisterId: string,
    spender: Principal,
    amount: bigint,
    fromSubaccount?: Uint8Array,
    spenderSubaccount?: Uint8Array,
    expiresAt?: bigint,
    expectedAllowance?: bigint
  ): Promise<Result<bigint>> {
    try {
      const actor = this.getActor(canisterId);

      const metadata = await this.fetchTokenMetadata(canisterId, true);
      if ('err' in metadata) {
        return { err: metadata.err };
      }

      const spenderAccount: Account = {
        owner: spender,
        subaccount: spenderSubaccount ? [spenderSubaccount] : []
      };

      let fee = metadata.ok.fee;

      const result = await actor.icrc2_approve({
        spender: spenderAccount,
        amount,
        expires_at: expiresAt ? [expiresAt] : [],
        expected_allowance: expectedAllowance ? [expectedAllowance] : [],
        memo: [],
        fee: [fee],
        from_subaccount: fromSubaccount ? [fromSubaccount] : [],
        created_at_time: []
      });

      if ('Ok' in result) {
        return { ok: result.Ok };
      } else if ('Err' in result) {
        if ('BadFee' in result.Err) {
          const correctFee = result.Err.BadFee.expected_fee;
          this.feeCache.set(canisterId, correctFee, TokenRepository.FEE_TTL);
          fee = correctFee;

          const retryResult = await actor.icrc2_approve({
            spender: spenderAccount,
            amount,
            expires_at: expiresAt ? [expiresAt] : [],
            expected_allowance: expectedAllowance ? [expectedAllowance] : [],
            memo: [],
            fee: [fee],
            from_subaccount: fromSubaccount ? [fromSubaccount] : [],
            created_at_time: []
          });
          if ('Ok' in retryResult) {
            return { ok: retryResult.Ok };
          } else if ('Err' in retryResult) {
            return { err: JSON.stringify(retryResult.Err, (_, v) => typeof v === 'bigint' ? v.toString() : v) };
          }
        }
        return { err: JSON.stringify(result.Err, (_, v) => typeof v === 'bigint' ? v.toString() : v) };
      }

      return { err: 'Unknown approval result' };
    } catch (error) {
      console.error(`Failed to approve spender for ${canisterId}:`, error);
      return { err: error instanceof Error ? error.message : 'Failed to approve spender' };
    }
  }

  async getAllowance(
    canisterId: string,
    owner: Principal,
    spender: Principal,
    ownerSubaccount?: Uint8Array,
    spenderSubaccount?: Uint8Array
  ): Promise<Result<{ allowance: bigint; expires_at?: bigint }>> {
    try {
      const actor = this.getActor(canisterId);

      const account: Account = {
        owner,
        subaccount: ownerSubaccount ? [ownerSubaccount] : []
      };

      const spenderAccount: Account = {
        owner: spender,
        subaccount: spenderSubaccount ? [spenderSubaccount] : []
      };

      const result = await actor.icrc2_allowance({ account, spender: spenderAccount });

      return {
        ok: {
          allowance: result.allowance,
          expires_at: result.expires_at && result.expires_at.length > 0 ? result.expires_at[0] : undefined
        }
      };
    } catch (error) {
      console.error(`Failed to get allowance for ${canisterId}:`, error);
      return { err: error instanceof Error ? error.message : 'Failed to get allowance' };
    }
  }

  // ============================================
  // Cache Management
  // ============================================

  async invalidateMetadata(canisterId: string): Promise<void> {
    await this.metadataCache.invalidate(canisterId);
  }

  invalidateBalances(canisterId: string): void {
    this.balanceCache.invalidatePrefix(`${canisterId}:`);
  }

  invalidateTotalSupply(canisterId: string): void {
    this.totalSupplyCache.invalidate(canisterId);
  }

  clearAllCaches(): void {
    this.metadataCache.clear();
    this.balanceCache.clear();
    this.totalSupplyCache.clear();
  }

  clearActorCache(): void {
    this.ledgerActors.clear();
  }

  pruneExpiredCaches(): void {
    this.metadataCache.prune();
    this.balanceCache.prune();
    this.totalSupplyCache.prune();
  }

  getCacheStats() {
    return {
      balance: this.balanceCache.getStats(),
      totalSupply: this.totalSupplyCache.getStats(),
    };
  }

  // ============================================
  // Logo Cache Operations (for token-logo service)
  // ============================================

  async getAllCachedTokens(): Promise<TokenMetadataCacheRecord[]> {
    return tokenMetadataCache.getAllTokens();
  }

  async getCachedToken(canisterId: string): Promise<TokenMetadataCacheRecord | null> {
    return tokenMetadataCache.getToken(canisterId);
  }

  async cacheTokenMetadata(input: TokenMetadataCacheInput): Promise<void> {
    await tokenMetadataCache.setToken(input);
  }

  async removeCachedToken(canisterId: string): Promise<void> {
    await tokenMetadataCache.removeToken(canisterId);
  }

  isLogoFresh(record: TokenMetadataCacheRecord): boolean {
    return isLogoFresh(record);
  }
}

// ============================================
// Singleton Export
// ============================================

export const tokenRepository = new TokenRepository();

// Register with centralized cleanup manager
cacheCleanupManager.register(() => tokenRepository.pruneExpiredCaches());
