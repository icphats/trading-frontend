import { MILLISECONDS_IN_DAY, NANO_SECONDS_IN_MILLISECOND } from '$lib/constants/app.constants';
import { Languages } from './languages.utils';
import type { AmountString } from '$lib/types/amount';
import { isNullish, nonNullish } from '@dfinity/utils';
import Decimal from 'decimal.js';
import { formatUnits, type BigNumberish } from 'ethers/utils';

const DEFAULT_DECIMALS = 8;
const DEFAULT_DISPLAY_DECIMALS = 4;
const MAX_DEFAULT_DISPLAY_DECIMALS = 8;

interface FormatTokenParams {
	value: bigint;
	unitName?: string | BigNumberish;
	displayDecimals?: number;
	trailingZeros?: boolean;
	showPlusSign?: boolean;
	commas?: boolean;
	short?: boolean;
}

interface FormatDecimalParams {
	value: number;
	displayDecimals?: number;
	trailingZeros?: boolean;
	showPlusSign?: boolean;
	commas?: boolean;
	short?: boolean;
}

export const formatToken = ({
	value,
	unitName = DEFAULT_DECIMALS,
	displayDecimals,
	trailingZeros = false,
	showPlusSign = false,
	commas = false,
	short = false
}: FormatTokenParams): AmountString => {
	const parsedUnitName: BigNumberish =
		typeof unitName === 'number' || typeof unitName === 'bigint'
			? unitName
			: /^\d+$/.test(unitName)
				? BigInt(unitName)
				: unitName;

	const res = formatUnits(value, parsedUnitName);

	// Handle short format with suffixes (k, m, b)
	if (short) {
		const num = parseFloat(res);

		if (num === 0) return '0';
		if (!isFinite(num)) return '0'; // Return '0' instead of '--' to match AmountString type

		const absNum = Math.abs(num);
		const isNegative = num < 0;

		const formatWithSuffix = (value: number, suffix: string): AmountString => {
			const valueStr = Math.abs(value).toFixed(2);

			// Always display 3 significant digits
			let result: string;
			switch(valueStr.length) {
				case 4: // 1.32m -> 1.32m
					result = value.toFixed(2);
					break;
				case 5: // 13.24k -> 13.2k
					result = value.toFixed(1);
					break;
				default: // 132.45k -> 132k
					result = value.toFixed(0);
					break;
			}

			const sign = (showPlusSign && num > 0) ? '+' : (isNegative ? '-' : '');
			return `${sign}${result}${suffix}` as AmountString;
		};

		if (absNum >= 1_000_000_000) {
			return formatWithSuffix(absNum / 1_000_000_000, 'b');
		} else if (absNum >= 1_000_000) {
			return formatWithSuffix(absNum / 1_000_000, 'm');
		} else if (absNum >= 1_000) {
			return formatWithSuffix(absNum / 1_000, 'k');
		} else {
			// For small numbers, fall through to normal formatting
			// but still apply regular formatting options
		}
	}

	const match = res.match(/^0\.0*/);
	const leadingZeros = match ? match[0].length - 2 : 0;

	if (isNullish(displayDecimals) && leadingZeros >= MAX_DEFAULT_DISPLAY_DECIMALS) {
		return '< 0.00000001';
	}

	const maxFractionDigits = Math.min(leadingZeros + 2, MAX_DEFAULT_DISPLAY_DECIMALS);
	const minFractionDigits = displayDecimals ?? DEFAULT_DISPLAY_DECIMALS;

	const dec = new Decimal(res);
	const maxDigits =
		displayDecimals ?? (leadingZeros > 2 ? maxFractionDigits : DEFAULT_DISPLAY_DECIMALS);
	const decDP = dec.toDecimalPlaces(maxDigits);
	const minDigits = trailingZeros ? Math.max(minFractionDigits, maxDigits) : undefined;

	let formatted = decDP.toFixed(minDigits) as `${number}`;

	// Add comma separators if requested
	if (commas) {
		const parts = formatted.split('.');
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		formatted = parts.join('.') as `${number}`;
	}

	if (trailingZeros) {
		return formatted;
	}

	const plusSign = showPlusSign && +res > 0 ? '+' : '';
	return `${plusSign}${formatted}`;
};

