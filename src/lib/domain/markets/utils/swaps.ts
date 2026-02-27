/**
 * Spot Market Swap & CLOB Conversion Utilities
 *
 * Swap estimation, validation, and CLOB (Central Limit Order Book) conversion
 * Includes utilities for converting between AMM and CLOB semantics
 */

import type { SpotTick, SpotSqrtPriceX96 } from '../spot.types';
import {
    BASIS_POINTS_DIVISOR,
    tickToPrice,
    priceToTick,
    sqrtPriceX96ToPrice,
    priceToSqrtPriceX96
} from './math';
import { stringToBigInt, bigIntToString, validateAmount } from './formatting';

type Tick = SpotTick;
type SqrtPriceX96 = SpotSqrtPriceX96;

// Side type for CLOB conversion utilities
type Side = { buy: null } | { sell: null };

// ============================================================================
// SWAP CALCULATION HELPERS
// ============================================================================

/**
 * Calculate expected swap output (simplified estimation)
 * For accurate quotes, use the backend quote_swap function
 *
 * @param amountIn - Input amount in input token decimals (raw bigint)
 * @param currentPrice - Price ratio (token1/token0, unitless)
 * @param feeBasisPoints - Pool fee in basis points (e.g., 3000 = 0.3%)
 * @param token0Decimals - Decimals for token0
 * @param token1Decimals - Decimals for token1
 * @param zeroForOne - True if swapping token0→token1, false for token1→token0
 * @returns Estimated output amount in output token decimals (raw bigint)
 */
export function estimateSwapOutput(
    amountIn: bigint,
    currentPrice: number,
    feeBasisPoints: number,
    token0Decimals: number,
    token1Decimals: number,
    zeroForOne: boolean
): bigint {
    const feeMultiplier = (Number(BASIS_POINTS_DIVISOR) - feeBasisPoints) / Number(BASIS_POINTS_DIVISOR);

    if (zeroForOne) {
        // Swapping token0 → token1
        // amountIn is in token0 decimals, output should be in token1 decimals
        // price = token1/token0, so output = amountIn * price
        const decimalAdjustment = 10 ** (token1Decimals - token0Decimals);
        const amountInNum = Number(amountIn);
        const outputNum = amountInNum * currentPrice * feeMultiplier * decimalAdjustment;
        return BigInt(Math.floor(outputNum));
    } else {
        // Swapping token1 → token0
        // amountIn is in token1 decimals, output should be in token0 decimals
        // price = token1/token0, so to get token0 output: output = amountIn / price
        const decimalAdjustment = 10 ** (token0Decimals - token1Decimals);
        const amountInNum = Number(amountIn);
        const outputNum = (amountInNum / currentPrice) * feeMultiplier * decimalAdjustment;
        return BigInt(Math.floor(outputNum));
    }
}

/**
 * Calculate swap quote with price impact consideration
 * This is a client-side approximation - use quote_swap for accurate quotes
 *
 * @param amountIn - Input amount in input token decimals (raw bigint)
 * @param liquidity - Pool liquidity
 * @param currentSqrtPrice - Current sqrt price
 * @param feeBasisPoints - Pool fee in basis points (e.g., 3000 = 0.3%)
 * @param token0Decimals - Decimals for token0
 * @param token1Decimals - Decimals for token1
 * @param zeroForOne - Swap direction (true = token0→token1, false = token1→token0)
 * @returns Estimated output and new sqrt price
 */
