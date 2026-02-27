/**
 * Spot Market Core Math (Uniswap V3)
 *
 * Pure mathematical primitives for concentrated liquidity calculations.
 * Zero dependencies - foundation for all other spot market utilities.
 *
 * Architecture: FRONTEND_ARCHITECTURE.md - Shared Services Layer
 */

import type { SpotTick, SpotSqrtPriceX96, SpotLiquidity } from '../spot.types';

// ============================================================================
// TYPE RE-EXPORTS
// ============================================================================

export type Tick = SpotTick;
export type SqrtPriceX96 = SpotSqrtPriceX96;
export type Liquidity = SpotLiquidity;

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Q notation constants for fixed-point math
 * Q64.96 = 64 bits for integer part, 96 bits for fractional part
 */
export const Q96 = 2n ** 96n;
export const Q192 = 2n ** 192n;
export const Q32 = 2n ** 32n;
export const Q128 = 2n ** 128n;

/**
 * Tick math constants (from Uniswap V3)
 */
export const MIN_TICK = -887272;
export const MAX_TICK = 887272;
export const MIN_SQRT_RATIO = 4295128739n; // sqrt(1.0001^-887272) * 2^96
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n; // sqrt(1.0001^887272) * 2^96

/**
 * Common constants
 */
export const BASIS_POINTS_DIVISOR = 10000n;
export const PERCENTAGE_DIVISOR = 100;

/**
 * Convert basis points to percentage
 *
 * @param bps - Basis points (e.g., 5000 = 50%)
 * @returns Percentage as number (e.g., 50)
 *
 * @example
 * bpsToPercent(5000n)  // 50
 * bpsToPercent(100n)   // 1
 * bpsToPercent(50n)    // 0.5
 */
export function bpsToPercent(bps: bigint | number): number {
  return Number(bps) / PERCENTAGE_DIVISOR;
}

// ============================================================================
// TICK ↔ PRICE CONVERSIONS
// ============================================================================

/**
 * Default tick spacing used when not specified
 */
export const DEFAULT_TICK_SPACING = 60;

/**
 * Convert tick to human-readable price
 *
 * In Uniswap V3:
 * - tick represents: log₁.₀₀₀₁(token1_raw / token0_raw)
 * - raw_price = 1.0001^tick = token1_raw / token0_raw
 * - human_price = raw_price * 10^(token0Decimals - token1Decimals)
 *
 * This gives "how many token1 per 1 token0" in human-readable terms.
 * Price convention: token1/token0 = quote/base
 *
 * @param tick - Tick index
 * @param token0Decimals - Decimals of base token (default: 8)
 * @param token1Decimals - Decimals of quote token (default: 8)
 * @returns Human-readable price (token1 per token0)
 *
 * @example
 * // PARTY (8 decimals) / ICP (8 decimals), tick = 0
 * // human_price = 1.0001^0 * 10^(8-8) = 1 ICP per PARTY
 * tickToPrice(0, 8, 8) // 1.0
 *
 * // PARTY (8 decimals) / USDC (6 decimals), tick = 0
 * // human_price = 1.0001^0 * 10^(8-6) = 100 USDC per PARTY
 * tickToPrice(0, 8, 6) // 100.0
 */
export function tickToPrice(
    tick: Tick,
    token0Decimals: number = 8,
    token1Decimals: number = 8
): number {
    const rawPrice = Math.pow(1.0001, tick);
    const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals);
    return rawPrice * decimalAdjustment;
}

/**
 * Convert human-readable price to the nearest valid tick
 *
 * This is the inverse of tickToPrice:
 * - humanPrice = 1.0001^tick * 10^(token0Decimals - token1Decimals)
 * - rawPrice = humanPrice / 10^(token0Decimals - token1Decimals)
 * - tick = log(rawPrice) / log(1.0001)
 *
 * Price convention: token1/token0 = quote/base
 *
 * @param price - Human-readable price (token1 per token0), supports 0 for MIN_TICK and Infinity for MAX_TICK
 * @param token0Decimals - Decimals of base token (default: 8)
 * @param token1Decimals - Decimals of quote token (default: 8)
 * @param tickSpacing - Tick spacing for rounding (default: 60)
 * @returns Nearest valid tick aligned to tickSpacing
 *
 * @example
 * priceToTick(0, 8, 8) // MIN_TICK (-887272) - full range lower bound
 * priceToTick(1, 8, 8) // 0
 * priceToTick(Infinity, 8, 8) // MAX_TICK (887272) - full range upper bound
 */