export const formatDecimal = ({
	value,
	displayDecimals,
	trailingZeros = false,
	showPlusSign = false,
	commas = false,
	short = false
}: FormatDecimalParams): AmountString => {
	// Handle short format with suffixes (k, m, b)
	if (short) {
		if (value === 0) return '0';
		if (!isFinite(value)) return '0';

		const absNum = Math.abs(value);
		const isNegative = value < 0;

		const formatWithSuffix = (val: number, suffix: string): AmountString => {
			const valueStr = Math.abs(val).toFixed(2);

			// Always display 3 significant digits
			let result: string;
			switch (valueStr.length) {
				case 4: // 1.32m -> 1.32m
					result = val.toFixed(2);
					break;
				case 5: // 13.24k -> 13.2k
					result = val.toFixed(1);
					break;
				default: // 132.45k -> 132k
					result = val.toFixed(0);
					break;
			}

			const sign = showPlusSign && value > 0 ? '+' : isNegative ? '-' : '';
			return `${sign}${result}${suffix}` as AmountString;
		};

		if (absNum >= 1_000_000_000) {
			return formatWithSuffix(absNum / 1_000_000_000, 'b');
		} else if (absNum >= 1_000_000) {
			return formatWithSuffix(absNum / 1_000_000, 'm');
		} else if (absNum >= 1_000) {
			return formatWithSuffix(absNum / 1_000, 'k');
		}
		// For small numbers, fall through to normal formatting
	}

	const res = value.toString();
	const match = res.match(/^0\.0*/);
	const leadingZeros = match ? match[0].length - 2 : 0;

	if (isNullish(displayDecimals) && leadingZeros >= MAX_DEFAULT_DISPLAY_DECIMALS) {
		return '< 0.00000001';
	}

	const maxFractionDigits = Math.min(leadingZeros + 2, MAX_DEFAULT_DISPLAY_DECIMALS);
	const minFractionDigits = displayDecimals ?? DEFAULT_DISPLAY_DECIMALS;

	const dec = new Decimal(res);
	const maxDigits =
		displayDecimals ?? (leadingZeros > 2 ? maxFractionDigits : DEFAULT_DISPLAY_DECIMALS);
	const decDP = dec.toDecimalPlaces(maxDigits);
	const minDigits = trailingZeros ? Math.max(minFractionDigits, maxDigits) : undefined;

	let formatted = decDP.toFixed(minDigits) as `${number}`;

	// Add comma separators if requested
	if (commas) {
		const parts = formatted.split('.');
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		formatted = parts.join('.') as `${number}`;
	}

	if (trailingZeros) {
		return formatted;
	}

	const plusSign = showPlusSign && value > 0 ? '+' : '';
	return `${plusSign}${formatted}`;
};

const DATE_TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false
};

export const formatSecondsToDate = ({
	seconds,
	language,
	formatOptions
}: {
	seconds: number;
	language?: Languages;
	formatOptions?: Intl.DateTimeFormatOptions;
}): string => {
	const date = new Date(seconds * 1000);
	return date.toLocaleDateString(
		language ?? Languages.ENGLISH,
		nonNullish(formatOptions)
			? { ...DATE_TIME_FORMAT_OPTIONS, ...formatOptions }
			: DATE_TIME_FORMAT_OPTIONS
	);
};

export const formatNanosecondsToDate = ({
	nanoseconds,
	language
}: {
	nanoseconds: bigint;
	language?: Languages;
}): string => {
	const date = new Date(Number(nanoseconds / NANO_SECONDS_IN_MILLISECOND));
	return date.toLocaleDateString(language ?? Languages.ENGLISH, DATE_TIME_FORMAT_OPTIONS);
};

