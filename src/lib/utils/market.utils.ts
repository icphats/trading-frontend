/**
 * Market-specific formatting utilities
 *
 * Formatting functions for market data from the Indexer canister,
 * which uses fixed-point bigint representations:
 * - Prices: E12 (12 decimals)
 * - Volumes: E6 (6 decimals, USD accumulator precision)
 */

/**
 * Format price from E12 bigint (12 decimals) to USD display string.
 * Uses dynamic decimal precision based on value magnitude.
 *
 * @example
 * formatMarketPrice(1_500_000_000_000n) // "$1.50"
 * formatMarketPrice(500_000_000n)       // "$0.0005"
 * formatMarketPrice(0n)                 // "$0.00"
 */
export function formatMarketPrice(priceUsd: bigint): string {
	const value = Number(priceUsd) / 1e12;
	if (value === 0) return "$0.00";
	if (value < 0.01) return `$${value.toFixed(6)}`;
	if (value < 1) return `$${value.toFixed(4)}`;
	if (value < 1000) return `$${value.toFixed(2)}`;
	return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/**
 * Format volume from E6 bigint (USD accumulator precision) to compact display.
 *
 * @example
 * formatMarketVolume(1_500_000_000n) // "$1.5K"
 * formatMarketVolume(2_500_000_000_000n) // "$2.5M"
 * formatMarketVolume(0n) // "$0"
 */
export function formatMarketVolume(volume: bigint): string {
	const value = Number(volume) / 1e6;
	if (value === 0) return "$0";
	if (value < 1000) return `$${value.toFixed(0)}`;
	if (value < 1_000_000) return `$${(value / 1000).toFixed(1)}K`;
	if (value < 1_000_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
	return `$${(value / 1_000_000_000).toFixed(1)}B`;
}

/**
 * Format volume from a float (already converted from E6) to compact display.
 * Convenience overload when the E6→float conversion has already happened.
 *
 * @example
 * formatVolumeFloat(1500) // "$1.5K"
 * formatVolumeFloat(2500000) // "$2.5M"
 */
export function formatVolumeFloat(value: number): string {
	if (value === 0) return "$0";
	if (value < 1000) return `$${value.toFixed(0)}`;
	if (value < 1_000_000) return `$${(value / 1000).toFixed(1)}K`;
	if (value < 1_000_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
	return `$${(value / 1_000_000_000).toFixed(1)}B`;
}
