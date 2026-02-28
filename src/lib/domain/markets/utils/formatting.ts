/**
 * Spot Market Formatting & Validation Utilities
 *
 * Decimal precision handling, amount validation, and display formatting
 * Safe string ↔ BigInt conversions avoiding floating-point arithmetic
 */

import type { SpotTick, SpotSqrtPriceX96, SpotLiquidity } from '../spot.types';
import {
    MIN_TICK,
    MAX_TICK,
    PERCENTAGE_DIVISOR,
    tickToPrice,
    priceToTick,
    sqrtPriceX96ToPrice,
    tickToSqrtPriceX96,
    getLiquidityForAmountBase,
    getLiquidityForAmountQuote,
    getAmountsForLiquidity
} from './math';

type Tick = SpotTick;
type SqrtPriceX96 = SpotSqrtPriceX96;
type Liquidity = SpotLiquidity;

// ============================================================================
// DECIMAL PRECISION UTILITIES
// ============================================================================

/**
 * Convert string amount to BigInt with exact decimal precision
 * Avoids floating-point arithmetic for financial calculations
 *
 * @param amount - Amount as string (e.g., "1000.123456")
 * @param decimals - Number of decimal places for the token
 * @returns BigInt representation with decimals
 *
 * @example
 * stringToBigInt("1000.12345678", 8) // 100012345678n
 * stringToBigInt("1000", 8) // 100000000000n
 * stringToBigInt("0.5", 8) // 50000000n
 */
export function stringToBigInt(amount: string, decimals: number): bigint {
    if (!amount || amount.trim() === '') {
        throw new Error('Amount cannot be empty');
    }

    // Remove leading/trailing whitespace
    const trimmed = amount.trim();

    // Check for valid number format
    if (!/^[0-9]*\.?[0-9]*$/.test(trimmed)) {
        throw new Error('Invalid amount format');
    }

    // Split into integer and fractional parts
    const [integerPart = '0', fractionalPart = ''] = trimmed.split('.');

    // Check if fractional part exceeds token decimals
    if (fractionalPart.length > decimals) {
        throw new Error(`Amount has too many decimal places (max: ${decimals})`);
    }

    // Pad fractional part to match decimals
    const paddedFraction = fractionalPart.padEnd(decimals, '0');

    // Combine and convert
    const combined = integerPart + paddedFraction;

    // Handle empty or zero case
    if (combined === '' || /^0+$/.test(combined)) {
        return 0n;
    }

    return BigInt(combined);
}

/**
 * Convert BigInt to human-readable string with decimals
 *
 * @param value - BigInt value with decimals
 * @param decimals - Number of decimal places
 * @param trimTrailingZeros - Remove trailing zeros (default: true)
 * @returns Formatted string
 *
 * @example
 * bigIntToString(100012345678n, 8) // "1000.12345678"
 * bigIntToString(100000000000n, 8) // "1000"
 * bigIntToString(50000000n, 8) // "0.5"
 */
export function bigIntToString(
    value: bigint,
    decimals: number,
    trimTrailingZeros: boolean = true
): string {
    if (value === 0n) return '0';

    const isNegative = value < 0n;
    const absoluteValue = isNegative ? -value : value;

    // Convert to string and pad with leading zeros
    const str = absoluteValue.toString().padStart(decimals + 1, '0');

    // Split into integer and fractional parts
    const integerPart = str.slice(0, -decimals) || '0';
    const fractionalPart = str.slice(-decimals);

    // Trim trailing zeros if requested
    const trimmedFraction = trimTrailingZeros
        ? fractionalPart.replace(/0+$/, '')
        : fractionalPart;

    // Construct final string
    const result = trimmedFraction
        ? `${integerPart}.${trimmedFraction}`
        : integerPart;

    return isNegative ? `-${result}` : result;
}

/**
 * Validate amount string format and value
 *
 * @param amount - Amount string to validate
 * @param decimals - Maximum decimal places allowed
 * @param minValue - Optional minimum value
 * @returns Validation result with error message if invalid
 */
