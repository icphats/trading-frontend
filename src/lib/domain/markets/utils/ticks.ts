/**
 * Spot Market Tick Utilities
 *
 * Tick alignment, validation, and range helpers for Uniswap V3 pool tiers
 * Ensures ticks are properly aligned to pool tier tick spacing
 */

import type { SpotTick } from '../spot.types';
import { MIN_TICK, MAX_TICK, tickToPrice } from './math';

type Tick = SpotTick;

// ============================================================================
// FULL RANGE BOUNDS DETECTION
// ============================================================================

/**
 * Threshold for considering a tick as "full range" bound
 * Ticks within this many ticks of MIN/MAX are considered at the bounds
 */
export const FULL_RANGE_THRESHOLD = 1000;

/**
 * Check if a tick is at or near the minimum bound (full range lower)
 */
export function isMinTick(tick: number): boolean {
    return tick <= MIN_TICK + FULL_RANGE_THRESHOLD;
}

/**
 * Check if a tick is at or near the maximum bound (full range upper)
 */
export function isMaxTick(tick: number): boolean {
    return tick >= MAX_TICK - FULL_RANGE_THRESHOLD;
}

/**
 * Check if ticks represent a full range position
 */
export function isFullRange(tickLower: number, tickUpper: number): boolean {
    return isMinTick(tickLower) && isMaxTick(tickUpper);
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * v4 Tick Spacing Formula: fee_bps === 1 ? 1 : fee_bps * 2
 *
 * Examples:
 * - 1 bps (0.01%)  → spacing 1
 * - 5 bps (0.05%)  → spacing 10
 * - 30 bps (0.30%) → spacing 60
 * - 31 bps (0.31%) → spacing 62
 * - 50 bps (0.50%) → spacing 100
 * - 100 bps (1.00%) → spacing 200
 */

/**
 * Maximum usable ticks for each tick spacing (aligned to tick spacing)
 * These are the closest aligned ticks that fit within [MIN_TICK, MAX_TICK]
 *
 * CRITICAL: For full-range positions, use these bounds instead of MIN_TICK/MAX_TICK
 * to ensure ticks are properly aligned to the tick spacing.
 */
export const SPACING_TICK_BOUNDS = {
    1: {       // Used by 1 bps (0.01%)
        min: MIN_TICK,      // -887272 (spacing 1, no rounding needed)
        max: MAX_TICK,      // 887272
        spacing: 1
    },
    10: {      // Used by 5 bps (0.05%)
        min: -887270,       // ceil(-887272 / 10) * 10 = -88727 * 10
        max: 887270,        // floor(887272 / 10) * 10 = 88727 * 10
        spacing: 10
    },
    60: {      // Used by 30 bps (0.30%)
        min: -887220,       // ceil(-887272 / 60) * 60 = -14787 * 60
        max: 887220,        // floor(887272 / 60) * 60 = 14787 * 60
        spacing: 60
    },
    200: {     // Used by 100 bps (1.00%)
        min: -887200,       // ceil(-887272 / 200) * 200 = -4436 * 200
        max: 887200,        // floor(887272 / 200) * 200 = 4436 * 200
        spacing: 200
    }
} as const;


// ============================================================================
// TICK SPACING HELPERS
// ============================================================================

/**
 * Pips per tick constant (1 tick = 0.01% = 100 pips)
 */
const PIPS_PER_TICK = 100;

/**
 * Get tick spacing for a fee tier (in pips)
 *
 * CRITICAL: Must match backend calculation in pools.mo:calculate_tick_spacing()
 * Backend formula: tick_spacing = (fee_pips / PIPS_PER_TICK) * 2, minimum 1
 *
 * @param feePips - Fee in pips (100-10000, where 100 = 0.01%, 10000 = 1.00%)
 * @returns Tick spacing for the fee tier
 *
 * @example
 * getTickSpacingForTier(100)   // 2   (0.01% fee → spacing 2)
 * getTickSpacingForTier(500)   // 10  (0.05% fee → spacing 10)
 * getTickSpacingForTier(3000)  // 60  (0.30% fee → spacing 60)
 * getTickSpacingForTier(10000) // 200 (1.00% fee → spacing 200)
 */
export function getTickSpacingForTier(feePips: number): number {
    // Match backend logic exactly: pools.mo:calculate_tick_spacing()
    const feeInTicks = Math.floor(feePips / PIPS_PER_TICK);
    if (feeInTicks <= 1) {
        return 1; // Minimum tick spacing is 1
    }
    return feeInTicks * 2;
}

/**
 * Get tick bounds for a given tick spacing
 * Returns spacing-specific min/max ticks that are properly aligned
 *
 * @param tickSpacing - Tick spacing (1, 10, 60, or 200)
 * @returns Object with min and max ticks for this spacing
 *
 * @example
 * getTickBoundsForSpacing(60) // { min: -887220, max: 887220 }
 */
export function getTickBoundsForSpacing(tickSpacing: number): { min: Tick; max: Tick } {
    // Check if we have pre-defined bounds for this spacing
    if (tickSpacing in SPACING_TICK_BOUNDS) {
        const bounds = SPACING_TICK_BOUNDS[tickSpacing as keyof typeof SPACING_TICK_BOUNDS];
        return { min: bounds.min, max: bounds.max };
    }

    // Fallback: calculate aligned bounds for custom tick spacing
    const alignedMin = Math.ceil(MIN_TICK / tickSpacing) * tickSpacing;
    const alignedMax = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
    return { min: alignedMin, max: alignedMax };
}

/**
 * Align tick to pool tier's tick spacing
 * CRITICAL: Ticks must be aligned or add_liquidity will fail with assertion error
 * Uses tier-specific bounds to ensure aligned ticks never exceed valid range
 *
 * @param tick - Raw tick value
 * @param tickSpacing - Tick spacing (1, 10, 60, or 200)
 * @param roundUp - If true, round up; if false, round down
 * @returns Aligned tick that satisfies tick % tickSpacing === 0
 *
 * @example
 * // For tier_030 (spacing 60):
 * alignTickToSpacing(-887272, 60, false) // -887220 (rounded down, within tier bounds)
 * alignTickToSpacing(887272, 60, true)   // 887220 (rounded up, within tier bounds)
 */
export function alignTickToSpacing(tick: Tick, tickSpacing: number, roundUp: boolean = false): Tick {
    const division = tick / tickSpacing;
    const rounded = roundUp ? Math.ceil(division) : Math.floor(division);
    const aligned = rounded * tickSpacing;

    // Get tier-specific bounds to ensure aligned tick is valid
    const bounds = getTickBoundsForSpacing(tickSpacing);

    // Clamp to tier-specific bounds (which are already aligned to tickSpacing)
    return Math.max(bounds.min, Math.min(bounds.max, aligned));
}

/**
 * Round tick to nearest valid tick based on tick spacing
 *
 * @param tick - Raw tick
 * @param tickSpacing - Tick spacing (e.g., 60 for 0.3% fee tier)
 * @returns Rounded tick
 */
export function getNearestUsableTick(tick: Tick, tickSpacing: number): Tick {
    const rounded = Math.round(tick / tickSpacing) * tickSpacing;
    return Math.max(MIN_TICK, Math.min(MAX_TICK, rounded));
}

/**
 * Check if tick is valid for given tick spacing
 *
 * @param tick - Tick to check
 * @param tickSpacing - Tick spacing
 * @returns true if valid
 */
export function isTickValid(tick: Tick, tickSpacing: number): boolean {
    return tick >= MIN_TICK && tick <= MAX_TICK && tick % tickSpacing === 0;
}

/**
 * Align both tick boundaries for a liquidity position
 * Ensures lower tick rounds down and upper tick rounds up to maintain desired range
 * Respects tier-specific tick bounds to prevent exceeding valid range
 *
 * @param tickLower - Raw lower tick
 * @param tickUpper - Raw upper tick
 * @param tickSpacing - Tick spacing for the pool tier
 * @returns Aligned [tickLower, tickUpper] within tier-specific bounds
 *
 * @example
 * // For tier_030 (spacing 60):
 * alignTickBoundaries(-887272, 887272, 60) // [-887220, 887220]
 */
export function alignTickBoundaries(
    tickLower: Tick,
    tickUpper: Tick,
    tickSpacing: number
): [Tick, Tick] {
    return [
        alignTickToSpacing(tickLower, tickSpacing, false), // Round down for lower bound
        alignTickToSpacing(tickUpper, tickSpacing, true)   // Round up for upper bound
    ];
}

/**
 * Validate and align ticks for a fee tier before calling add_liquidity
 *
 * @param tickLower - Raw lower tick
 * @param tickUpper - Raw upper tick
 * @param feePips - Fee in pips (100-10000, where 100 = 0.01%, 10000 = 1.00%)
 * @returns Validation result with aligned ticks or error
 *
 * @example
 * const result = validateAndAlignTicks(-887272, 887272, 3000); // 0.30% fee
 * if (result.valid) {
 *   const [lower, upper] = result.alignedTicks!;
 *   // Use aligned ticks for add_liquidity call
 * }
 */
export function validateAndAlignTicks(
    tickLower: Tick,
    tickUpper: Tick,
    feePips: number
): { valid: boolean; error?: string; alignedTicks?: [Tick, Tick] } {
    // Get tick spacing for this fee tier
    const tickSpacing = getTickSpacingForTier(feePips);

    // Check basic tick range validity
    if (tickLower < MIN_TICK || tickLower > MAX_TICK) {
        return { valid: false, error: `Lower tick ${tickLower} out of valid range [${MIN_TICK}, ${MAX_TICK}]` };
    }
    if (tickUpper < MIN_TICK || tickUpper > MAX_TICK) {
        return { valid: false, error: `Upper tick ${tickUpper} out of valid range [${MIN_TICK}, ${MAX_TICK}]` };
    }
    if (tickLower >= tickUpper) {
        return { valid: false, error: 'Lower tick must be less than upper tick' };
    }

    // Align ticks to spacing
    const [alignedLower, alignedUpper] = alignTickBoundaries(tickLower, tickUpper, tickSpacing);

    // Final validation
    if (alignedLower >= alignedUpper) {
        return { valid: false, error: 'Aligned ticks resulted in invalid range (lower >= upper)' };
    }

    return { valid: true, alignedTicks: [alignedLower, alignedUpper] };
}

// ============================================================================
// RANGE CALCULATION HELPERS
// ============================================================================

/**
 * Get full range ticks (min and max) for a given tick spacing
 * Respects tick spacing constraints
 *
 * @param tickSpacing - Tick spacing for the pool (default: 60)
 * @returns [minTick, maxTick] tuple aligned to tick spacing
 */
export function getFullRangeTicks(tickSpacing: number = 60): [number, number] {
    const bounds = getTickBoundsForSpacing(tickSpacing);
    return [bounds.min, bounds.max];
}

/**
 * Calculate tick range for a percentage around current price
 *
 * @param currentTick - Current pool tick
 * @param percentRange - Percentage range (e.g., 10 for ±10%)
 * @param tickSpacing - Tick spacing for the pool (default: 60)
 * @returns [tickLower, tickUpper] tuple
 *
 * @example
 * getPercentRangeTicks(0, 10, 60) // Returns ticks for ±10% around tick 0
 */
export function getPercentRangeTicks(
    currentTick: number,
    percentRange: number,
    tickSpacing: number = 60
): [number, number] {
    // Convert percentage to tick delta
    // For ±10%, we want price range of 0.9x to 1.1x
    // log(1.1) / log(1.0001) ≈ 953 ticks
    const priceFactor = 1 + percentRange / 100;
    const tickDelta = Math.log(priceFactor) / Math.log(1.0001);

    const tickLower = Math.floor((currentTick - tickDelta) / tickSpacing) * tickSpacing;
    const tickUpper = Math.ceil((currentTick + tickDelta) / tickSpacing) * tickSpacing;

    return [
        Math.max(MIN_TICK, tickLower),
        Math.min(MAX_TICK, tickUpper)
    ];
}

/**
 * Get nearest valid tick (aligned to spacing)
 * Alias for getNearestUsableTick for backward compatibility
 *
 * @param tick - Raw tick
 * @param tickSpacing - Tick spacing (default: 60)
 * @returns Rounded tick aligned to spacing
 */
export function getNearestValidTick(tick: number, tickSpacing: number = 60): number {
    return getNearestUsableTick(tick, tickSpacing);
}

/**
 * Validate tick is within bounds and aligned to spacing
 *
 * @param tick - Tick to validate
 * @param tickSpacing - Tick spacing (default: 60)
 * @returns true if tick is valid
 */
export function isValidTick(tick: number, tickSpacing: number = 60): boolean {
    return isTickValid(tick, tickSpacing);
}

/**
 * Calculate price impact of a tick range as percentages from current price
 *
 * @param tickLower - Lower tick bound
 * @param tickUpper - Upper tick bound
 * @param currentTick - Current pool tick
 * @param baseDecimals - Decimals of base token (default: 8)
 * @param quoteDecimals - Decimals of quote token (default: 8)
 * @returns Object with lowerPercent and upperPercent (can be negative)
 */
export function getPriceRangePercent(
    tickLower: number,
    tickUpper: number,
    currentTick: number,
    baseDecimals: number = 8,
    quoteDecimals: number = 8
): { lowerPercent: number; upperPercent: number } {
    const currentPrice = tickToPrice(currentTick, baseDecimals, quoteDecimals);
    const lowerPrice = tickToPrice(tickLower, baseDecimals, quoteDecimals);
    const upperPrice = tickToPrice(tickUpper, baseDecimals, quoteDecimals);

    const lowerPercent = ((lowerPrice - currentPrice) / currentPrice) * 100;
    const upperPercent = ((upperPrice - currentPrice) / currentPrice) * 100;

    return { lowerPercent, upperPercent };
}

// ============================================================================
// TICK PRICE FORMATTING
// ============================================================================

/**
 * Format tick to display price with appropriate decimals
 * Handles full range bounds by displaying "0" and "∞"
 *
 * @param tick - Tick to format
 * @param baseDecimals - Decimals of base token (default: 8)
 * @param quoteDecimals - Decimals of quote token (default: 8)
 * @param maxDecimals - Maximum decimal places to show (default: 6)
 * @returns Formatted price string
 */
export function formatTickPrice(
    tick: number,
    baseDecimals: number = 8,
    quoteDecimals: number = 8,
    maxDecimals: number = 6
): string {
    // Handle full range bounds specially
    if (isMinTick(tick)) return '0';
    if (isMaxTick(tick)) return '∞';

    const price = tickToPrice(tick, baseDecimals, quoteDecimals);

    // Use more decimals for very small prices
    if (price < 0.0001) return price.toExponential(4);
    if (price < 1) return price.toFixed(Math.min(6, maxDecimals));
    if (price < 100) return price.toFixed(Math.min(4, maxDecimals));
    return price.toFixed(Math.min(2, maxDecimals));
}

/**
 * Format a price value, handling edge cases like very small/large numbers
 * Use this for prices that may be at full range bounds
 *
 * @param price - Price value to format
 * @param tick - Optional tick for full range bound detection
 * @returns Formatted price string
 */
export function formatPriceDisplay(price: number, tick?: number): string {
    // If tick is provided, check for full range bounds
    if (tick !== undefined) {
        if (isMinTick(tick)) return '0';
        if (isMaxTick(tick)) return '∞';
    }

    // Handle extreme values
    if (!isFinite(price) || price > 1e30) return '∞';
    if (price < 1e-30 || price === 0) return '0';

    // Normal formatting
    if (price < 0.0001) return price.toExponential(2);
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    if (price < 100) return price.toFixed(2);
    if (price < 1000000) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return price.toExponential(2);
}
