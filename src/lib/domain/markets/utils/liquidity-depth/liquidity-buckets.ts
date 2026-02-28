/**
 * Liquidity Bucket Aggregation Utilities
 *
 * Functions for aggregating liquidity segments into display buckets.
 * Handles tick range calculation and bucket distribution.
 */

import { tickToPrice, MIN_TICK, MAX_TICK } from "$lib/domain/markets/utils";
import type {
  LiquidityBucket,
  LiquiditySegment,
  TickRange,
  TickRangeConfig,
  PoolDepthRow,
} from "./liquidity-depth.types";
import { buildLiquiditySegments } from "./liquidity-segments";
import { calculateAmountsLocked, calculateUsdValue } from "./liquidity-amounts";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default tick window half-width for INITIAL view.
 * ~14,000 ticks represents roughly 0.25x to 4x price range each direction.
 * Chart starts at this zoom level but users can zoom out to see full range.
 */
export const TICK_WINDOW_HALF = 14000;

/**
 * Full tick window for data loading.
 * Loads the entire valid tick range so users can zoom out to see all liquidity.
 * Uses MAX_TICK to cover the full range from -887272 to +887272.
 */
export const TICK_WINDOW_HALF_FULL = MAX_TICK;

/**
 * Default number of buckets for initial view.
 * Matches Uniswap's LiquidityBarChartModel which uses 50 bars each side.
 */
export const NUM_BUCKETS = 50;

/**
 * Number of buckets for full range view.
 * More buckets to maintain reasonable granularity across the full tick range.
 */
export const NUM_BUCKETS_FULL = 300;

// ============================================================================
// TICK RANGE CALCULATION
// ============================================================================

/**
 * Calculate tick range to display centered on current price.
 *
 * Following Uniswap's approach: use a FIXED tick window centered on current tick,
 * NOT based on where liquidity exists (which would include full-range positions).
 *
 * @param config - Configuration with currentTick and optional halfWindow
 * @returns Tick range with min and max bounds clamped to valid range
 *
 * @example
 * const range = calculateTickRange({ currentTick: 1000 });
 * // Returns { min: -13000, max: 15000 } (clamped to valid tick range)
 */
export function calculateTickRange(config: TickRangeConfig): TickRange {
  const { currentTick, halfWindow = TICK_WINDOW_HALF } = config;

  let min = currentTick - halfWindow;
  let max = currentTick + halfWindow;

  // Clamp to valid tick range
  min = Math.max(MIN_TICK, min);
  max = Math.min(MAX_TICK, max);

  return { min, max };
}

/**
 * Calculate bucket size based on tick range and number of buckets.
 *
 * @param tickRange - Min and max tick values
 * @param numBuckets - Number of buckets to create
 * @param tickSpacing - Optional tick spacing to align buckets (default: 60)
 * @returns Bucket size in ticks, aligned to tick spacing
 *
 * @example
 * const bucketSize = calculateBucketSize({ min: -14000, max: 14000 }, 50, 60);
 * // Returns 600 (28000 / 50 = 560, rounded up to 60s = 600)
 */
export function calculateBucketSize(
  tickRange: TickRange,
  numBuckets: number = NUM_BUCKETS,
  tickSpacing: number = 60
): number {
  const range = tickRange.max - tickRange.min;
  const rawSize = Math.ceil(range / numBuckets);
  // Round to nearest tick spacing multiple for cleaner buckets
  return Math.ceil(rawSize / tickSpacing) * tickSpacing;
}

// ============================================================================
// BUCKET AGGREGATION
// ============================================================================

/**
 * Configuration for bucket aggregation.
 */
export interface AggregateConfig {
  /** Tick range to aggregate over */
  tickRange: TickRange;
  /** Size of each bucket in ticks */
  bucketSize: number;
  /** Current tick for determining which bucket is "current" */
  currentTick: number;
  /** Token0 decimals for price calculation */
  baseDecimals: number;
  /** Token1 decimals for price calculation */
  quoteDecimals: number;
  /** Token0 USD price in E12 format (null if unknown) */
  basePriceUsd: bigint | null;
  /** Token1 USD price in E12 format (null if unknown) */
  quotePriceUsd: bigint | null;
}

/**
 * Aggregate liquidity segments into display buckets.
 *
 * Uses segment-based calculation: liquidity is constant between adjacent
 * initialized ticks, so we calculate amounts for each segment and distribute
 * them to the buckets that segment overlaps.
 *
 * @param pools - Array of pool depth data
 * @param config - Aggregation configuration
 * @returns Array of liquidity buckets sorted by tick descending (high price at top)
 *
 * @example
 * const buckets = aggregateIntoBuckets(pools, {
 *   tickRange: { min: -14000, max: 14000 },
 *   bucketSize: 600,
 *   currentTick: 0,
 *   baseDecimals: 8,
 *   quoteDecimals: 8,
 *   basePriceUsd: 1000000000000n, // $1.00
 *   quotePriceUsd: 1000000000000n, // $1.00
 * });
 */
