/**
 * Liquidity Amount Calculation Utilities
 *
 * Functions for calculating token amounts and USD values from liquidity data.
 * Adapts Uniswap V3's getAmountBase/getAmountQuote formulas.
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
 * @returns Object with amountBase and amountQuote in native units
 *
 * @example
 * const { amountBase, amountQuote } = calculateAmountsLocked(-1000, 1000, 0, 1000000n);
 * // Returns amounts based on current tick position relative to range
 */
export function calculateAmountsLocked(
  tickLower: number,
  tickUpper: number,
  poolCurrentTick: number,
  liquidity: bigint
): { amountBase: bigint; amountQuote: bigint } {
  if (liquidity <= 0n) {
    return { amountBase: 0n, amountQuote: 0n };
  }

  try {
    const [amountBase, amountQuote] = getAmountsForLiquidity(
      poolCurrentTick,
      tickLower,
      tickUpper,
      liquidity
    );
    return { amountBase, amountQuote };
  } catch {
    return { amountBase: 0n, amountQuote: 0n };
  }
}

// ============================================================================
// USD VALUE CALCULATIONS
// ============================================================================

/**
 * Calculate USD value for base token amount.
 *
 * @param amount - Base token amount in native units
 * @param baseDecimals - Decimals for base token
 * @param basePriceUsd - Base token USD price in E12 format (null if unknown)
 * @returns USD value as number, or 0 if price unknown
 *
 * @example
 * const usd = calculateBaseUsdValue(100000000n, 8, 1000000000000n);
 * // Returns 1.0 ($1.00 for 1 token at $1 price)
 */
export function calculateBaseUsdValue(
  amount: bigint,
  baseDecimals: number,
  basePriceUsd: bigint | null
): number {
  if (!basePriceUsd || amount <= 0n) return 0;
  const amountNum = fromDecimals(amount, baseDecimals);
  const priceNum = fromDecimals(basePriceUsd, USD_DECIMALS);
  return amountNum * priceNum;
}

/**
 * Calculate USD value for quote token amount.
 *
 * @param amount - Quote token amount in native units
 * @param quoteDecimals - Decimals for quote token
 * @param quotePriceUsd - Quote token USD price in E12 format (null if unknown)
 * @returns USD value as number, or 0 if price unknown
 *
 * @example
 * const usd = calculateQuoteUsdValue(100000000n, 8, 10000000000000n);
 * // Returns 10.0 ($10.00 for 1 token at $10 price)
 */
export function calculateQuoteUsdValue(
  amount: bigint,
  quoteDecimals: number,
  quotePriceUsd: bigint | null
): number {
  if (!quotePriceUsd || amount <= 0n) return 0;
  const amountNum = fromDecimals(amount, quoteDecimals);
  const priceNum = fromDecimals(quotePriceUsd, USD_DECIMALS);
  return amountNum * priceNum;
}

/**
 * Calculate total USD value for token amounts.
 *
 * @param amountBase - Base token amount in native units
 * @param amountQuote - Quote token amount in native units
 * @param baseDecimals - Decimals for base token
 * @param quoteDecimals - Decimals for quote token
 * @param basePriceUsd - Base token USD price in E12 format (null if unknown)
 * @param quotePriceUsd - Quote token USD price in E12 format (null if unknown)
 * @returns Total USD value as number
 *
 * @example
 * const totalUsd = calculateUsdValue(
 *   100000000n, 200000000n,
 *   8, 8,
 *   1000000000000n, 2000000000000n
 * );
 * // Returns 5.0 (1 base @ $1 + 2 quote @ $2 = $5)
 */
export function calculateUsdValue(
  amountBase: bigint,
  amountQuote: bigint,
  baseDecimals: number,
  quoteDecimals: number,
  basePriceUsd: bigint | null,
  quotePriceUsd: bigint | null
): number {
  return (
    calculateBaseUsdValue(amountBase, baseDecimals, basePriceUsd) +
    calculateQuoteUsdValue(amountQuote, quoteDecimals, quotePriceUsd)
  );
}

// ============================================================================
// TOTALS CALCULATION
// ============================================================================

/**
 * Result of total amounts calculation.
 */
export interface TotalAmounts {
  /** Total base token amount across all buckets */
  amountBase: bigint;
  /** Total quote token amount across all buckets */
  amountQuote: bigint;
  /** USD value of total base token */
  usdBase: number;
  /** USD value of total quote token */
  usdQuote: number;
  /** Total USD value (usd0 + usd1) */
  totalUsd: number;
}

/**
 * Calculate total amounts from liquidity buckets.
 *
 * @param buckets - Array of liquidity buckets
 * @param baseDecimals - Decimals for base token
 * @param quoteDecimals - Decimals for quote token
 * @param basePriceUsd - Base token USD price in E12 format
 * @param quotePriceUsd - Quote token USD price in E12 format
 * @returns Total amounts and USD values
 *
 * @example
 * const totals = calculateTotalAmounts(buckets, 8, 8, price0, price1);
 * // Returns { amountBase: 1000n, amountQuote: 2000n, usdBase: 10, usdQuote: 20, totalUsd: 30 }
 */
export function calculateTotalAmounts(
  buckets: Array<{ amountBaseLocked: bigint; amountQuoteLocked: bigint }>,
  baseDecimals: number,
  quoteDecimals: number,
  basePriceUsd: bigint | null,
  quotePriceUsd: bigint | null
): TotalAmounts {
  let totalAmountBase = 0n;
  let totalAmountQuote = 0n;

  for (const bucket of buckets) {
    totalAmountBase += bucket.amountBaseLocked;
    totalAmountQuote += bucket.amountQuoteLocked;
  }

  const usdBase = calculateBaseUsdValue(
    totalAmountBase,
    baseDecimals,
    basePriceUsd
  );
  const usdQuote = calculateQuoteUsdValue(
    totalAmountQuote,
    quoteDecimals,
    quotePriceUsd
  );

  return {
    amountBase: totalAmountBase,
    amountQuote: totalAmountQuote,
    usdBase,
    usdQuote,
    totalUsd: usdBase + usdQuote,
  };
}
