/**
 * Quote Token Types
 *
 * Phase 2a of Quote Token Migration
 *
 * Defines types and utilities for quote token routing.
 * Each spot market can be traded against ICP, USDC, or USDT.
 */

// ============================================
// URL Parameter Type
// ============================================

/**
 * Quote token as URL parameter (lowercase)
 * Used in routes: /trade/[marketId]/[quoteToken]
 */
export type QuoteTokenSymbol = 'icp' | 'usdc' | 'usdt';

// ============================================
// Candid Variant Type
// ============================================

/**
 * Quote token as Candid variant
 * Matches backend QuoteToken type for canister calls
 */
export type QuoteToken = { ICP: null } | { USDC: null } | { USDT: null };

// ============================================
// Conversion Functions
// ============================================

/**
 * Convert URL param to Candid variant
 * @param symbol - URL parameter value (e.g., 'icp')
 * @returns Candid variant for backend calls
 */
export function toQuoteToken(symbol: QuoteTokenSymbol): QuoteToken {
	switch (symbol) {
		case 'icp':
			return { ICP: null };
		case 'usdc':
			return { USDC: null };
		case 'usdt':
			return { USDT: null };
	}
}

/**
 * Convert Candid variant to URL param
 * @param token - Candid variant from backend
 * @returns URL parameter value
 */
export function fromQuoteToken(token: QuoteToken): QuoteTokenSymbol {
	if ('ICP' in token) return 'icp';
	if ('USDC' in token) return 'usdc';
	if ('USDT' in token) return 'usdt';
	throw new Error('Invalid QuoteToken variant');
}

/**
 * Get display name for quote token
 * @param symbol - Quote token symbol
 * @returns Uppercase display name (e.g., 'ICP')
 */
export function quoteTokenDisplayName(symbol: QuoteTokenSymbol): string {
	return symbol.toUpperCase();
}

/**
 * Check if a string is a valid quote token symbol
 * @param value - String to validate
 * @returns True if valid QuoteTokenSymbol
 */
export function isValidQuoteToken(value: string): value is QuoteTokenSymbol {
	return value === 'icp' || value === 'usdc' || value === 'usdt';
}

// ============================================
// Constants
// ============================================

/**
 * Default quote token as Candid variant (for backend calls)
 * This is the canonical source - repository imports from here
 */
export const DEFAULT_QUOTE_TOKEN: QuoteToken = { ICP: null };

/**
 * Default quote token symbol for URL routing
 */
export const DEFAULT_QUOTE_TOKEN_SYMBOL: QuoteTokenSymbol = 'icp';

// ============================================
// ck-Token Normalization
// ============================================

/**
 * Explicit map of ck-prefixed tokens to their normalized symbols.
 * Used for URL routing - frontend uses short names, backend uses full ck names.
 *
 * Add new ck tokens here as they're supported.
 */
export const CK_TOKEN_MAP: Record<string, string> = {
	'ckbtc': 'btc',
	'cketh': 'eth',
	'ckusdt': 'usdt',
	'ckusdc': 'usdc',
};

/**
 * Display names for ck-tokens (normalized key → human-readable name).
 * Used for UI display: "Chain Key USDT" → "Tether USD".
 */
export const CK_DISPLAY_NAMES: Record<string, string> = {
	'btc': 'Bitcoin',
	'eth': 'Ethereum',
	'usdt': 'Tether USD',
	'usdc': 'USD Coin',
};

/**
 * Reverse map: normalized symbols back to ck-prefixed versions.
 * Used when calling backend APIs that expect full token symbols.
 */
export const CK_TOKEN_REVERSE_MAP: Record<string, string> = {
	'btc': 'ckbtc',
	'eth': 'cketh',
	'usdt': 'ckusdt',
	'usdc': 'ckusdc',
};

/**
 * Normalize any token symbol by stripping ck prefix if applicable.
 * Returns lowercase normalized symbol.
 *
 * @example
 * normalizeTokenSymbol('ckBTC') // 'btc'
 * normalizeTokenSymbol('PARTY') // 'party'
 */
export function normalizeTokenSymbol(symbol: string): string {
	const lower = symbol.toLowerCase();
	return CK_TOKEN_MAP[lower] ?? lower;
}

/**
 * Denormalize a token symbol back to its full ck-prefixed version.
 * Used when calling backend APIs that expect full token symbols.
 * Returns lowercase denormalized symbol.
 *
 * @example
 * denormalizeTokenSymbol('btc')   // 'ckbtc'
 * denormalizeTokenSymbol('party') // 'party' (no ck version)
 */
export function denormalizeTokenSymbol(symbol: string): string {
	const lower = symbol.toLowerCase();
	return CK_TOKEN_REVERSE_MAP[lower] ?? lower;
}

/**
 * Normalize quote symbol for URL routing.
 * Returns null if not a recognized quote token.
 *
 * @example
 * normalizeQuoteSymbol('ckUSDT') // 'usdt'
 * normalizeQuoteSymbol('ICP')    // 'icp'
 * normalizeQuoteSymbol('ckBTC')  // null (not a quote token)
 */
export function normalizeQuoteSymbol(symbol: string): QuoteTokenSymbol | null {
	const normalized = normalizeTokenSymbol(symbol);
	return isValidQuoteToken(normalized) ? normalized : null;
}

/**
 * All available quote tokens
 */
export const QUOTE_TOKENS: readonly QuoteTokenSymbol[] = ['icp', 'usdc', 'usdt'] as const;

/**
 * Quote token metadata
 */
export const QUOTE_TOKEN_META: Record<
	QuoteTokenSymbol,
	{
		symbol: QuoteTokenSymbol;
		name: string;
		decimals: number;
	}
> = {
	icp: { symbol: 'icp', name: 'Internet Computer', decimals: 8 },
	usdc: { symbol: 'usdc', name: 'USD Coin', decimals: 6 },
	usdt: { symbol: 'usdt', name: 'Tether USD', decimals: 6 }
};