export function aggregateIntoBuckets(
  pools: PoolDepthRow[],
  config: AggregateConfig
): LiquidityBucket[] {
  const {
    tickRange,
    bucketSize,
    currentTick,
    baseDecimals,
    quoteDecimals,
    basePriceUsd,
    quotePriceUsd,
  } = config;

  // Map from bucket start tick to aggregated data
  const bucketMap = new Map<number, LiquidityBucket>();

  // Initialize buckets
  const { min, max } = tickRange;
  for (let tick = min; tick <= max; tick += bucketSize) {
    const bucketCenter = tick + bucketSize / 2;
    const price = tickToPrice(bucketCenter, baseDecimals, quoteDecimals);

    bucketMap.set(tick, {
      tick: bucketCenter,
      tickLower: tick,
      tickUpper: tick + bucketSize,
      price,
      totalLiquidity: 0n,
      amountBaseLocked: 0n,
      amountQuoteLocked: 0n,
      usdValueLocked: 0,
      poolContributions: [],
      isCurrentTick: currentTick >= tick && currentTick < tick + bucketSize,
    });
  }

  // Process each pool using segment-based approach
  for (const pool of pools) {
    const segments = buildLiquiditySegments(pool);

    // For each segment (constant liquidity between adjacent initialized ticks)
    for (const segment of segments) {
      // Skip segments outside our view range
      if (segment.tickUpper <= min || segment.tickLower >= max) continue;

      // Clamp segment to view range
      const segTickLower = Math.max(segment.tickLower, min);
      const segTickUpper = Math.min(segment.tickUpper, max);

      // Find all buckets this segment overlaps
      const firstBucketStart =
        Math.floor((segTickLower - min) / bucketSize) * bucketSize + min;
      const lastBucketStart =
        Math.floor((segTickUpper - 1 - min) / bucketSize) * bucketSize + min;

      // Distribute segment's contribution across overlapping buckets
      for (
        let bucketStart = firstBucketStart;
        bucketStart <= lastBucketStart;
        bucketStart += bucketSize
      ) {
        const bucket = bucketMap.get(bucketStart);
        if (!bucket) continue;

        // Calculate the portion of this segment that falls in this bucket
        const overlapLower = Math.max(segTickLower, bucket.tickLower);
        const overlapUpper = Math.min(segTickUpper, bucket.tickUpper);

        if (overlapLower >= overlapUpper) continue;

        // Calculate amounts for the overlapping tick range
        // Use the unified currentTick (from most liquid pool) for consistent token split
        // across all pools, not pool.currentTick which varies by fee tier
        const { amountBase, amountQuote } = calculateAmountsLocked(
          overlapLower,
          overlapUpper,
          currentTick,
          segment.liquidity
        );

        bucket.totalLiquidity += segment.liquidity;
        bucket.amountBaseLocked += amountBase;
        bucket.amountQuoteLocked += amountQuote;
        bucket.usdValueLocked += calculateUsdValue(
          amountBase,
          amountQuote,
          baseDecimals,
          quoteDecimals,
          basePriceUsd,
          quotePriceUsd
        );

        // Track pool contribution
        const existing = bucket.poolContributions.find(
          (p) => p.feePips === pool.feePips
        );
        if (existing) {
          existing.liquidity += segment.liquidity;
        } else {
          bucket.poolContributions.push({
            feePips: pool.feePips,
            liquidity: segment.liquidity,
          });
        }
      }
    }
  }

  // Convert to array, keep ALL buckets (including empty) for proper positioning
  // Sort by tick descending (high price at top)
  return Array.from(bucketMap.values()).sort((a, b) => b.tick - a.tick);
}

/**
 * Get the maximum tick spacing from a list of pools.
 * Used for bucket size alignment.
 *
 * @param pools - Array of pool depth data
 * @returns Maximum tick spacing, or 60 if no pools
 *
 * @example
 * const spacing = getMaxTickSpacing(pools);
 * // Returns 60 for 0.30% fee pool, 200 for 1.00% fee pool
 */
export function getMaxTickSpacing(pools: PoolDepthRow[]): number {
  if (!pools || pools.length === 0) return 60;
  return Math.max(...pools.map((p) => Number(p.tickSpacing)));
}

/**
 * Get the current tick from pools, using the most liquid pool as reference.
 *
 * @param pools - Array of pool depth data
 * @param referenceTick - Optional override reference tick
 * @returns Current tick from most liquid pool, or 0 if no pools
 *
 * @example
 * const tick = getCurrentTickFromPools(pools);
 * // Returns tick from pool with highest liquidity
 */
export function getCurrentTickFromPools(
  pools: PoolDepthRow[],
  referenceTick?: number
): number {
  // Use reference tick if provided
  if (referenceTick !== undefined) return referenceTick;

  // Fallback: use most liquid pool
  if (!pools || pools.length === 0) return 0;

  let maxLiquidity = 0n;
  let bestTick = pools[0].currentTick;

  for (const pool of pools) {
    if (pool.liquidity > maxLiquidity) {
      maxLiquidity = pool.liquidity;
      bestTick = pool.currentTick;
    }
  }

  return bestTick;
}