export function priceToTick(
    price: number,
    token0Decimals: number = 8,
    token1Decimals: number = 8,
    tickSpacing: number = DEFAULT_TICK_SPACING
): Tick {
    // Handle special cases for full range
    if (price === 0) return MIN_TICK;
    if (price === Infinity || !isFinite(price)) return MAX_TICK;
    if (price <= 0) return MIN_TICK;

    // Convert human price to raw price by removing decimal adjustment
    const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals);
    const rawPrice = price / decimalAdjustment;

    const tick = Math.log(rawPrice) / Math.log(1.0001);

    // Round to nearest tick spacing
    const roundedTick = Math.round(tick / tickSpacing) * tickSpacing;

    // Clamp to valid range
    return Math.max(MIN_TICK, Math.min(MAX_TICK, roundedTick));
}

// ============================================================================
// SQRT PRICE CONVERSIONS
// ============================================================================

/**
 * E12 scale factor for fixed-point price representation
 * Used for exact price calculations without floating-point precision loss
 */
export const E12 = 10n ** 12n;

/**
 * Convert sqrtPriceX96 to human-readable price with decimal normalization
 * Raw price = (sqrtPriceX96 / 2^96)^2 (in smallest-unit space)
 * Human price = raw_price * 10^(baseDecimals - quoteDecimals)
 *
 * @param sqrtPriceX96 - Square root price in Q64.96 format
 * @param baseDecimals - Decimals of base token (token0) (default: 8)
 * @param quoteDecimals - Decimals of quote token (token1) (default: 8)
 * @returns Human-readable price (token1 per token0)
 *
 * @example
 * sqrtPriceX96ToPrice(79228162514264337593543950336n) // 1.0
 * sqrtPriceX96ToPrice(79228162514264337593543950336n, 8, 6) // 100.0
 */
export function sqrtPriceX96ToPrice(
    sqrtPriceX96: SqrtPriceX96,
    baseDecimals: number = 8,
    quoteDecimals: number = 8,
): number {
    const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
    const rawPrice = sqrtPrice * sqrtPrice;
    return rawPrice * Math.pow(10, baseDecimals - quoteDecimals);
}

/**
 * Convert sqrtPriceX96 to E12 price format using pure bigint math with decimal normalization.
 * This is the canonical price representation for display - no floating-point precision loss.
 *
 * Formula: raw_price_e12 = (sqrtPriceX96² × 10¹²) / 2¹⁹²
 * Normalized: price_e12 = raw_price_e12 * 10^(baseDecimals - quoteDecimals)
 *
 * Matches backend math.mo sqrt_price_to_price_e12().
 *
 * @param sqrtPriceX96 - Square root price in Q64.96 format
 * @param baseDecimals - Decimals of base token (token0) (default: 8)
 * @param quoteDecimals - Decimals of quote token (token1) (default: 8)
 * @returns Price in E12 format (divide by 1e12 for human-readable price)
 *
 * @example
 * sqrtPriceX96ToPriceE12(79228162514264337593543950336n) // 1_000_000_000_000n (= 1.0)
 * sqrtPriceX96ToPriceE12(79228162514264337593543950336n, 8, 6) // 100_000_000_000_000n (= 100.0)
 */
export function sqrtPriceX96ToPriceE12(
    sqrtPriceX96: SqrtPriceX96,
    baseDecimals: number = 8,
    quoteDecimals: number = 8,
): bigint {
    if (sqrtPriceX96 === 0n) return 0n;
    const raw = (sqrtPriceX96 * sqrtPriceX96 * E12) / Q192;

    if (baseDecimals >= quoteDecimals) {
        return raw * (10n ** BigInt(baseDecimals - quoteDecimals));
    } else {
        return raw / (10n ** BigInt(quoteDecimals - baseDecimals));
    }
}

/**
 * Convert price to sqrtPriceX96
 * sqrtPriceX96 = sqrt(price) * 2^96
 *
 * @param price - Price ratio
 * @returns Square root price in Q64.96 format
 *
 * @example
 * priceToSqrtPriceX96(1) // 79228162514264337593543950336n
 */
export function priceToSqrtPriceX96(price: number): SqrtPriceX96 {
    const sqrtPrice = Math.sqrt(price);
    return BigInt(Math.floor(sqrtPrice * Number(Q96)));
}

