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
  convertBaseToQuote,
  convertQuoteToBase,
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
  baseAmount: bigint;
  /** Token1 equivalent amount */
  quoteAmount: bigint;
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
  // Bids: users are buying base, paying with quote
  // Amount is in quote token - what buyer is offering
  const bookBids: OrderBookRow[] = depth.book_bids.map((level) => {
    const priceE12 = BigInt(Math.floor(tickToPrice(level.tick, baseDecimals, quoteDecimals) * 1e12));
    return {
      priceE12,
      tick: level.tick,
      amount: level.amount,
      // Convert quote amount to base equivalent at reference price
      baseAmount: convertQuoteToBase(level.amount, referenceTick),
      quoteAmount: level.amount,
      orderCount: level.order_count,
    };
  });

  // Transform book asks (sell orders)
  // Asks: users are selling base, receiving quote
  // Amount is in base token - what seller is offering
  const bookAsks: OrderBookRow[] = depth.book_asks.map((level) => {
    const priceE12 = BigInt(Math.floor(tickToPrice(level.tick, baseDecimals, quoteDecimals) * 1e12));
    return {
      priceE12,
      tick: level.tick,
      amount: level.amount,
      baseAmount: level.amount,
      // Convert base amount to quote equivalent at reference price
      quoteAmount: convertBaseToQuote(level.amount, referenceTick),
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
  /** Total base amount */
  base_amount?: bigint;
  /** Total quote amount */
  quote_amount?: bigint;
  /** Book-only base amount (limit orders) - same as total now */
  book_base_amount?: bigint;
  /** Book-only quote amount (limit orders) - same as total now */
  book_quote_amount?: bigint;
  /** @deprecated AMM amounts no longer mixed in book response */
  amm_base_amount?: bigint;
  /** @deprecated AMM amounts no longer mixed in book response */
  amm_quote_amount?: bigint;
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
  // Bids = long (buy side) - amount is in quote
  const long: UnifiedOrderBookRow[] = depth.book_bids.map((row) => {
    const quoteAmount = row.amount;
    const baseAmount = convertQuoteToBase(quoteAmount, referenceTick);
    return {
      usd_price: BigInt(Math.floor(tickToPrice(row.tick, baseDecimals, quoteDecimals) * 1e12)),
      tick: row.tick,
      amount: quoteAmount,
      base_amount: baseAmount,
      quote_amount: quoteAmount,
      book_base_amount: baseAmount,
      book_quote_amount: quoteAmount,
      // AMM amounts are 0 - they're now in separate pools array
      amm_base_amount: 0n,
      amm_quote_amount: 0n,
    };
  });

  // Transform asks to legacy format
  // Asks = short (sell side) - amount is in base
  const short: UnifiedOrderBookRow[] = depth.book_asks.map((row) => {
    const baseAmount = row.amount;
    const quoteAmount = convertBaseToQuote(baseAmount, referenceTick);
    return {
      usd_price: BigInt(Math.floor(tickToPrice(row.tick, baseDecimals, quoteDecimals) * 1e12)),
      tick: row.tick,
      amount: baseAmount,
      base_amount: baseAmount,
      quote_amount: quoteAmount,
      book_base_amount: baseAmount,
      book_quote_amount: quoteAmount,
      // AMM amounts are 0 - they're now in separate pools array
      amm_base_amount: 0n,
      amm_quote_amount: 0n,
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
