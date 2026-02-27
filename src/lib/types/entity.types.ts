/**
 * Entity Types
 *
 * Shared type definitions for normalized entities.
 * Used by both domain layer (entity-store) and repositories.
 */

import type {
  OrderView,
  TriggerView,
  PositionViewEnhanced,
} from '$lib/actors/services/spot.service';

// ============================================
// Source Types
// ============================================

export type PriceSource = 'oracle' | 'canister' | 'indexer' | 'static' | 'unknown';
export type EntitySource = 'hardcoded' | 'indexer' | 'canister' | 'discovered';

// ============================================
// Normalized Entity Types
// ============================================

/**
 * Normalized token - all required fields guaranteed
 * Optional fields are explicitly typed as `| null`
 */
export interface NormalizedToken {
  // Identity (required)
  canisterId: string;

  // Metadata (normalized with defaults)
  symbol: string;           // Default: 'UNKNOWN' - original symbol for API calls
  displaySymbol: string;    // Default: same as symbol - UI display (ck-tokens normalized: CKBTC → BTC)
  name: string;             // Default: 'Unknown Token'
  displayName: string;      // Default: same as name - UI display (ck-tokens normalized: "Chain Key USDT" → "Tether USD")
  decimals: number;         // Default: 8
  fee: bigint;              // Default: 0n
  logo: string | null;      // Explicitly nullable

  // Pricing (updated from indexer, canister, or Coinbase)
  priceUsd: bigint;         // Default: 0n (E12 - 12 decimals, per 06-Precision.md)
  priceChange24h: number;   // Default: 0 (percentage)
  priceSource: PriceSource;
  priceUpdatedAt: number;   // Timestamp ms

  // Market data (from indexer)
  volume24h: bigint;        // Default: 0n
  volume7d: bigint;         // Default: 0n
  volume30d: bigint;        // Default: 0n
  tvl: bigint;              // Default: 0n

  // Supply (lazy loaded via icrc1_total_supply)
  totalSupply: bigint | null;

  // Classification
  isQuoteToken?: boolean;

  // Market participation (from indexer — authoritative mapping)
  baseMarkets: string[];    // Spot canister IDs where this token is base (for price/change)
  quoteMarkets: string[];   // Spot canister IDs where this token is quote (for volume/TVL)

  // Metadata tracking
  source: EntitySource;
  lastUpdatedAt: number;    // Timestamp ms
}

/**
 * Normalized market (spot)
 */
export interface NormalizedMarket {
  // Identity
  canisterId: string;

  // Pair info
  symbol: string;           // e.g., "PARTY/ICP"
  baseToken: string;        // Base token canister ID
  quoteToken: string;       // Quote token canister ID (or 'ICP')

  // Current state
  lastTradeTick: number | null;
  referenceTick: number | null;  // Robust price signal: book mid > pool median > lastTradeTick
  lastTradePrice: bigint;   // USD E12 (12 decimals) — derived from referenceTick × quote USD rate

  lastTradeSqrtPriceX96: bigint | null;
  liquidity: bigint;

  // Market data
  volume24h: bigint;
  tvl: bigint;
  priceChange24h: number;

  // Fees (in pips: 100-10000, where 100 = 0.01%, 10000 = 1.00%)
  feePips: number;

  // Status
  isActive: boolean;

  // Metadata
  source: EntitySource;
  lastUpdatedAt: number;
}

/**
 * Normalized pool (LP position container)
 */
export interface NormalizedPool {
  // Identity
  poolId: string;           // Composite: `${spotCanisterId}:${feeTier}`
  spotCanisterId: string;

  // Pair info
  symbol: string;
  token0: string;
  token1: string;
  feePips: number; // Fee in pips (100-10000, where 100 = 0.01%, 10000 = 1.00%)

  // Pool state
  liquidity: bigint;
  tvl: bigint;
  volume24h: bigint;
  volume7d: bigint;
  fees24h: bigint;          // 24h fees earned (E6 precision)
  apr: number;              // Estimated APR as percentage

  // Token reserves (from spot canister's get_pool - actual pool balances)
  token0Reserve: bigint | null;  // Raw token0 amount (null = not yet fetched from spot canister)
  token1Reserve: bigint | null;  // Raw token1 amount (null = not yet fetched from spot canister)

  // Metadata
  source: EntitySource;
  lastUpdatedAt: number;
}

// ============================================
// Upsert Types (partial inputs)
// ============================================

/**
 * Partial token data for upserts
 * Only canisterId is required - everything else merges with existing/defaults
 */
export type TokenUpsert = { canisterId: string } & Partial<Omit<NormalizedToken, 'canisterId'>>;

/**
 * Partial market data for upserts
 */
export type MarketUpsert = { canisterId: string } & Partial<Omit<NormalizedMarket, 'canisterId'>>;

/**
 * Partial pool data for upserts
 */
export type PoolUpsert = { poolId: string; spotCanisterId: string } & Partial<Omit<NormalizedPool, 'poolId' | 'spotCanisterId'>>;

// ============================================
// User Market Data Types
// ============================================

/**
 * Token pair for base/quote amounts
 */
export interface TokenPairAmounts {
  base: bigint;
  quote: bigint;
}

/**
 * Locked balances breakdown by category
 */
export interface LockedBalancesBreakdown {
  orders: TokenPairAmounts;
  triggers: TokenPairAmounts;
  positions: TokenPairAmounts;
}

/**
 * Normalized user data per market (single source of truth)
 * Populated by Portfolio coordinator, derived by SpotMarket
 *
 * This is the canonical store for all user-specific data per market.
 * SpotMarket derives from this; Portfolio aggregates across all markets.
 */
export interface NormalizedUserMarketData {
  // Identity
  spotCanisterId: string;

  // Orders (max 25 per market)
  orders: OrderView[];

  // Triggers (max 10 per market)
  triggers: TriggerView[];

  // Positions (max 10 per market)
  positions: PositionViewEnhanced[];

  // Balances
  available: TokenPairAmounts;
  locked: LockedBalancesBreakdown;
  fees: TokenPairAmounts;

  // Computed aggregates (from positions, E6 precision)
  totalPositionsTvlE6: bigint;
  totalPositionsFeesE6: bigint;
  weightedAvgApy: number;

  // Timestamp
  lastUpdatedAt: number;
}

/**
 * Partial user market data for upserts
 * Only spotCanisterId is required - everything else merges with existing/defaults
 */
export type UserMarketDataUpsert =
  { spotCanisterId: string } & Partial<Omit<NormalizedUserMarketData, 'spotCanisterId'>>;
