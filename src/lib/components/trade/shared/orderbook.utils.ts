/**
 * Order Book Utilities
 * Data transformation for Spot market depth (separated book + pool liquidity)
 */

import type {
  MarketDepthResponse,
  BookLevelAggregated,
  PoolDepthData,
  SqrtPriceX96,
} from "$lib/actors/services/spot.service";
import {
  tickToPrice,
  convertToken0ToToken1,
  convertToken1ToToken0,
  sqrtPriceX96ToTick,
  sqrtPriceX96ToPriceE12,
} from "$lib/domain/markets/utils";

/**
 * Order book row format for display
 * Represents a single aggregated price level from the limit order book
 */
export interface OrderBookRow {
  /** Price in E12 format (12 decimal precision) */
  priceE12: bigint;
  /** Tick for precise price display */
  tick: number;
  /** Total amount at this level (in native token for that side) */
  amount: bigint;
  /** Token0 equivalent amount */
  token0Amount: bigint;
  /** Token1 equivalent amount */
  token1Amount: bigint;
  /** Number of orders aggregated at this level */
  orderCount: bigint;
}

/**
 * Pool depth data for visualization
 * Represents liquidity available in AMM pools
 */
export interface PoolDepthRow {
  /** Fee tier in pips (100 = 0.01%, 3000 = 0.30%) */
  feePips: number;
  /** Current tick of this pool */
  currentTick: number;
  /** Current price (sqrt format) */
  sqrtPriceX96: bigint;
  /** Active liquidity at current tick */
  liquidity: bigint;
  /** Tick spacing for this pool */
  tickSpacing: bigint;
  /** Sparse tick data for depth curve visualization */
  initializedTicks: Array<{
    tick: number;
    liquidityNet: bigint;
    liquidityGross: bigint;
  }>;
}

/**
 * Market depth response transformed for frontend display
 * Keeps book and pool data completely separate for proper UX
 */
export interface TransformedMarketDepth {
  /** Bid levels (buy orders) - sorted by price descending */
  bookBids: OrderBookRow[];
  /** Ask levels (sell orders) - sorted by price ascending */
  bookAsks: OrderBookRow[];
  /** Pool depth data for each fee tier */
  pools: PoolDepthRow[];
  /** Reference tick for conversions */
  referenceTick: number;
  /** Reference price in E12 format */
  referencePriceE12: bigint;
  /** Version for cache invalidation */
  version: bigint;
}

/**
 * Transform MarketDepthResponse from backend to frontend display format
 *
 * Key changes from old unified book:
 * - Book bids/asks are ONLY limit orders (no AMM mixed in)
 * - Pool depth is provided separately for depth curve visualization
 * - No more "crossed book" UX problem
 *
 * @param depth - Backend MarketDepthResponse
 * @returns Transformed market depth for display
 */
export function transformMarketDepth(
  depth: MarketDepthResponse,
  baseDecimals: number = 8,
  quoteDecimals: number = 8,
): TransformedMarketDepth {
  // Handle uninitialized market (fresh market with no price established yet)
  if (depth.last_trade_sqrt_price_x96 === 0n) {
    return {
      bookBids: [],
      bookAsks: [],
      pools: [],
      referenceTick: 0,
      referencePriceE12: 0n,
      version: depth.version,
    };
  }

  // Convert sqrt_price to tick for amount conversions (V3 math needs tick)
  const referenceTick = sqrtPriceX96ToTick(depth.last_trade_sqrt_price_x96);
  // Convert sqrt_price to E12 for exact display price (no floating-point loss)
  const referencePriceE12 = sqrtPriceX96ToPriceE12(depth.last_trade_sqrt_price_x96, baseDecimals, quoteDecimals);

  // Transform book bids (buy orders) - backend provides aggregated levels
  // Bids: users are buying token0, paying with token1 (quote)
  // Amount is in quote token (token1) - what buyer is offering
  const bookBids: OrderBookRow[] = depth.book_bids.map((level) => {
    const priceE12 = BigInt(Math.floor(tickToPrice(level.tick, baseDecimals, quoteDecimals) * 1e12));
    return {
      priceE12,
      tick: level.tick,
      amount: level.amount,
      // Convert quote amount to token0 equivalent at reference price
      token0Amount: convertToken1ToToken0(level.amount, referenceTick),
      token1Amount: level.amount,
      orderCount: level.order_count,
    };
  });

  // Transform book asks (sell orders)
  // Asks: users are selling token0, receiving token1 (quote)
  // Amount is in base token (token0) - what seller is offering
  const bookAsks: OrderBookRow[] = depth.book_asks.map((level) => {
    const priceE12 = BigInt(Math.floor(tickToPrice(level.tick, baseDecimals, quoteDecimals) * 1e12));
    return {
      priceE12,
      tick: level.tick,
      amount: level.amount,
      token0Amount: level.amount,
      // Convert token0 amount to quote equivalent at reference price
      token1Amount: convertToken0ToToken1(level.amount, referenceTick),
      orderCount: level.order_count,
    };
  });

  // Transform pool depth data
  const pools: PoolDepthRow[] = depth.pools.map((pool) => ({
    feePips: pool.fee_pips,
    currentTick: pool.current_tick,
    sqrtPriceX96: pool.sqrt_price_x96,
    liquidity: pool.liquidity,
    tickSpacing: pool.tick_spacing,
    initializedTicks: pool.initialized_ticks.map((t) => ({
      tick: t.tick,
      liquidityNet: t.liquidity_net,
      liquidityGross: t.liquidity_gross,
    })),
  }));

  return {
    bookBids,
    bookAsks,
    pools,
    referenceTick,
    referencePriceE12,
    version: depth.version,
  };
}

