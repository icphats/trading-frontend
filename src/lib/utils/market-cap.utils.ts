/**
 * Market Cap Utilities
 * Pure functions for market cap calculations
 *
 * These are pure functions that take pre-fetched values.
 * Data fetching happens in the domain/repository layers.
 *
 * All market cap calculations use entityStore as the single source of truth:
 * - priceUsd: from indexer (consistent across all views)
 * - totalSupply: fetched during market hydration
 * - decimals: from token metadata
 *
 * Usage:
 * ```typescript
 * const token = entityStore.getToken(canisterId);
 * if (token?.totalSupply && token?.priceUsd) {
 *   const mcap = calculateMarketCap(token.totalSupply, token.priceUsd, token.decimals);
 * }
 * ```
 */

/**
 * Calculate market cap from pre-fetched values (pure function)
 *
 * @param totalSupply - Raw total supply (bigint from entityStore)
 * @param priceUsd - Current USD price (bigint E12, from entityStore.priceUsd per 06-Precision.md)
 * @param decimals - Token decimals (from entityStore)
 * @returns Market cap in USD as a number
 *
 * @example
 * const token = entityStore.getToken(canisterId);
 * const mcap = calculateMarketCap(token.totalSupply, token.priceUsd, token.decimals);
 */
export function calculateMarketCap(
  totalSupply: bigint,
  priceUsd: bigint,
  decimals: number
): number {
  const supply = Number(totalSupply) / Math.pow(10, decimals);
  const price = Number(priceUsd) / 1e12; // E12 precision per 06-Precision.md
  return supply * price;
}

/**
 * Calculate market cap with float price (convenience overload)
 *
 * Use this when you already have the USD price as a float
 * (e.g., from indexer data that's already been converted)
 *
 * @param totalSupply - Raw total supply (bigint)
 * @param priceUsdFloat - Current USD price as float
 * @param decimals - Token decimals
 * @returns Market cap in USD as a number
 */
export function calculateMarketCapFloat(
  totalSupply: bigint,
  priceUsdFloat: number,
  decimals: number
): number {
  const supply = Number(totalSupply) / Math.pow(10, decimals);
  return supply * priceUsdFloat;
}