export const formatNanosecondsToTimestamp = (nanoseconds: bigint): number => {
	const date = new Date(Number(nanoseconds / NANO_SECONDS_IN_MILLISECOND));
	return date.getTime();
};

export const formatNanosecondsToHH_MM_SS = (nanoseconds: bigint): string => {
	// Convert nanoseconds to milliseconds
	const milliseconds = Number(nanoseconds / NANO_SECONDS_IN_MILLISECOND);
	const date = new Date(milliseconds);

	// Format as HH:MM:SS
	const hours = date.getHours().toString().padStart(2, '0');
	const minutes = date.getMinutes().toString().padStart(2, '0');
	const seconds = date.getSeconds().toString().padStart(2, '0');

	return `${hours}:${minutes}:${seconds}`;
};

// export const formatToShortDateString = ({ date, i18n }: { date: Date; i18n: I18n }): string =>
// 	date.toLocaleDateString(i18n?.lang ?? Languages.ENGLISH, { month: 'short' });

const getRelativeTimeFormatter = (language?: Languages) =>
	new Intl.RelativeTimeFormat(language ?? Languages.ENGLISH, { numeric: 'auto' });

/** Formats a number of seconds to a normalised date string.
 *
 * If the date is within the same year, it returns the day and month name.
 * If the date is in a different year, it returns the day, month, and year.
 * If the date is within 2 days, it returns a relative time format (today or yesterday).
 * It accepts an optional currentDate parameter to compare the date with. Otherwise, it uses the current date.
 *
 * @param {Object} params - The options object.
 * @param {number} params.seconds - The number of seconds to format.
 * @param {Date} [params.currentDate] - The date to compare with. Defaults to the current date.
 */

export const formatSecondsToNormalizedDate = ({
	seconds,
	currentDate,
	language
}: {
	seconds: number;
	currentDate?: Date;
	language?: Languages;
}): string => {
	const date = new Date(seconds * 1000);
	const today = currentDate ?? new Date();

	// TODO: add additional test suite for the below calculations
	const dateUTC = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
	const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
	const daysDifference = Math.ceil((dateUTC - todayUTC) / MILLISECONDS_IN_DAY);

	if (Math.abs(daysDifference) < 2) {
		// TODO: When the method is called many times with the same arguments, it is better to create a Intl.DateTimeFormat object and use its format() method, because a DateTimeFormat object remembers the arguments passed to it and may decide to cache a slice of the database, so future format calls can search for localization strings within a more constrained context.
		return getRelativeTimeFormatter(language).format(daysDifference, 'day');
	}

	// Same year, return day and month name
	if (date.getFullYear() === today.getFullYear()) {
		return date.toLocaleDateString(language ?? Languages.ENGLISH, {
			day: 'numeric',
			month: 'long'
		});
	}

	// Different year, return day, month, and year
	return date.toLocaleDateString(language ?? Languages.ENGLISH, {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
};

/**
 * Format a number with locale-specific formatting
 * @param value - The number to format (or null)
 * @param options - Intl.NumberFormatOptions for customization
 * @returns Formatted string or "—" for null/NaN values
 */
export function formatNumber(
	value: number | null,
	options: Intl.NumberFormatOptions = {}
): string {
	if (value === null || Number.isNaN(value)) return '—';
	return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4, ...options }).format(value);
}

/**
 * Format a number as USD currency
 * @param value - The number to format (or null)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string like "$1,234.56" or "—" for null/NaN values
 */
export function formatUSD(value: number | null, decimals = 2): string {
	if (value === null || Number.isNaN(value)) return '—';
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	}).format(value);
}

// ============================================================================
// BIGINT ↔ STRING CONVERSIONS (Token Amounts)
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
	const trimmedFraction = trimTrailingZeros ? fractionalPart.replace(/0+$/, '') : fractionalPart;

	// Construct final string
	const result = trimmedFraction ? `${integerPart}.${trimmedFraction}` : integerPart;

	return isNegative ? `-${result}` : result;
}

// ============================================================================
// PRICE FORMATTING (for orderbook prices, ratios, not token amounts)
// ============================================================================

