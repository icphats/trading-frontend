/**
 * Liquidity Depth Utilities
 *
 * Shared utilities for liquidity depth visualization and calculations.
 * Used by both D3 and lightweight-charts implementations.
 *
 * @example
 * import {
 *   buildLiquiditySegments,
 *   aggregateIntoBuckets,
 *   calculateUsdValue,
 *   TICK_WINDOW_HALF,
 *   NUM_BUCKETS,
 *   type LiquidityBucket,
 *   type LiquiditySegment,
 * } from '$lib/domain/markets/utils/liquidity-depth';
 */

// Types
export type {
  LiquiditySegment,
  LiquidityBucket,
  LiquidityBarData,
  LiquidityDataConfig,
  TickRange,
  TickRangeConfig,
  PoolDepthRow,
} from "./liquidity-depth.types";

// Segment building
export {
  buildLiquiditySegments,
  buildAllPoolSegments,
  getFlatSegments,
} from "./liquidity-segments";

// Bucket aggregation
export {
  TICK_WINDOW_HALF,
  TICK_WINDOW_HALF_FULL,
  NUM_BUCKETS,
  NUM_BUCKETS_FULL,
  calculateTickRange,
  calculateBucketSize,
  aggregateIntoBuckets,
  getMaxTickSpacing,
  getCurrentTickFromPools,
  type AggregateConfig,
} from "./liquidity-buckets";

// Amount calculations
export {
  USD_DECIMALS,
  calculateAmountsLocked,
  calculateBaseUsdValue,
  calculateQuoteUsdValue,
  calculateUsdValue,
  calculateTotalAmounts,
  type TotalAmounts,
} from "./liquidity-amounts";