/**
 * Convert tick to sqrtPriceX96 using Uniswap V3 lookup table
 * This uses the exact same bit manipulation approach as the backend
 * to avoid any floating-point precision errors.
 *
 * Calculates sqrt(1.0001^tick) * 2^96 using precomputed multipliers
 *
 * @param tick - Tick index
 * @returns Square root price in Q64.96 format
 */
export function tickToSqrtPriceX96(tick: Tick): SqrtPriceX96 {
    if (tick < MIN_TICK || tick > MAX_TICK) {
        throw new Error(`Tick ${tick} out of bounds [${MIN_TICK}, ${MAX_TICK}]`);
    }

    const absTick = Math.abs(tick);

    // Lookup table for sqrt(1.0001^(2^i)) in Q128 format
    // These are the exact Uniswap V3 constants
    let ratio = (absTick & 0x1) !== 0
        ? 0xfffcb933bd6fad37aa2d162d1a594001n
        : Q128;

    if ((absTick & 0x2) !== 0) ratio = (ratio * 0xfff97272373d413259a46990580e213an) / Q128;
    if ((absTick & 0x4) !== 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) / Q128;
    if ((absTick & 0x8) !== 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) / Q128;
    if ((absTick & 0x10) !== 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) / Q128;
    if ((absTick & 0x20) !== 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) / Q128;
    if ((absTick & 0x40) !== 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) / Q128;
    if ((absTick & 0x80) !== 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) / Q128;
    if ((absTick & 0x100) !== 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) / Q128;
    if ((absTick & 0x200) !== 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) / Q128;
    if ((absTick & 0x400) !== 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) / Q128;
    if ((absTick & 0x800) !== 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) / Q128;
    if ((absTick & 0x1000) !== 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) / Q128;
    if ((absTick & 0x2000) !== 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) / Q128;
    if ((absTick & 0x4000) !== 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) / Q128;
    if ((absTick & 0x8000) !== 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) / Q128;
    if ((absTick & 0x10000) !== 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) / Q128;
    if ((absTick & 0x20000) !== 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) / Q128;
    if ((absTick & 0x40000) !== 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) / Q128;
    if ((absTick & 0x80000) !== 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) / Q128;

    // Convert from Q128 to Q96 by dividing by 2^32
    // For negative ticks: use ratio directly
    // For positive ticks: use reciprocal (2^96 * 2^96 * 2^32) / ratio
    // IMPORTANT: Match backend logic - multipliers are in reciprocal space
    if (tick < 0) {
        return ratio / Q32;  // Direct for negative tick
    } else {
        return (Q96 * Q96 * Q32) / ratio;  // Reciprocal for positive tick (avoid intermediate division)
    }
}

/**
 * Convert sqrtPriceX96 to tick using binary search
 * This matches the backend implementation exactly
 *
 * @param sqrtPriceX96 - Square root price in Q64.96 format
 * @returns Floor tick (largest tick where sqrtPrice <= input)
 */
export function sqrtPriceX96ToTick(sqrtPriceX96: SqrtPriceX96): Tick {
    if (sqrtPriceX96 < MIN_SQRT_RATIO || sqrtPriceX96 >= MAX_SQRT_RATIO) {
        throw new Error(`sqrtPriceX96 ${sqrtPriceX96} out of bounds [${MIN_SQRT_RATIO}, ${MAX_SQRT_RATIO})`);
    }

    let low = MIN_TICK;
    let high = MAX_TICK;

    while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        const sqrtRatioAtMid = tickToSqrtPriceX96(mid);

        if (sqrtRatioAtMid > sqrtPriceX96) {
            high = mid - 1;
        } else {
            low = mid;
        }
    }

    return low;
}

// ============================================================================
// LIQUIDITY CALCULATIONS
// ============================================================================

/**
 * Calculate liquidity from token amounts for a given tick range
 * Uses Uniswap V3 formula
 *
 * @param currentTick - Current pool tick
 * @param tickLower - Lower tick of range
 * @param tickUpper - Upper tick of range
 * @param amount0 - Amount of token0
 * @param amount1 - Amount of token1
 * @returns Liquidity amount
 */