export function validateAmount(
    amount: string,
    decimals: number,
    minValue?: string
): { valid: boolean; error?: string } {
    // Check empty
    if (!amount || amount.trim() === '') {
        return { valid: false, error: 'Amount cannot be empty' };
    }

    // Check format
    if (!/^[0-9]*\.?[0-9]*$/.test(amount.trim())) {
        return { valid: false, error: 'Invalid number format' };
    }

    // Check decimal places
    const [, fractionalPart = ''] = amount.split('.');
    if (fractionalPart.length > decimals) {
        return { valid: false, error: `Maximum ${decimals} decimal places allowed` };
    }

    // Check value is positive
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
        return { valid: false, error: 'Amount must be greater than 0' };
    }

    // Check minimum value
    if (minValue) {
        const minVal = parseFloat(minValue);
        if (value < minVal) {
            return { valid: false, error: `Amount must be at least ${minValue}` };
        }
    }

    return { valid: true };
}

// ============================================================================
// PRICE & RANGE VALIDATION
// ============================================================================

/**
 * Validate price range for liquidity provision
 * Supports full range: minPrice = 0 (MIN_TICK) and maxPrice = Infinity (MAX_TICK)
 *
 * @param minPrice - Lower price bound (0 for full range lower bound)
 * @param maxPrice - Upper price bound (Infinity for full range upper bound)
 * @param currentPrice - Current pool price (optional)
 * @returns Validation result with error message if invalid
 */
export function validatePriceRange(
    minPrice: number,
    maxPrice: number,
    currentPrice?: number
): { valid: boolean; error?: string } {
    // Check valid price values (allow 0 for min, Infinity for max)
    if (minPrice < 0) {
        return { valid: false, error: 'Minimum price cannot be negative' };
    }
    if (maxPrice <= 0 || isNaN(maxPrice)) {
        return { valid: false, error: 'Maximum price must be greater than 0' };
    }

    // Check range ordering (handle Infinity case)
    if (maxPrice !== Infinity && maxPrice <= minPrice) {
        return { valid: false, error: 'Maximum price must be greater than minimum price' };
    }
    if (minPrice === 0 && maxPrice === 0) {
        return { valid: false, error: 'Price range cannot be [0, 0]' };
    }

    // Check current price is in range (if provided)
    if (currentPrice !== undefined && currentPrice !== null) {
        if (currentPrice < minPrice) {
            return { valid: false, error: 'Current price must be within the specified range' };
        }
        if (maxPrice !== Infinity && currentPrice > maxPrice) {
            return { valid: false, error: 'Current price must be within the specified range' };
        }
        if (currentPrice <= 0) {
            return { valid: false, error: 'Current price must be greater than 0' };
        }
    }

    // Check ticks are within bounds (priceToTick now handles 0 and Infinity)
    try {
        const tickLower = priceToTick(minPrice);
        const tickUpper = priceToTick(maxPrice);

        // Sanity check - these should be handled by priceToTick
        if (tickLower < MIN_TICK || tickLower > MAX_TICK) {
            return { valid: false, error: 'Minimum price exceeds valid tick bounds' };
        }
        if (tickUpper < MIN_TICK || tickUpper > MAX_TICK) {
            return { valid: false, error: 'Maximum price exceeds valid tick bounds' };
        }
        if (tickUpper <= tickLower) {
            return { valid: false, error: 'Invalid tick range' };
        }
    } catch (e) {
        return { valid: false, error: 'Invalid price range' };
    }

    return { valid: true };
}

/**
 * Calculate suggested initial price as midpoint of range
 * Handles special cases for 0 and Infinity (full range positions)
 *
 * @param minPrice - Lower price bound (can be 0)
 * @param maxPrice - Upper price bound (can be Infinity)
 * @returns Suggested initial price
 */