export function estimateSwapWithImpact(
    amountIn: bigint,
    liquidity: bigint,
    currentSqrtPrice: SqrtPriceX96,
    feeBasisPoints: number,
    token0Decimals: number,
    token1Decimals: number,
    zeroForOne: boolean
): { amountOut: bigint; newSqrtPrice: SqrtPriceX96; priceImpact: number } {
    // This is a simplified estimation
    // For production, always use quote_swap from the backend

    const price = sqrtPriceX96ToPrice(currentSqrtPrice, token0Decimals, token1Decimals);
    const feeMultiplier = (Number(BASIS_POINTS_DIVISOR) - feeBasisPoints) / Number(BASIS_POINTS_DIVISOR);

    // Normalize amountIn to token0 units for impact calculation
    const amountInNormalized = zeroForOne
        ? Number(amountIn) / (10 ** token0Decimals)
        : Number(amountIn) / (10 ** token1Decimals) / price;

    const liquidityNum = Number(liquidity);
    const impact = amountInNormalized / liquidityNum;

    // Adjust price based on direction and impact
    const newPrice = zeroForOne ? price * (1 - impact) : price * (1 + impact);
    const avgPrice = (price + newPrice) / 2;

    // Calculate output with proper decimal adjustment
    let amountOut: bigint;
    if (zeroForOne) {
        // token0 → token1
        const decimalAdjustment = 10 ** (token1Decimals - token0Decimals);
        const outputNum = Number(amountIn) * avgPrice * feeMultiplier * decimalAdjustment;
        amountOut = BigInt(Math.floor(outputNum));
    } else {
        // token1 → token0
        const decimalAdjustment = 10 ** (token0Decimals - token1Decimals);
        const outputNum = (Number(amountIn) / avgPrice) * feeMultiplier * decimalAdjustment;
        amountOut = BigInt(Math.floor(outputNum));
    }

    // Calculate price impact percentage
    const priceImpact = Math.abs((newPrice - price) / price) * 100;

    return {
        amountOut,
        newSqrtPrice: priceToSqrtPriceX96(newPrice),
        priceImpact
    };
}

/**
 * Validate swap parameters
 *
 * @param amount - Amount to swap
 * @param decimals - Token decimals
 * @param balance - User balance (optional)
 * @returns Validation result
 */
export function validateSwapAmount(
    amount: string,
    decimals: number,
    balance?: bigint
): { valid: boolean; error?: string } {
    // Use existing validateAmount
    const basicValidation = validateAmount(amount, decimals);
    if (!basicValidation.valid) {
        return basicValidation;
    }

    // Check balance if provided
    if (balance !== undefined) {
        try {
            const amountBigInt = stringToBigInt(amount, decimals);
            if (amountBigInt > balance) {
                return { valid: false, error: 'Insufficient balance' };
            }
        } catch (e) {
            return { valid: false, error: 'Invalid amount format' };
        }
    }

    return { valid: true };
}

/**
 * Validate slippage tolerance
 *
 * @param slippage - Slippage percentage (e.g., 0.5 for 0.5%)
 * @returns Validation result
 */
export function validateSlippage(slippage: number): { valid: boolean; error?: string } {
    if (isNaN(slippage) || slippage < 0) {
        return { valid: false, error: 'Slippage must be a positive number' };
    }

    if (slippage > 50) {
        return { valid: false, error: 'Slippage cannot exceed 50%' };
    }

    // Warn if very high (>5%)
    if (slippage > 5) {
        return {
            valid: true,
            error: 'Warning: High slippage tolerance (>5%)'
        };
    }

    // Warn if very low (<0.1%)
    if (slippage < 0.1) {
        return {
            valid: true,
            error: 'Warning: Very low slippage may cause transaction failures'
        };
    }

    return { valid: true };
}

/**
 * Format swap quote for display
 *
 * @param amountIn - Input amount
 * @param amountOut - Output amount
 * @param inDecimals - Input token decimals
 * @param outDecimals - Output token decimals
 * @param inSymbol - Input token symbol
 * @param outSymbol - Output token symbol
 * @returns Formatted string
 */
export function formatSwapQuote(
    amountIn: bigint,
    amountOut: bigint,
    inDecimals: number,
    outDecimals: number,
    inSymbol: string,
    outSymbol: string
): string {
    const inFormatted = bigIntToString(amountIn, inDecimals);
    const outFormatted = bigIntToString(amountOut, outDecimals);

    return `${inFormatted} ${inSymbol} → ${outFormatted} ${outSymbol}`;
}

/**
 * Calculate effective price from swap amounts
 * Returns the actual executed price (token1/token0 ratio)
 *
 * @param amountIn - Input amount in input token decimals (raw bigint)
 * @param amountOut - Output amount in output token decimals (raw bigint)
 * @param token0Decimals - Decimals for token0
 * @param token1Decimals - Decimals for token1
 * @param zeroForOne - Swap direction (true = token0→token1, false = token1→token0)
 * @returns Effective price ratio (token1/token0, unitless)
 */
