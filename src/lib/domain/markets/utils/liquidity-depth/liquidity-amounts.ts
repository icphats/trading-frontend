/**
 * Liquidity Amount Calculation Utilities
 *
 * Functions for calculating token amounts and USD values from liquidity data.
 * Adapts Uniswap V3's getAmount0/getAmount1 formulas.
 */

import { getAmountsForLiquidity } from "$lib/domain/markets/utils";
import { fromDecimals } from "$lib/utils/format.utils";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * E12 precision constant for USD prices.
 * All USD prices from the backend are in E12 format (12 decimal places).
 */
export const USD_DECIMALS = 12;

// ============================================================================
// AMOUNT CALCULATIONS
// ============================================================================

/**
 * Calculate token amounts locked in a tick range.
 * Adapts Uniswap V3's getAmount0/getAmount1 formulas based on where
 * the current tick falls relative to the range.
 *
 * @param tickLower - Lower tick of the range
 * @param tickUpper - Upper tick of the range
 * @param poolCurrentTick - Current tick of the pool
 * @param liquidity - Liquidity value for the range
 * @returns Object with amount0 and amount1 in native units
 *
 * @example
 * const { amount0, amount1 } = calculateAmountsLocked(-1000, 1000, 0, 1000000n);
 * // Returns amounts based on current tick position relative to range
 */
export function calculateAmountsLocked(
  tickLower: number,
  tickUpper: number,
  poolCurrentTick: number,
  liquidity: bigint
): { amount0: bigint; amount1: bigint } {
  if (liquidity <= 0n) {
    return { amount0: 0n, amount1: 0n };
  }

  try {
    const [amount0, amount1] = getAmountsForLiquidity(
      poolCurrentTick,
      tickLower,
      tickUpper,
      liquidity
    );
    return { amount0, amount1 };
  } catch {
    return { amount0: 0n, amount1: 0n };
  }
}

// ============================================================================
// USD VALUE CALCULATIONS
// ============================================================================

/**
 * Calculate USD value for token0 amount.
 *
 * @param amount - Token0 amount in native units
 * @param token0Decimals - Decimals for token0
 * @param token0PriceUsd - Token0 USD price in E12 format (null if unknown)
 * @returns USD value as number, or 0 if price unknown
 *
 * @example
 * const usd = calculateToken0UsdValue(100000000n, 8, 1000000000000n);
 * // Returns 1.0 ($1.00 for 1 token at $1 price)
 */
export function calculateToken0UsdValue(
  amount: bigint,
  token0Decimals: number,
  token0PriceUsd: bigint | null
): number {
  if (!token0PriceUsd || amount <= 0n) return 0;
  const amountNum = fromDecimals(amount, token0Decimals);
  const priceNum = fromDecimals(token0PriceUsd, USD_DECIMALS);
  return amountNum * priceNum;
}

/**
 * Calculate USD value for token1 amount.
 *
 * @param amount - Token1 amount in native units
 * @param token1Decimals - Decimals for token1
 * @param token1PriceUsd - Token1 USD price in E12 format (null if unknown)
 * @returns USD value as number, or 0 if price unknown
 *
 * @example
 * const usd = calculateToken1UsdValue(100000000n, 8, 10000000000000n);
 * // Returns 10.0 ($10.00 for 1 token at $10 price)
 */
export function calculateToken1UsdValue(
  amount: bigint,
  token1Decimals: number,
  token1PriceUsd: bigint | null
): number {
  if (!token1PriceUsd || amount <= 0n) return 0;
  const amountNum = fromDecimals(amount, token1Decimals);
  const priceNum = fromDecimals(token1PriceUsd, USD_DECIMALS);
  return amountNum * priceNum;
}

/**
 * Calculate total USD value for token amounts.
 *
 * @param amount0 - Token0 amount in native units
 * @param amount1 - Token1 amount in native units
 * @param token0Decimals - Decimals for token0
 * @param token1Decimals - Decimals for token1
 * @param token0PriceUsd - Token0 USD price in E12 format (null if unknown)
 * @param token1PriceUsd - Token1 USD price in E12 format (null if unknown)
 * @returns Total USD value as number
 *
 * @example
 * const totalUsd = calculateUsdValue(
 *   100000000n, 200000000n,
 *   8, 8,
 *   1000000000000n, 2000000000000n
 * );
 * // Returns 5.0 (1 token0 @ $1 + 2 token1 @ $2 = $5)
 */
export function calculateUsdValue(
  amount0: bigint,
  amount1: bigint,
  token0Decimals: number,
  token1Decimals: number,
  token0PriceUsd: bigint | null,
  token1PriceUsd: bigint | null
): number {
  return (
    calculateToken0UsdValue(amount0, token0Decimals, token0PriceUsd) +
    calculateToken1UsdValue(amount1, token1Decimals, token1PriceUsd)
  );
}

// ============================================================================
// TOTALS CALCULATION
// ============================================================================

/**
 * Result of total amounts calculation.
 */
export interface TotalAmounts {
  /** Total token0 amount across all buckets */
  amount0: bigint;
  /** Total token1 amount across all buckets */
  amount1: bigint;
  /** USD value of total token0 */
  usd0: number;
  /** USD value of total token1 */
  usd1: number;
  /** Total USD value (usd0 + usd1) */
  totalUsd: number;
}

/**
 * Calculate total amounts from liquidity buckets.
 *
 * @param buckets - Array of liquidity buckets
 * @param token0Decimals - Decimals for token0
 * @param token1Decimals - Decimals for token1
 * @param token0PriceUsd - Token0 USD price in E12 format
 * @param token1PriceUsd - Token1 USD price in E12 format
 * @returns Total amounts and USD values
 *
 * @example
 * const totals = calculateTotalAmounts(buckets, 8, 8, price0, price1);
 * // Returns { amount0: 1000n, amount1: 2000n, usd0: 10, usd1: 20, totalUsd: 30 }
 */
export function calculateTotalAmounts(
  buckets: Array<{ amount0Locked: bigint; amount1Locked: bigint }>,
  token0Decimals: number,
  token1Decimals: number,
  token0PriceUsd: bigint | null,
  token1PriceUsd: bigint | null
): TotalAmounts {
  let totalAmount0 = 0n;
  let totalAmount1 = 0n;

  for (const bucket of buckets) {
    totalAmount0 += bucket.amount0Locked;
    totalAmount1 += bucket.amount1Locked;
  }

  const usd0 = calculateToken0UsdValue(
    totalAmount0,
    token0Decimals,
    token0PriceUsd
  );
  const usd1 = calculateToken1UsdValue(
    totalAmount1,
    token1Decimals,
    token1PriceUsd
  );

  return {
    amount0: totalAmount0,
    amount1: totalAmount1,
    usd0,
    usd1,
    totalUsd: usd0 + usd1,
  };
}