export function getLiquidityForAmounts(
    currentTick: Tick,
    tickLower: Tick,
    tickUpper: Tick,
    amount0: bigint,
    amount1: bigint
): Liquidity {
    const sqrtPriceCurrent = tickToSqrtPriceX96(currentTick);
    const sqrtPriceLower = tickToSqrtPriceX96(tickLower);
    const sqrtPriceUpper = tickToSqrtPriceX96(tickUpper);

    if (currentTick < tickLower) {
        // Price is below range, only token0 needed
        return getLiquidityForAmount0(sqrtPriceLower, sqrtPriceUpper, amount0);
    } else if (currentTick >= tickUpper) {
        // Price is above range, only token1 needed
        return getLiquidityForAmount1(sqrtPriceLower, sqrtPriceUpper, amount1);
    } else {
        // Price is in range, use both tokens
        const liquidity0 = getLiquidityForAmount0(sqrtPriceCurrent, sqrtPriceUpper, amount0);
        const liquidity1 = getLiquidityForAmount1(sqrtPriceLower, sqrtPriceCurrent, amount1);
        return liquidity0 < liquidity1 ? liquidity0 : liquidity1;
    }
}

/**
 * Calculate liquidity from amount0
 * L = amount0 * (sqrtPriceUpper * sqrtPriceLower) / (sqrtPriceUpper - sqrtPriceLower)
 */
export function getLiquidityForAmount0(
    sqrtPriceLower: SqrtPriceX96,
    sqrtPriceUpper: SqrtPriceX96,
    amount0: bigint
): Liquidity {
    if (sqrtPriceLower >= sqrtPriceUpper) return 0n;

    const numerator = amount0 * sqrtPriceLower * sqrtPriceUpper;
    const denominator = Q96 * (sqrtPriceUpper - sqrtPriceLower);

    return numerator / denominator;
}

/**
 * Calculate liquidity from amount1
 * L = amount1 / (sqrtPriceUpper - sqrtPriceLower)
 */
export function getLiquidityForAmount1(
    sqrtPriceLower: SqrtPriceX96,
    sqrtPriceUpper: SqrtPriceX96,
    amount1: bigint
): Liquidity {
    if (sqrtPriceLower >= sqrtPriceUpper) return 0n;

    return (amount1 * Q96) / (sqrtPriceUpper - sqrtPriceLower);
}

// ============================================================================
// TOKEN AMOUNT CALCULATIONS
// ============================================================================

/**
 * Calculate token amounts for a given liquidity and tick range
 *
 * @param currentTick - Current pool tick
 * @param tickLower - Lower tick of range
 * @param tickUpper - Upper tick of range
 * @param liquidity - Liquidity amount
 * @returns Token amounts [amount0, amount1]
 */
export function getAmountsForLiquidity(
    currentTick: Tick,
    tickLower: Tick,
    tickUpper: Tick,
    liquidity: Liquidity
): [bigint, bigint] {
    const sqrtPriceCurrent = tickToSqrtPriceX96(currentTick);
    const sqrtPriceLower = tickToSqrtPriceX96(tickLower);
    const sqrtPriceUpper = tickToSqrtPriceX96(tickUpper);

    if (currentTick < tickLower) {
        // Price below range, all token0
        const amount0 = getAmount0ForLiquidity(sqrtPriceLower, sqrtPriceUpper, liquidity);
        return [amount0, 0n];
    } else if (currentTick >= tickUpper) {
        // Price above range, all token1
        const amount1 = getAmount1ForLiquidity(sqrtPriceLower, sqrtPriceUpper, liquidity);
        return [0n, amount1];
    } else {
        // Price in range, both tokens
        const amount0 = getAmount0ForLiquidity(sqrtPriceCurrent, sqrtPriceUpper, liquidity);
        const amount1 = getAmount1ForLiquidity(sqrtPriceLower, sqrtPriceCurrent, liquidity);
        return [amount0, amount1];
    }
}

/**
 * Calculate amount0 for liquidity
 * amount0 = L * (sqrtPriceUpper - sqrtPriceCurrent) / (sqrtPriceUpper * sqrtPriceCurrent)
 */
function getAmount0ForLiquidity(
    sqrtPriceLower: SqrtPriceX96,
    sqrtPriceUpper: SqrtPriceX96,
    liquidity: Liquidity
): bigint {
    if (sqrtPriceLower >= sqrtPriceUpper) return 0n;

    const numerator = liquidity * (sqrtPriceUpper - sqrtPriceLower);
    const denominator = sqrtPriceUpper * sqrtPriceLower;

    return (numerator * Q96) / denominator;
}

/**
 * Calculate amount1 for liquidity
 * amount1 = L * (sqrtPriceUpper - sqrtPriceLower)
 */