/**
 * Format a number to N significant figures
 * The canonical way to format prices throughout the app
 *
 * @param value - The number to format
 * @param sigFigs - Number of significant figures (default: 5)
 * @param options - Formatting options
 * @param options.commas - Add thousand separators (default: false)
 * @param options.trailingZeros - Keep trailing zeros to fill sigFigs (default: true)
 * @param options.subscriptZeros - Use subscript notation for leading zeros, e.g. 0.0₃343 (default: false)
 * @returns Formatted string
 *
 * @example
 * formatSigFig(123456.789) // "123460" (5 sig figs, rounds)
 * formatSigFig(1234.56789) // "1234.6" (5 sig figs)
 * formatSigFig(0.000343) // "0.000343"
 * formatSigFig(0.000343, 5, { subscriptZeros: true }) // "0.0₃343"
 * formatSigFig(0.00000012345, 5, { subscriptZeros: true }) // "0.0₇12345"
 */
export function formatSigFig(
	value: number,
	sigFigs: number = 5,
	options: { commas?: boolean; trailingZeros?: boolean; subscriptZeros?: boolean } = {}
): string {
	const { commas = false, trailingZeros = true, subscriptZeros = false } = options;

	// Treat tiny floating-point noise as zero to prevent Y-axis blowup
	if (value === 0 || Math.abs(value) < 1e-10) return '0';
	if (!isFinite(value)) return '—';

	const absValue = Math.abs(value);
	const sign = value < 0 ? '-' : '';

	// Use toPrecision for significant figures, then clean up
	let formatted = absValue.toPrecision(sigFigs);

	// toPrecision may return scientific notation for very small/large numbers
	// Convert back to decimal notation
	if (formatted.includes('e')) {
		const num = parseFloat(formatted);
		// Calculate decimals needed
		if (num >= 1) {
			const intDigits = Math.floor(Math.log10(num)) + 1;
			const decimals = Math.max(0, sigFigs - intDigits);
			formatted = num.toFixed(decimals);
		} else {
			// For small numbers, find leading zeros and add sigFigs after
			const expMatch = formatted.match(/e([+-]\d+)/);
			if (expMatch) {
				const exp = parseInt(expMatch[1]);
				const decimals = Math.abs(exp) + sigFigs - 1;
				formatted = num.toFixed(decimals);
			}
		}
	}

	// Remove trailing zeros unless explicitly requested
	if (!trailingZeros && formatted.includes('.')) {
		formatted = formatted.replace(/\.?0+$/, '');
	}

	// Convert leading zeros to subscript notation (e.g., 0.000343 → 0.0₃343)
	// Only applies when there are 2+ leading zeros after decimal point
	if (subscriptZeros && formatted.includes('.')) {
		const match = formatted.match(/^0\.(0{2,})/);
		if (match) {
			const zeroCount = match[1].length;
			const subscriptDigits = '₀₁₂₃₄₅₆₇₈₉';
			const subscriptNum = zeroCount.toString().split('').map(d => subscriptDigits[parseInt(d)]).join('');
			const rest = formatted.slice(2 + zeroCount); // everything after "0." and the zeros
			formatted = `0.0${subscriptNum}${rest}`;
		}
	}

	// Add commas if requested
	if (commas) {
		const parts = formatted.split('.');
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		formatted = parts.join('.');
	}

	return sign + formatted;
}

/**
 * Format a price ratio for display (orderbook prices, exchange rates)
 * @deprecated Use formatSigFig() instead for consistent significant figures formatting
 *
 * Prices are numeric values (not token amounts) that need specific decimal precision
 *
 * @param price - Price as a number
 * @param minDecimals - Minimum decimal places to show (default: 2)
 * @param maxDecimals - Maximum decimal places to show (default: 8)
 * @param trailingZeros - Keep trailing zeros (default: true)
 * @returns Formatted price string
 */