export function calculateEffectivePrice(
    amountIn: bigint,
    amountOut: bigint,
    token0Decimals: number,
    token1Decimals: number,
    zeroForOne: boolean
): number {
    if (amountIn === 0n || amountOut === 0n) return 0;

    // Normalize both amounts to handle decimal differences
    const inNormalized = Number(amountIn) / (10 ** (zeroForOne ? token0Decimals : token1Decimals));
    const outNormalized = Number(amountOut) / (10 ** (zeroForOne ? token1Decimals : token0Decimals));

    // Calculate price as token1/token0
    return zeroForOne
        ? outNormalized / inNormalized  // output token1 / input token0
        : inNormalized / outNormalized; // input token1 / output token0 -> need to invert
}

// ============================================================================
// CLOB CONVERSION UTILITIES (V3 AMM → CLOB+V3 Hybrid)
// ============================================================================

/**
 * Convert AMM zeroForOne direction to CLOB Side
 *
 * @param zeroForOne - AMM swap direction
 *   - true = swap token0 → token1 (selling token0) → #sell
 *   - false = swap token1 → token0 (buying token0) → #buy
 * @returns CLOB Side enum
 *
 * @example
 * zeroForOneToSide(true)  // { sell: null } - selling token0 for token1
 * zeroForOneToSide(false) // { buy: null }  - buying token0 with token1
 */
export function zeroForOneToSide(zeroForOne: boolean): Side {
    return zeroForOne ? { sell: null } : { buy: null };
}

/**
 * Convert CLOB Side to AMM zeroForOne direction
 *
 * @param side - CLOB side enum
 * @returns AMM swap direction boolean
 *
 * @example
 * sideToZeroForOne({ sell: null }) // true  - swap token0 → token1
 * sideToZeroForOne({ buy: null })  // false - swap token1 → token0
 */
export function sideToZeroForOne(side: Side): boolean {
    return 'sell' in side; // #sell → true (token0 → token1)
}

/**
 * Calculate limit tick from current tick and slippage tolerance
 * Used for market orders (IOC limit orders) to specify max slippage
 *
 * @param currentTick - Current market tick
 * @param slippageBasisPoints - Slippage tolerance in bps (e.g., 50 = 0.5%)
 * @param side - Order side (buy or sell)
 * @returns Limit tick with slippage applied
 *
 * @example
 * // For a buy order with 0.5% slippage:
 * const limitTick = calculateLimitTickWithSlippage(79817, 50n, { buy: null });
 * // Returns higher tick (willing to pay more)
 *
 * // For a sell order with 0.5% slippage:
 * const limitTick = calculateLimitTickWithSlippage(79817, 50n, { sell: null });
 * // Returns lower tick (willing to receive less)
 */
export function calculateLimitTickWithSlippage(
    currentTick: Tick,
    slippageBasisPoints: bigint,
    side: Side,
    baseDecimals: number = 8,
    quoteDecimals: number = 8,
): Tick {
    const currentPrice = tickToPrice(currentTick, baseDecimals, quoteDecimals);
    const slippageMultiplier = Number(slippageBasisPoints) / Number(BASIS_POINTS_DIVISOR);

    let limitPrice: number;
    if ('buy' in side) {
        // Buying: willing to pay more (higher price = higher tick)
        limitPrice = currentPrice * (1 + slippageMultiplier);
    } else {
        // Selling: willing to receive less (lower price = lower tick)
        limitPrice = currentPrice * (1 - slippageMultiplier);
    }

    return priceToTick(limitPrice, baseDecimals, quoteDecimals);
}

/**
 * Format Side enum for display
 *
 * @param side - CLOB side enum
 * @returns Human-readable string
 *
 * @example
 * formatSide({ buy: null })  // "Buy"
 * formatSide({ sell: null }) // "Sell"
 */
export function formatSide(side: Side): 'Buy' | 'Sell' {
    return 'buy' in side ? 'Buy' : 'Sell';
}

/**
 * Check if order side is buy
 *
 * @param side - CLOB side enum
 * @returns true if buy order
 */
export function isBuyOrder(side: Side): boolean {
    return 'buy' in side;
}

/**
 * Check if order side is sell
 *
 * @param side - CLOB side enum
 * @returns true if sell order
 */
export function isSellOrder(side: Side): boolean {
    return 'sell' in side;
}
