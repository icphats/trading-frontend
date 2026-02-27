/**
 * Market Domain Types
 *
 * Core types for the market domain layer.
 */

// ============================================
// Core Market Types
// ============================================

/** Market type discriminator - spot only */
export type MarketType = 'spot';

/**
 * Defines what features a market supports
 */
export interface MarketCapabilities {
  supportsMarketOrders: boolean;
  supportsLimitOrders: boolean;
  supportsStopOrders: boolean;
  supportsTPSL: boolean;
  supportsLeverage: boolean;
  supportsShortSelling: boolean;
  hasOrderBook: boolean;
  supportsPartialFills: boolean;
  liquidityModel: 'orderbook' | 'amm' | 'concentrated_liquidity';
  hasPriceOracle: boolean;
  supportsPriceImpact: boolean;
  hasFundingRate?: boolean;
  hasExpiration?: boolean;
}

/**
 * Contract that all market types must implement.
 */
export interface BaseMarket {
  readonly canister_id: string;
  readonly token_name: string;
  readonly token_symbol: string;
  readonly assetType: MarketType;
  hydrateAll(): Promise<void>;
  getCapabilities(): MarketCapabilities;
}

/**
 * Extends BaseMarket with spot market (concentrated liquidity) functionality.
 */
export interface SpotMarket extends BaseMarket {
  assetType: 'spot';
  lastTradeTick: number | null;
  lastTradeSqrtPriceX96: bigint | null;
  liquidity: bigint;
  fee: number;
  tickSpacing: number;
  initialized: boolean;
  userPositionIds: bigint[];
  userPositions: any[];
  spotPrice: number;
  formattedPrice: string;
  estimatePriceImpact(amountIn: bigint, zeroForOne: boolean): bigint;
  getPosition(positionId: bigint): Promise<any | null>;
  getOrderBook(bucketSizeBps?: number): Promise<any>;
  isValidTick(tick: number): boolean;
  getNearestUsableTick(tick: number): number;
  formatPrice(decimals?: number): string;
  formatLiquidity(decimals?: number): string;
  getCurrentPrice(): number;
}

/** Market instance type - spot only */
export type MarketInstance = SpotMarket;

/** Market state with loading/error handling */
export type MarketState =
  | { status: 'loading' }
  | { status: 'loaded'; market: MarketInstance }
  | { status: 'empty'; message: string };

/** Common transaction structure */
export interface BaseTransaction {
  id: bigint;
  price: bigint;
  amount: bigint;
  timestamp: bigint;
}

/** Common chart/candle data structure */
export interface BaseChartData {
  ts: bigint;
  open: bigint;
  high: bigint;
  low: bigint;
  close: bigint;
  volume: bigint;
  oracle?: bigint;
}

/** Result type for error handling */
export type Result<T, E = Error> =
  | { ok: T }
  | { err: E };

// ============================================
// User Position Types (Shared)
// ============================================

/**
 * Base user position interface
 * Extended by market-specific position types
 */
export interface UserPosition {
  marketId: string;
  marketType: 'spot';
  value: bigint;
  pnl?: bigint;
}

/**
 * Spot user position (liquidity position)
 */
export interface SpotUserPosition extends UserPosition {
  marketType: 'spot';
  positionId: bigint;
  liquidity: bigint;
  tickLower: number;
  tickUpper: number;
  amount0: bigint;
  amount1: bigint;
  feesAccrued0: bigint;
  feesAccrued1: bigint;
}

// ============================================
// Market Metadata
// ============================================

/**
 * Extra metadata not available on SpotMarket itself
 * Stored separately in registry, combined with SpotMarket fields on access
 */
export interface MarketExtraMetadata {
  description?: string;
  logoUrl?: string;
  tags?: string[];
  isActive: boolean;
  createdAt?: bigint;
}

/**
 * Full market metadata for display (derived from SpotMarket + extra)
 * canisterId, type, name, symbol come from SpotMarket (source of truth)
 */
export interface MarketMetadata extends MarketExtraMetadata {
  canisterId: string;
  type: 'spot';
  name: string;
  symbol: string;
}

// ============================================
// Market Registry Types
// ============================================

/**
 * Market registry entry
 * Links canister ID to market instance
 */
export interface MarketRegistryEntry {
  canisterId: string;
  type: 'spot';
  market: MarketInstance;
  metadata: MarketMetadata;
  lastUpdated: bigint;
}

/**
 * Market filtering options
 */
export interface MarketFilter {
  type?: 'spot';
  isActive?: boolean;
  tags?: string[];
  searchTerm?: string;
}

/**
 * Market sort options
 */
export type MarketSortBy =
  | 'name'
  | 'volume'
  | 'price'
  | 'change24h'
  | 'createdAt';

export interface MarketSortOptions {
  by: MarketSortBy;
  direction: 'asc' | 'desc';
}