export function formatPrice(
	price: number,
	minDecimals: number = 2,
	maxDecimals: number = 8,
	trailingZeros: boolean = true
): string {
	if (price === 0) return '0';
	if (!isFinite(price)) return '—';

	const absPrice = Math.abs(price);

	// Determine decimals to show
	let decimals = maxDecimals; // Default to maxDecimals for full precision

	// For very small numbers (< 1), might need even more decimals to show value
	if (absPrice < 1 && absPrice > 0) {
		const priceStr = absPrice.toExponential();
		const exponent = parseInt(priceStr.split('e')[1]);
		if (exponent < 0) {
			// For 0.0001234, show leading zeros + significant digits
			decimals = Math.min(Math.abs(exponent) + 4, maxDecimals);
		}
	}

	// Format with calculated decimals
	let formatted = price.toFixed(decimals);

	// Remove trailing zeros if requested, but keep at least minDecimals
	if (!trailingZeros) {
		const parts = formatted.split('.');
		if (parts[1]) {
			// Trim trailing zeros but keep minDecimals
			let fractional = parts[1];
			while (fractional.length > minDecimals && fractional.endsWith('0')) {
				fractional = fractional.slice(0, -1);
			}
			formatted = fractional.length > 0 ? `${parts[0]}.${fractional}` : parts[0];
		}
	}

	return formatted;
}

// ============================================================================
// TOKEN USD VALUE CALCULATION
// ============================================================================

/**
 * Calculate USD value for a token amount
 * Used in trading UIs to show USD equivalents
 *
 * @param amount - Token amount as string (e.g., "1000.5")
 * @param tokenUsdPrice - Token's USD price as bigint
 * @param priceDecimals - Decimals for the price (usually 8)
 * @returns USD value as number, or null if invalid
 *
 * @example
 * calculateTokenUsdValue("100", 50000000n, 8) // 50 (100 tokens * $0.50)
 * calculateTokenUsdValue("", 50000000n, 8) // null
 */
export function calculateTokenUsdValue(
	amount: string,
	tokenUsdPrice: bigint,
	priceDecimals: number
): number | null {
	if (!amount || parseFloat(amount) <= 0) return null;
	const priceNum = Number(tokenUsdPrice) / Math.pow(10, priceDecimals);
	return parseFloat(amount) * priceNum;
}

/**
 * Calculate display decimals for a price (4 significant digits)
 * Used to show appropriate precision for different price ranges
 *
 * @param price - Price to calculate decimals for
 * @returns Number of decimal places to display (2-8)
 *
 * @example
 * getDisplayDecimals(1.23) // 2
 * getDisplayDecimals(0.00012) // 6
 */
export function getDisplayDecimals(price: number): number {
	if (price >= 1) return 2;
	if (price === 0) return 2;

	const priceStr = price.toString();
	const match = priceStr.match(/^0\.0*/);

	if (!match) return 2;

	const leadingZeros = match[0].length - 2;
	const decimals = leadingZeros + 4;

	return Math.min(decimals, 8);
}

// ============================================================================
// TABLE/EXPLORE PAGE FORMATTING
// ============================================================================

/**
 * Format a number as compact USD (e.g., "$1.2M", "$523K", "$45.2B")
 * Used in data tables for TVL, volume, market cap display
 *
 * @param num - Number to format
 * @returns Formatted string like "$1.2M" or "$523K"
 *
 * @example
 * formatCompactUSD(1234567890) // "$1.2B"
 * formatCompactUSD(1234567) // "$1.2M"
 * formatCompactUSD(1234) // "$1.2K"
 * formatCompactUSD(123) // "$123.00"
 */
export function formatCompactUSD(num: number): string {
	if (num >= 1_000_000_000_000) {
		return `$${(num / 1_000_000_000_000).toFixed(2)}T`;
	} else if (num >= 1_000_000_000) {
		return `$${(num / 1_000_000_000).toFixed(1)}B`;
	} else if (num >= 1_000_000) {
		return `$${(num / 1_000_000).toFixed(1)}M`;
	} else if (num >= 1_000) {
		return `$${(num / 1_000).toFixed(1)}K`;
	}
	return `$${num.toFixed(2)}`;
}

