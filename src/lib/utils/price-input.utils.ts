/**
 * Pure utility functions for price input calculations.
 *
 * Extracted from TradePriceInput — these handle tick conversion
 * with directional rounding for slippage protection, and price/percentage
 * clamping for market orders.
 */

type Side = "Buy" | "Sell";

const MIN_TICK = -887272;
const MAX_TICK = 887272;

/**
 * Convert a human-readable price to a tick with directional rounding for slippage protection.
 *
 * In slippage mode (directional = true with side):
 * - Buy: rounds UP (higher tick = higher price = more slippage room)
 * - Sell: rounds DOWN (lower tick = lower price = more slippage room)
 *
 * In limit price mode (directional = false): rounds to nearest tick.
 */
export function priceToTickDirectional(
	targetPrice: number,
	opts: {
		token0Decimals: number;
		token1Decimals: number;
		tickSpacing: number;
		directional: boolean;
		side?: Side;
	},
): number {
	if (targetPrice <= 0) return MIN_TICK;
	if (!isFinite(targetPrice)) return MAX_TICK;

	const decimalAdjustment = Math.pow(10, opts.token0Decimals - opts.token1Decimals);
	const rawPrice = targetPrice / decimalAdjustment;
	const rawTick = Math.log(rawPrice) / Math.log(1.0001);

	let alignedTick: number;

	if (opts.directional && opts.side) {
		const division = rawTick / opts.tickSpacing;
		alignedTick =
			opts.side === "Buy"
				? Math.ceil(division) * opts.tickSpacing
				: Math.floor(division) * opts.tickSpacing;
	} else {
		alignedTick = Math.round(rawTick / opts.tickSpacing) * opts.tickSpacing;
	}

	return Math.max(MIN_TICK, Math.min(MAX_TICK, alignedTick));
}

/**
 * Clamp a price so it cannot cross the current market price.
 * - Buy: price cannot go below currentPrice (no better than market)
 * - Sell: price cannot go above currentPrice (no better than market)
 *
 * Returns targetPrice unchanged if clamping is not applicable.
 */
export function clampPrice(
	targetPrice: number,
	opts: {
		currentPrice: number | undefined;
		allowNegativeSlippage: boolean;
		side?: Side;
	},
): number {
	if (opts.allowNegativeSlippage || !opts.currentPrice || opts.currentPrice <= 0) {
		return targetPrice;
	}

	if (opts.side === "Buy") {
		return Math.max(targetPrice, opts.currentPrice);
	} else if (opts.side === "Sell") {
		return Math.min(targetPrice, opts.currentPrice);
	}

	return targetPrice;
}

/**
 * Clamp a percentage so it cannot represent negative slippage.
 * - Buy: percentage cannot go below 0
 * - Sell: percentage cannot go above 0
 *
 * Returns pct unchanged if negative slippage is allowed.
 */
export function clampPercentage(
	pct: number,
	opts: {
		allowNegativeSlippage: boolean;
		side?: Side;
	},
): number {
	if (opts.allowNegativeSlippage) {
		return pct;
	}

	if (opts.side === "Buy") {
		return Math.max(pct, 0);
	} else if (opts.side === "Sell") {
		return Math.min(pct, 0);
	}

	return pct;
}