export function suggestInitialPrice(minPrice: number, maxPrice: number): number {
    // Handle full range [0, Infinity]
    if (minPrice === 0 && maxPrice === Infinity) {
        return 1; // Price = 1 is a reasonable default for full range
    }

    // Handle [0, X] - suggest midpoint in log scale
    if (minPrice === 0) {
        // Use a small fraction of maxPrice as starting point
        return maxPrice / 10000; // or Math.pow(maxPrice, 0.5) for geometric feel
    }

    // Handle [X, Infinity] - suggest a multiple of minPrice
    if (maxPrice === Infinity) {
        return minPrice * 10000; // or Math.pow(minPrice, 1.5) for geometric feel
    }

    // Normal case: geometric mean is better than arithmetic mean for price ranges
    return Math.sqrt(minPrice * maxPrice);
}

// ============================================================================
// LIQUIDITY CALCULATION HELPERS (UI-FRIENDLY WRAPPERS)
// ============================================================================

/**
 * Calculate amountQuote needed given amountBase and price range
 * Useful for reactive UI updates when user edits amountBase
 *
 * @param amountBase - Amount of base token (as bigint)
 * @param currentTick - Current pool tick
 * @param tickLower - Lower tick bound
 * @param tickUpper - Upper tick bound
 * @returns Required amountQuote (as bigint)
 */
export function calculateAmountQuoteFromAmountBase(
    amountBase: bigint,
    currentTick: Tick,
    tickLower: Tick,
    tickUpper: Tick
): bigint {
    const sqrtPriceCurrent = tickToSqrtPriceX96(currentTick);
    const sqrtPriceLower = tickToSqrtPriceX96(tickLower);
    const sqrtPriceUpper = tickToSqrtPriceX96(tickUpper);

    let liquidity: Liquidity;

    if (currentTick < tickLower) {
        // Price is below range, only base token needed
        liquidity = getLiquidityForAmountBase(sqrtPriceLower, sqrtPriceUpper, amountBase);
    } else if (currentTick >= tickUpper) {
        // Price is above range, only quote token needed
        return 0n;
    } else {
        // Price is in range - calculate liquidity from amountBase in upper portion
        liquidity = getLiquidityForAmountBase(sqrtPriceCurrent, sqrtPriceUpper, amountBase);
    }

    const [, amountQuote] = getAmountsForLiquidity(
        currentTick,
        tickLower,
        tickUpper,
        liquidity
    );

    return amountQuote;
}

/**
 * Calculate amountBase needed given amountQuote and price range
 * Useful for reactive UI updates when user edits amountQuote
 *
 * @param amountQuote - Amount of quote token (as bigint)
 * @param currentTick - Current pool tick
 * @param tickLower - Lower tick bound
 * @param tickUpper - Upper tick bound
 * @returns Required amountBase (as bigint)
 */
export function calculateAmountBaseFromAmountQuote(
    amountQuote: bigint,
    currentTick: Tick,
    tickLower: Tick,
    tickUpper: Tick
): bigint {
    const sqrtPriceCurrent = tickToSqrtPriceX96(currentTick);
    const sqrtPriceLower = tickToSqrtPriceX96(tickLower);
    const sqrtPriceUpper = tickToSqrtPriceX96(tickUpper);

    let liquidity: Liquidity;

    if (currentTick < tickLower) {
        // Price is below range, only base token needed
        return 0n;
    } else if (currentTick >= tickUpper) {
        // Price is above range, all liquidity comes from amountQuote
        liquidity = getLiquidityForAmountQuote(sqrtPriceLower, sqrtPriceUpper, amountQuote);
    } else {
        // Price is in range - calculate liquidity from amountQuote in lower portion
        liquidity = getLiquidityForAmountQuote(sqrtPriceLower, sqrtPriceCurrent, amountQuote);
    }

    const [amountBase] = getAmountsForLiquidity(
        currentTick,
        tickLower,
        tickUpper,
        liquidity
    );

    return amountBase;
}

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format tick for display
 *
 * @param tick - Tick index
 * @returns Formatted string with price
 */