/**
 * Format a price with dynamic decimals based on value magnitude
 * Used in explore tables for token price display
 *
 * @param price - Price to format
 * @returns Formatted USD price string
 *
 * @example
 * formatTokenPrice(1234.56) // "$1,234.6"
 * formatTokenPrice(0.00012345) // "$0.0₃12345"
 */
export function formatTokenPrice(price: number): string {
	return `$${formatSigFig(price, 5, { commas: true, subscriptZeros: true })}`;
}

/**
 * Format a percentage change value (absolute, no sign)
 * Used with DeltaArrow component for directional indicators
 *
 * @param change - Percentage change value
 * @returns Formatted string like "12.34%"
 *
 * @example
 * formatPercentChange(12.345) // "12.35%"
 * formatPercentChange(-5.5) // "5.50%"
 */
export function formatPercentChange(change: number): string {
	const abs = Math.abs(change);
	return `${abs.toFixed(2)}%`;
}

/**
 * Format a percentage value (with sign capability)
 * Used for APR, fees, and other percentage displays
 *
 * @param value - Percentage value
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string like "12.34%"
 *
 * @example
 * formatPercent(12.345) // "12.35%"
 * formatPercent(0.5, 1) // "0.5%"
 */
export function formatPercent(value: number, decimals = 2): string {
	return `${value.toFixed(decimals)}%`;
}

/**
 * Format a percentage with explicit +/- sign prefix
 * Used in market lists and price change displays
 *
 * @example
 * formatSignedPercent(2.5)   // "+2.50%"
 * formatSignedPercent(-1.3)  // "-1.30%"
 * formatSignedPercent(0)     // "+0.00%"
 */