/**
 * Calculate cumulative depth for display
 * @param rows - Order book rows (bids or asks)
 * @param maxLevels - Maximum number of levels to include
 * @returns Rows with cumulative amounts
 */
export function calculateCumulativeDepth(
  rows: OrderBookRow[],
  maxLevels: number = 20
): Array<OrderBookRow & { cumulativeAmount: bigint; depthPercent: number }> {
  const limited = rows.slice(0, maxLevels);

  // Calculate total for percentage calculation
  const totalAmount = limited.reduce((sum, row) => sum + row.amount, 0n);

  let cumulative = 0n;
  return limited.map((row) => {
    cumulative += row.amount;
    return {
      ...row,
      cumulativeAmount: cumulative,
      depthPercent: totalAmount > 0n ? Number((row.amount * 100n) / totalAmount) : 0,
    };
  });
}

// ============================================================================
// LEGACY SUPPORT - Deprecated types for gradual migration
// ============================================================================

/**
 * @deprecated Use OrderBookRow instead
 * Legacy unified order book row format - preserved for component migration
 */
export interface UnifiedOrderBookRow {
  /** Price in USD (tick-based) */
  usd_price: bigint;
  /** Tick for precise price display */
  tick?: number;
  /** Amount/Liquidity (displayed amount - book only now) */
  amount: bigint;
  /** Total token0 amount */
  token0_amount?: bigint;
  /** Total token1 amount */
  token1_amount?: bigint;
  /** Book-only token0 amount (limit orders) - same as total now */
  book_token0_amount?: bigint;
  /** Book-only token1 amount (limit orders) - same as total now */
  book_token1_amount?: bigint;
  /** @deprecated AMM amounts no longer mixed in book response */
  amm_token0_amount?: bigint;
  /** @deprecated AMM amounts no longer mixed in book response */
  amm_token1_amount?: bigint;
}

/**
 * @deprecated Use TransformedMarketDepth instead
 * Legacy unified order book response format - preserved for component migration
 */
export interface UnifiedOrderBookResponse {
  long: UnifiedOrderBookRow[];
  short: UnifiedOrderBookRow[];
  midTick?: number;
  referencePriceE12: bigint;
  bookAsk?: number;
  bookBid?: number;
}

/**
 * @deprecated Use transformMarketDepth instead
 * Transform MarketDepthResponse to legacy UnifiedOrderBookResponse format
 * This enables gradual migration of components
 */
export function transformMarketDepthToLegacy(
  depth: MarketDepthResponse,
  baseDecimals: number = 8,
  quoteDecimals: number = 8,
): UnifiedOrderBookResponse {
  // Handle uninitialized market
  if (depth.last_trade_sqrt_price_x96 === 0n) {
    return {
      long: [],
      short: [],
      midTick: undefined,
      referencePriceE12: 0n,
      bookAsk: undefined,
      bookBid: undefined,
    };
  }

  const referenceTick = sqrtPriceX96ToTick(depth.last_trade_sqrt_price_x96);
  const referencePriceE12 = sqrtPriceX96ToPriceE12(depth.last_trade_sqrt_price_x96, baseDecimals, quoteDecimals);

  // Transform bids to legacy format
  // Bids = long (buy side) - amount is in token1 (quote)
  const long: UnifiedOrderBookRow[] = depth.book_bids.map((row) => {
    const token1Amount = row.amount;
    const token0Amount = convertToken1ToToken0(token1Amount, referenceTick);
    return {
      usd_price: BigInt(Math.floor(tickToPrice(row.tick, baseDecimals, quoteDecimals) * 1e12)),
      tick: row.tick,
      amount: token1Amount,
      token0_amount: token0Amount,
      token1_amount: token1Amount,
      book_token0_amount: token0Amount,
      book_token1_amount: token1Amount,
      // AMM amounts are 0 - they're now in separate pools array
      amm_token0_amount: 0n,
      amm_token1_amount: 0n,
    };
  });

  // Transform asks to legacy format
  // Asks = short (sell side) - amount is in token0 (base)
  const short: UnifiedOrderBookRow[] = depth.book_asks.map((row) => {
    const token0Amount = row.amount;
    const token1Amount = convertToken0ToToken1(token0Amount, referenceTick);
    return {
      usd_price: BigInt(Math.floor(tickToPrice(row.tick, baseDecimals, quoteDecimals) * 1e12)),
      tick: row.tick,
      amount: token0Amount,
      token0_amount: token0Amount,
      token1_amount: token1Amount,
      book_token0_amount: token0Amount,
      book_token1_amount: token1Amount,
      // AMM amounts are 0 - they're now in separate pools array
      amm_token0_amount: 0n,
      amm_token1_amount: 0n,
    };
  });

  // Find best bid/ask from book levels
  const bookBid = long.length > 0 ? long[0].tick : undefined;
  const bookAsk = short.length > 0 ? short[0].tick : undefined;

  return {
    long,
    short,
    midTick: referenceTick,
    referencePriceE12,
    bookBid,
    bookAsk,
  };
}