export function formatTick(
    tick: Tick,
    baseDecimals: number = 8,
    quoteDecimals: number = 8,
): string {
    const price = tickToPrice(tick, baseDecimals, quoteDecimals);
    return `Tick ${tick} (Price: ${price.toFixed(6)})`;
}

/**
 * Format sqrtPriceX96 for display
 *
 * @param sqrtPriceX96 - Sqrt price in Q64.96
 * @returns Formatted price string
 */
export function formatSqrtPrice(
    sqrtPriceX96: SqrtPriceX96,
    baseDecimals: number = 8,
    quoteDecimals: number = 8,
): string {
    const price = sqrtPriceX96ToPrice(sqrtPriceX96, baseDecimals, quoteDecimals);
    return price.toFixed(6);
}

/**
 * Format liquidity for display
 * Note: Liquidity values are typically represented in Q96 fixed-point format
 *
 * @param liquidity - Liquidity amount
 * @param displayDecimals - Number of decimal places to show (default: 2)
 * @returns Formatted string
 */
export function formatLiquidity(liquidity: Liquidity, displayDecimals: number = 2): string {
    // Liquidity is in its raw form - we just format it for display
    const value = Number(liquidity);
    if (value === 0) return '0';

    // For very large values, use scientific notation
    if (value > 1e15) {
        return value.toExponential(displayDecimals);
    }

    return value.toFixed(displayDecimals);
}

/**
 * Format basis points to percentage string
 *
 * @param basisPoints - Basis points (e.g., 50 = 0.5%)
 * @returns Formatted percentage
 */
export function formatBasisPoints(basisPoints: bigint): string {
    const percentage = Number(basisPoints) / PERCENTAGE_DIVISOR;
    return `${percentage.toFixed(2)}%`;
}

// ============================================================================
// FEE TIER UTILITIES (PIPS)
// ============================================================================

/**
 * Pips constants for fee tiers
 * 1 pip = 0.0001% = 1/1,000,000
 * 1 bps = 100 pips = 0.01%
 *
 * Backend uses pips (100-10000 range)
 * Frontend stores pips internally, displays as percentage
 */
export const PIPS_BASE = 1_000_000;
export const PIPS_TO_BPS = 100;
export const MIN_FEE_PIPS = 100;   // 0.01%
export const MAX_FEE_PIPS = 10_000; // 1.00%

/**
 * Convert fee pips to display percentage string
 *
 * @param pips - Fee in pips (e.g., 3000 = 0.30%)
 * @returns Formatted percentage string (e.g., "0.30%")
 *
 * @example
 * formatFeePips(100)   // "0.01%"
 * formatFeePips(500)   // "0.05%"
 * formatFeePips(3000)  // "0.30%"
 * formatFeePips(10000) // "1.00%"
 */
export function formatFeePips(pips: number): string {
    const percentage = pips / 10_000; // 10000 pips = 1%
    return `${percentage.toFixed(2)}%`;
}

/**
 * Convert percentage string to fee pips
 *
 * @param percentStr - Percentage as string (e.g., "0.30")
 * @returns Fee in pips (e.g., 3000)
 *
 * @example
 * parseFeePips("0.01") // 100
 * parseFeePips("0.30") // 3000
 * parseFeePips("1.00") // 10000
 */
export function parseFeePips(percentStr: string): number {
    const percent = parseFloat(percentStr);
    if (isNaN(percent)) return 0;
    return Math.round(percent * 10_000);
}

/**
 * Convert BPS to pips
 * Use when converting legacy BPS values
 */
export function bpsToPips(bps: number): number {
    return bps * PIPS_TO_BPS;
}

/**
 * Convert pips to BPS
 * Use when needing BPS for display or legacy compatibility
 */
export function pipsToBps(pips: number): number {
    return pips / PIPS_TO_BPS;
}
