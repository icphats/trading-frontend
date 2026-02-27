/**
 * Liquidity Segment Building Utilities
 *
 * Functions for building liquidity segments from pool data.
 * A segment represents a tick range with constant liquidity.
 */

import type { LiquiditySegment, PoolDepthRow } from "./liquidity-depth.types";

/**
 * Build liquidity segments between adjacent initialized ticks for a single pool.
 *
 * Key insight: tick spacing only affects WHERE positions can have boundaries,
 * but liquidity is constant between any two adjacent initialized ticks.
 * A 0.01% pool (tickSpacing=1) and 0.30% pool (tickSpacing=60) with the same
 * liquidity should show the same amounts if they cover the same tick range.
 *
 * @param pool - Pool depth data with initialized ticks
 * @returns Array of liquidity segments sorted by tick
 *
 * @example
 * const segments = buildLiquiditySegments(pool);
 * // Returns segments like:
 * // [
 * //   { tickLower: -1000, tickUpper: 0, liquidity: 1000000n },
 * //   { tickLower: 0, tickUpper: 500, liquidity: 2000000n },
 * // ]
 */
export function buildLiquiditySegments(pool: PoolDepthRow): LiquiditySegment[] {
  const segments: LiquiditySegment[] = [];

  if (!pool.initializedTicks || pool.initializedTicks.length === 0) {
    return segments;
  }

  // Sort ticks ascending
  const sortedTicks = [...pool.initializedTicks].sort(
    (a, b) => a.tick - b.tick
  );

  // Find where current tick falls to anchor our liquidity calculation
  const currentTickIndex = sortedTicks.findIndex(
    (t) => t.tick > pool.currentTick
  );
  const anchorIndex =
    currentTickIndex === -1 ? sortedTicks.length : currentTickIndex;

  // Build segments by walking through adjacent tick pairs
  // Liquidity between tick[i] and tick[i+1] is constant

  // Walk down from anchor to calculate liquidity for lower segments
  const lowerLiquidities: bigint[] = [];
  let tempLiq = pool.liquidity;
  for (let i = anchorIndex - 1; i >= 0; i--) {
    lowerLiquidities.unshift(tempLiq);
    tempLiq -= sortedTicks[i].liquidityNet;
  }

  // Walk up from anchor to calculate liquidity for upper segments
  const upperLiquidities: bigint[] = [];
  tempLiq = pool.liquidity;
  for (let i = anchorIndex; i < sortedTicks.length; i++) {
    tempLiq += sortedTicks[i].liquidityNet;
    upperLiquidities.push(tempLiq);
  }

  // Create segments between adjacent initialized ticks
  for (let i = 0; i < sortedTicks.length - 1; i++) {
    const tickLower = sortedTicks[i].tick;
    const tickUpper = sortedTicks[i + 1].tick;

    // Determine liquidity for this segment
    let segmentLiquidity: bigint;
    if (i < anchorIndex - 1) {
      // Below current tick
      segmentLiquidity = lowerLiquidities[i + 1] ?? 0n;
    } else if (i === anchorIndex - 1) {
      // Segment containing current tick (from below)
      segmentLiquidity = pool.liquidity;
    } else {
      // Above current tick
      segmentLiquidity = upperLiquidities[i - anchorIndex] ?? 0n;
    }

    if (segmentLiquidity > 0n) {
      segments.push({
        tickLower,
        tickUpper,
        liquidity: segmentLiquidity,
      });
    }
  }

  return segments;
}

/**
 * Build liquidity segments for all pools.
 *
 * @param pools - Array of pool depth data
 * @returns Map from pool fee pips to array of segments
 *
 * @example
 * const allSegments = buildAllPoolSegments(pools);
 * // Returns Map like:
 * // Map {
 * //   3000 => [{ tickLower: -1000, tickUpper: 0, liquidity: 1000000n }, ...],
 * //   10000 => [{ tickLower: -500, tickUpper: 500, liquidity: 500000n }, ...],
 * // }
 */
export function buildAllPoolSegments(
  pools: PoolDepthRow[]
): Map<number, LiquiditySegment[]> {
  const result = new Map<number, LiquiditySegment[]>();

  for (const pool of pools) {
    const segments = buildLiquiditySegments(pool);
    result.set(pool.feePips, segments);
  }

  return result;
}

/**
 * Get all segments from all pools as a flat array with pool metadata.
 *
 * @param pools - Array of pool depth data
 * @returns Array of segments with pool fee pips attached
 *
 * @example
 * const flatSegments = getFlatSegments(pools);
 * // Returns array like:
 * // [
 * //   { tickLower: -1000, tickUpper: 0, liquidity: 1000000n, feePips: 3000, poolCurrentTick: 100 },
 * //   ...
 * // ]
 */
export function getFlatSegments(
  pools: PoolDepthRow[]
): Array<LiquiditySegment & { feePips: number; poolCurrentTick: number }> {
  const result: Array<
    LiquiditySegment & { feePips: number; poolCurrentTick: number }
  > = [];

  for (const pool of pools) {
    const segments = buildLiquiditySegments(pool);
    for (const segment of segments) {
      result.push({
        ...segment,
        feePips: pool.feePips,
        poolCurrentTick: pool.currentTick,
      });
    }
  }

  return result;
}
