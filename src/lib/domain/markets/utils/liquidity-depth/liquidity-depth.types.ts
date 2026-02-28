/**
 * Liquidity Depth Chart Types
 *
 * Type definitions for liquidity depth visualization and calculations.
 * Used by both D3 and lightweight-charts implementations.
 */

import type { PoolDepthRow } from "$lib/components/trade/shared/orderbook.utils";

// ============================================================================
// CORE DATA TYPES
// ============================================================================

/**
 * Represents a segment of constant liquidity between two adjacent initialized ticks.
 * This is the correct unit for calculating token amounts - liquidity is constant
 * within each segment, regardless of the pool's tick spacing.
 */
export interface LiquiditySegment {
  /** Lower tick bound of the segment */
  tickLower: number;
  /** Upper tick bound of the segment */
  tickUpper: number;
  /** Liquidity value constant throughout this segment */
  liquidity: bigint;
}

/**
 * Aggregated liquidity data for a tick bucket.
 * Represents combined liquidity across all pools at a specific tick range.
 */
export interface LiquidityBucket {
  /** Center tick of this bucket */
  tick: number;
  /** Lower tick bound */
  tickLower: number;
  /** Upper tick bound */
  tickUpper: number;
  /** Display price at center tick */
  price: number;
  /** Total liquidity aggregated in this bucket */
  totalLiquidity: bigint;
  /** Base token amount locked in this range */
  amountBaseLocked: bigint;
  /** Quote token amount locked in this range */
  amountQuoteLocked: bigint;
  /** Total USD value locked in this bucket */
  usdValueLocked: number;
  /** Which pools contribute to this bucket */
  poolContributions: Array<{ feePips: number; liquidity: bigint }>;
  /** Whether this bucket contains the current price */
  isCurrentTick: boolean;
}

/**
 * Lightweight-charts compatible bar data format.
 * Used for rendering liquidity depth in trading view charts.
 */
export interface LiquidityBarData {
  /** Time value for x-axis (can be tick or timestamp) */
  time: number;
  /** Price at this tick */
  price: number;
  /** USD value locked (for bar height) */
  value: number;
  /** Base token USD value portion */
  baseValue: number;
  /** Quote token USD value portion */
  quoteValue: number;
  /** Whether this is the current price bar */
  isCurrent: boolean;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Configuration for liquidity data processing.
 */
export interface LiquidityDataConfig {
  /** Base token decimals for amount formatting */
  baseDecimals: number;
  /** Quote token decimals for amount formatting */
  quoteDecimals: number;
  /** Base token USD price in E12 format (null if unknown) */
  basePriceUsd: bigint | null;
  /** Quote token USD price in E12 format (null if unknown) */
  quotePriceUsd: bigint | null;
  /** Current tick for price reference */
  currentTick: number;
  /** Number of buckets to generate */
  numBuckets?: number;
  /** Half window size in ticks (default: 14000 for ~4x price range) */
  tickWindowHalf?: number;
}

/**
 * Configuration for tick range calculation.
 */
export interface TickRangeConfig {
  /** Current tick to center the range on */
  currentTick: number;
  /** Half window size in ticks */
  halfWindow?: number;
}

/**
 * Result of tick range calculation.
 */
export interface TickRange {
  /** Minimum tick in range */
  min: number;
  /** Maximum tick in range */
  max: number;
}

// ============================================================================
// INPUT TYPES (RE-EXPORTS FOR CONVENIENCE)
// ============================================================================

export type { PoolDepthRow };