export function formatSignedPercent(value: number, decimals = 2): string {
	const sign = value >= 0 ? "+" : "";
	return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format pips as percentage
 * Used for fee tier display (e.g., 3000 pips -> "0.30%")
 * 1 pip = 0.0001% = 1/1,000,000
 *
 * @param pips - Value in pips (100-10000 for fees)
 * @returns Formatted percentage string
 *
 * @example
 * formatPipsAsPercent(3000) // "0.30%"
 * formatPipsAsPercent(10000) // "1.00%"
 */
export function formatPipsAsPercent(pips: number): string {
	return `${(pips / 10000).toFixed(2)}%`;
}

/**
 * @deprecated Use formatPipsAsPercent instead - backend uses pips (100-10000), not bps
 */
export function formatBpsAsPercent(bps: number): string {
	return formatPipsAsPercent(bps);
}

/**
 * Convert bigint with specified decimals to number
 * Generic utility for converting scaled integers to floating point
 *
 * @param value - BigInt value with decimal scaling
 * @param decimals - Number of decimal places the value is scaled by
 * @returns Number value
 *
 * @example
 * fromDecimals(1000000n, 6) // 1 (E6 USD accumulator)
 * fromDecimals(100000000n, 8) // 1 (E8 token amount)
 * fromDecimals(1000000000000n, 12) // 1 (E12 price)
 */
export function fromDecimals(value: bigint, decimals: number): number {
	return Number(value) / Math.pow(10, decimals);
}

/**
 * Convert bigint with 8 decimals (e8s) to number
 * Standard ICP token amount conversion
 *
 * @deprecated Use fromDecimals(value, 8) instead for explicit decimal handling
 *
 * @param value - Value in e8s (8 decimal places)
 * @returns Number value
 *
 * @example
 * fromE8s(100000000n) // 1
 * fromE8s(50000000n) // 0.5
 */
export function fromE8s(value: bigint): number {
	return fromDecimals(value, 8);
}

/**
 * Get CSS class for price change direction
 * Used with price change styling
 *
 * @param change - Price change value
 * @returns 'positive' | 'negative' | 'neutral'
 */
export function getPriceChangeClass(change: number): 'positive' | 'negative' | 'neutral' {
	if (change > 0) return 'positive';
	if (change < 0) return 'negative';
	return 'neutral';
}

// ============================================================================
// TIMESTAMP FORMATTING (Orders, Triggers, Positions)
// ============================================================================

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format a timestamp for order/trigger tables with tiered precision
 *
 * Same day:        "14:32:07"
 * This year:       "Feb 14, 14:32"
 * Older:           "2025-02-14 14:32"
 *
 * @param timestamp - Date, number (ms), or bigint (ms — backend TimestampMs)
 * @returns Formatted timestamp string
 *
 * @example
 * formatTimestamp(Date.now())           // "14:32:07"
 * formatTimestamp(1707900000000)        // "Feb 14, 14:32"
 * formatTimestamp(1675000000000n)       // "2023-01-29 17:46"
 */
export function formatTimestamp(timestamp: Date | number | bigint): string {
	let date: Date;
	if (timestamp instanceof Date) {
		date = timestamp;
	} else if (typeof timestamp === 'bigint') {
		date = new Date(Number(timestamp));
	} else {
		date = new Date(timestamp);
	}

	const now = new Date();
	const hh = date.getHours().toString().padStart(2, '0');
	const mm = date.getMinutes().toString().padStart(2, '0');
	const ss = date.getSeconds().toString().padStart(2, '0');

	// Same day
	if (
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate()
	) {
		return `${hh}:${mm}:${ss}`;
	}

	// Same year
	if (date.getFullYear() === now.getFullYear()) {
		return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}, ${hh}:${mm}`;
	}

	// Older
	const yyyy = date.getFullYear();
	const mo = (date.getMonth() + 1).toString().padStart(2, '0');
	const dd = date.getDate().toString().padStart(2, '0');
	return `${yyyy}-${mo}-${dd} ${hh}:${mm}`;
}

// ============================================================================
// LIVE TIME AGO FORMATTING
// ============================================================================

/**
 * Format a timestamp as relative time ("5s", "2m", "1h", "3d")
 * Designed to work with app.now for live updates
 *
 * @param timestamp - The timestamp to format (Date, number in ms, or bigint in nanoseconds)
 * @param now - Current time (pass app.now for live updates)
 * @param options - Formatting options
 * @returns Formatted string like "5s", "2m", "1h", "3d"
 *
 * @example
 * // In a Svelte component:
 * import { app } from '$lib/state/app.state.svelte';
 * import { formatTimeAgo } from '$lib/utils/format.utils';
 *
 * const timestamp = new Date('2024-01-01T12:00:00');
 * $derived: timeAgo = formatTimeAgo(timestamp, app.now);
 * // Renders: "5s", "2m", "1h", "3d", etc.
 */
export function formatTimeAgo(
	timestamp: Date | number | bigint,
	now: Date,
	options: { verbose?: boolean } = {}
): string {
	const { verbose = false } = options;

	// Convert timestamp to milliseconds
	let timestampMs: number;
	if (timestamp instanceof Date) {
		timestampMs = timestamp.getTime();
	} else if (typeof timestamp === 'bigint') {
		// Assume nanoseconds (IC standard)
		timestampMs = Number(timestamp / NANO_SECONDS_IN_MILLISECOND);
	} else {
		timestampMs = timestamp;
	}

	const nowMs = now.getTime();
	const diffMs = nowMs - timestampMs;

	// Handle future timestamps
	if (diffMs < 0) {
		return verbose ? 'just now' : 'now';
	}

	const seconds = Math.floor(diffMs / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (verbose) {
		if (days > 0) return days === 1 ? '1 day ago' : `${days} days ago`;
		if (hours > 0) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
		if (minutes > 0) return minutes === 1 ? '1 min ago' : `${minutes} mins ago`;
		if (seconds > 0) return seconds === 1 ? '1 sec ago' : `${seconds} secs ago`;
		return 'just now';
	}

	// Compact format
	if (days > 0) return `${days}d`;
	if (hours > 0) return `${hours}h`;
	if (minutes > 0) return `${minutes}m`;
	if (seconds > 0) return `${seconds}s`;
	return 'now';
}

