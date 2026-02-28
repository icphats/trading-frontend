/**
 * USD Price Utilities
 * Convert token prices to USD using quote token context
 *
 * These are PURE functions - they take ICP price as input to enable
 * reactive updates when used with pricingService.icpUsdPrice
 *
 * Usage in components:
 * ```ts
 * import { pricingService } from '$lib/domain/tokens/state/pricing.svelte';
 * import { getOrderBookTokenUsdPrice } from '$lib/domain/tokens/utils';
 *
 * // Read reactive ICP price (establishes dependency)
 * const icpPrice = pricingService.icpUsdPrice;
 *
 * // Pass to utility (will re-run when icpPrice updates)
 * const usdPrice = getOrderBookTokenUsdPrice('base', midpoint, quoteToken, icpPrice);
 * ```
 */

import type { QuoteToken } from '$lib/domain/markets/quote-token.types';

/**
 * Get USD price for the quote token (E12 bigint - 12 decimals)
 * - ICP: uses provided icpUsdPrice
 * - USDC/USDT: $1.00 (USD-pegged)
 *
 * @param quoteToken - The quote token type (ICP, USDC, or USDT)
 * @param icpUsdPrice - ICP/USD price from pricingService.icpUsdPrice (E12 - 12 decimals), or null if not loaded
 * @returns Price in USD (E12 bigint - 12 decimals), or null if unavailable
 */
export function getQuoteTokenUsdPrice(
  quoteToken: QuoteToken,
  icpUsdPrice: bigint | null
): bigint | null {
  if ('ICP' in quoteToken) {
    return icpUsdPrice;
  }

  // USDC/USDT are $1.00 = 1_000_000_000_000 in E12 (12 decimals)
  return 1_000_000_000_000n;
}

/**
 * Get USD price for the base token using midpoint and quote token
 *
 * @param midpointPrice - Midpoint price of base in quote token (number, e.g., 0.05 = 0.05 ICP)
 * @param quoteToken - The quote token type
 * @param icpUsdPrice - ICP/USD price from pricingService.icpUsdPrice (E12 - 12 decimals), or null if not loaded
 * @returns Price in USD (E12 bigint - 12 decimals), or null if unavailable
 *
 * @example
 * // PARTY at 0.05 ICP, ICP = $12
 * getBaseTokenUsdPrice(0.05, { ICP: null }, 12_000_000_000_000n) // Returns 600_000_000_000n ($0.60)
 */
export function getBaseTokenUsdPrice(
  midpointPrice: number,
  quoteToken: QuoteToken,
  icpUsdPrice: bigint | null
): bigint | null {
  const quoteUsd = getQuoteTokenUsdPrice(quoteToken, icpUsdPrice);
  if (quoteUsd === null) return null;

  // midpointPrice is a float (e.g., 0.05 means 0.05 ICP per token)
  // quoteUsd is E12 (e.g., 12_000_000_000_000n = $12 ICP)
  // Result: midpointPrice * quoteUsd = USD price in E12
  const usdPrice = BigInt(Math.round(midpointPrice * Number(quoteUsd)));
  return usdPrice;
}

/**
 * Get USD price for a token in the order book context
 * Uses midpoint price for base token, direct conversion for quote token
 *
 * @param tokenType - "base" or "quote"
 * @param midpointPrice - Midpoint price of base in quote token (number)
 * @param quoteToken - The quote token type
 * @param icpUsdPrice - ICP/USD price from pricingService.icpUsdPrice (E12 - 12 decimals), or null if not loaded
 * @returns Price in USD (E12 bigint - 12 decimals), or null if unavailable
 *
 * @example
 * // For base token (PARTY) at 0.05 ICP, ICP = $12
 * getOrderBookTokenUsdPrice("base", 0.05, { ICP: null }, 12_000_000_000_000n) // $0.60
 *
 * @example
 * // For quote token (ICP)
 * getOrderBookTokenUsdPrice("quote", 0.05, { ICP: null }, 12_000_000_000_000n) // $12
 */
export function getOrderBookTokenUsdPrice(
  tokenType: 'base' | 'quote',
  midpointPrice: number,
  quoteToken: QuoteToken,
  icpUsdPrice: bigint | null
): bigint | null {
  if (tokenType === 'quote') {
    return getQuoteTokenUsdPrice(quoteToken, icpUsdPrice);
  }
  return getBaseTokenUsdPrice(midpointPrice, quoteToken, icpUsdPrice);
}
