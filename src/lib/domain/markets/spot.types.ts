/**
 * Spot Market Type Definitions
 *
 * Re-exports from Candid declarations and frontend-specific types
 * for spot (concentrated liquidity AMM) markets.
 */

import type {
  Liquidity,
  PositionId,
  Tick,
  SqrtPriceX96,
  ChartInterval,
  SpotTransactionResponse,
  PositionView,
  PositionViewEnhanced,
  SpotCandle,
  CandleData,
  PlatformData,
  PollVersions,
  HydrateResponse,
  Side,
  MarketDepthResponse,
  BookLevelAggregated,
  PoolDepthData,
  TickLiquidityData,
  SpotMarketService,
} from '$lib/actors/services/spot.service';

// ============================================================================
// SPOT - Re-exports from Candid (via service layer)
// ============================================================================

export type {
  Liquidity as SpotLiquidity,
  PositionId as SpotPositionId,
  Tick as SpotTick,
  SqrtPriceX96 as SpotSqrtPriceX96,
  SpotTransactionResponse,
  PositionView as SpotPositionView,
  PositionViewEnhanced as SpotPositionViewEnhanced,
  SpotCandle,
  CandleData as SpotCandleData,
  ChartInterval as SpotChartInterval,
  PlatformData as SpotPlatformData,
  PollVersions as SpotPollVersions,
  HydrateResponse as SpotHydrateResponse,
  Side as SpotSide,
  MarketDepthResponse as SpotMarketDepthResponse,
  BookLevelAggregated as SpotBookLevelAggregated,
  PoolDepthData as SpotPoolDepthData,
  TickLiquidityData as SpotTickLiquidityData,
  SpotMarketService,
};

// ============================================================================
// SPOT - Frontend-Specific Types (formerly in namespace)
// ============================================================================

/**
 * Parameters for adding liquidity to a new position
 */
export interface SpotAddLiquidityParams {
  tickLower: Tick;
  tickUpper: Tick;
  amountBaseDesired: bigint;
  amountQuoteDesired: bigint;
  initialTick?: Tick;
}

/**
 * Parameters for increasing liquidity in an existing position
 */
export interface SpotIncreaseLiquidityParams {
  positionId: PositionId;
  amountBaseDesired: bigint;
  amountQuoteDesired: bigint;
}

/**
 * Parameters for decreasing liquidity from a position
 */
export interface SpotDecreaseLiquidityParams {
  positionId: PositionId;
  liquidityDelta: bigint;
}

/**
 * Parameters for swap operations
 */
export interface SpotSwapParams {
  zeroForOne: boolean;
  amountSpecified: bigint;
  sqrtPriceLimitX96: bigint;
}

/**
 * Parameters for quote swap (preview) operations
 */
export interface SpotQuoteSwapParams {
  zeroForOne: boolean;
  amountSpecified: bigint;
  sqrtPriceLimitX96?: bigint;
}

/**
 * Swap result
 */
export interface SpotSwapResult {
  amountBase: bigint;
  amountQuote: bigint;
}

/**
 * Order book query parameters
 */
export interface SpotOrderBookParams {
  bucketSizeBps: number;
}

/**
 * Position collected fees result
 */
export interface SpotCollectedFees {
  baseAmount: bigint;
  quoteAmount: bigint;
}

/**
 * Liquidity quote result
 */
export interface SpotLiquidityQuote {
  liquidity: bigint;
}

/**
 * Amounts quote result
 */
export interface SpotAmountsQuote {
  amountBase: bigint;
  amountQuote: bigint;
}

/**
 * Processed spot transaction for UI display
 */
export interface SpotTransaction {
  tick: bigint;
  timestamp: bigint;
  amountBase: bigint;
  amountQuote: bigint;
  quoteUsdRate: bigint;
  side: 'buy' | 'sell';
}

/**
 * Order side for spot swaps
 */
export type SpotOrderSide = 'Buy' | 'Sell';

/**
 * Order type
 */
export type SpotOrderType = 'market' | 'limit' | 'tpsl';

/**
 * Spot order form validation result
 */
export interface SpotOrderFormValidation {
  valid: boolean;
  error?: string;
}

/**
 * Swap quote result with UI-friendly data
 */
export interface SpotSwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  priceImpact: number;
  minimumReceived: bigint;
  executionPrice: number;
  formattedAmountIn: string;
  formattedAmountOut: string;
  formattedMinimumReceived: string;
}

/**
 * Swap execution parameters
 */
export interface SpotSwapExecutionParams {
  side: SpotOrderSide;
  amountIn: bigint;
  minimumAmountOut: bigint;
  slippageTolerance: number;
}

/**
 * Parameters for chart data query
 */
export interface SpotChartParams {
  interval: ChartInterval;
  startTime?: bigint;
  limit: bigint;
}

/**
 * Parameters for hydrate_all (initial page load)
 */
export interface SpotHydrateAllParams {
  interval: ChartInterval;
  limit: bigint;
}