function getAmount1ForLiquidity(
    sqrtPriceLower: SqrtPriceX96,
    sqrtPriceUpper: SqrtPriceX96,
    liquidity: Liquidity
): bigint {
    if (sqrtPriceLower >= sqrtPriceUpper) return 0n;

    return (liquidity * (sqrtPriceUpper - sqrtPriceLower)) / Q96;
}

// ============================================================================
// TOKEN AMOUNT CONVERSIONS
// ============================================================================

/**
 * Convert token0 amount to token1 amount at a given tick
 * Formula: token1 = token0 * price where price = 1.0001^tick
 *
 * @param amount0 - Token0 amount (e.g., PARTY)
 * @param tick - Price tick
 * @returns Equivalent token1 amount (e.g., ICP)
 *
 * @example
 * convertToken0ToToken1(1000000n, 0) // 1000000n (at tick 0, price = 1.0)
 * convertToken0ToToken1(1000000n, 69080) // ~1000000n (at price ≈ 1000)
 */
export function convertToken0ToToken1(amount0: bigint, tick: Tick): bigint {
    if (amount0 === 0n) return 0n;

    const price = tickToPrice(tick);
    const amount1 = Number(amount0) * price;

    return BigInt(Math.floor(amount1));
}

/**
 * Convert token1 amount to token0 amount at a given tick
 * Formula: token0 = token1 / price where price = 1.0001^tick
 *
 * @param amount1 - Token1 amount (e.g., ICP)
 * @param tick - Price tick
 * @returns Equivalent token0 amount (e.g., PARTY)
 *
 * @example
 * convertToken1ToToken0(1000000n, 0) // 1000000n (at tick 0, price = 1.0)
 * convertToken1ToToken0(1000000n, 69080) // ~1000n (at price ≈ 1000)
 */
export function convertToken1ToToken0(amount1: bigint, tick: Tick): bigint {
    if (amount1 === 0n) return 0n;

    const price = tickToPrice(tick);
    const amount0 = Number(amount1) / price;

    return BigInt(Math.floor(amount0));
}

// ============================================================================
// PRICE IMPACT & SLIPPAGE
// ============================================================================

/**
 * Calculate price impact for a swap
 * Returns the percentage change in price
 *
 * @param currentSqrtPrice - Current sqrt price
 * @param newSqrtPrice - New sqrt price after swap
 * @returns Price impact in basis points (e.g., 50 = 0.5%)
 */
export function calculatePriceImpact(
    currentSqrtPrice: SqrtPriceX96,
    newSqrtPrice: SqrtPriceX96
): bigint {
    const currentPrice = sqrtPriceX96ToPrice(currentSqrtPrice);
    const newPrice = sqrtPriceX96ToPrice(newSqrtPrice);

    const impact = Math.abs((newPrice - currentPrice) / currentPrice);
    return BigInt(Math.floor(impact * Number(BASIS_POINTS_DIVISOR)));
}

/**
 * Calculate minimum amount out with slippage tolerance
 *
 * @param amountOut - Expected output amount
 * @param slippageBasisPoints - Slippage tolerance in basis points (e.g., 50 = 0.5%)
 * @returns Minimum amount accounting for slippage
 */
export function calculateMinAmountOut(
    amountOut: bigint,
    slippageBasisPoints: bigint
): bigint {
    const slippageMultiplier = BASIS_POINTS_DIVISOR - slippageBasisPoints;
    return (amountOut * slippageMultiplier) / BASIS_POINTS_DIVISOR;
}

/**
 * Calculate sqrt price limit for swap with slippage
 *
 * @param currentSqrtPrice - Current sqrt price
 * @param slippageBasisPoints - Slippage tolerance in basis points
 * @param zeroForOne - Swap direction (true = token0→token1)
 * @returns Sqrt price limit
 */
export function calculateSqrtPriceLimit(
    currentSqrtPrice: SqrtPriceX96,
    slippageBasisPoints: bigint,
    zeroForOne: boolean
): SqrtPriceX96 {
    const slippageMultiplier = zeroForOne
        ? BASIS_POINTS_DIVISOR - slippageBasisPoints
        : BASIS_POINTS_DIVISOR + slippageBasisPoints;

    const limitPrice = (currentSqrtPrice * slippageMultiplier) / BASIS_POINTS_DIVISOR;

    // Clamp to valid range
    if (limitPrice < MIN_SQRT_RATIO) return MIN_SQRT_RATIO;
    if (limitPrice > MAX_SQRT_RATIO) return MAX_SQRT_RATIO;

    return limitPrice;
}
