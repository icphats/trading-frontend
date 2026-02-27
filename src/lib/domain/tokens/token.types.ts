/**
 * Token Type Definitions
 *
 * Source of truth for token-related types.
 * Used by constants, repositories, and domain layers.
 */

/**
 * Static token definition for hardcoded platform tokens
 * Used in TOKEN_DEFINITIONS constant
 */
export interface TokenDefinition {
  canisterId: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string | null;
  isQuoteToken?: boolean;
  /** Initial price in 8-decimal format (for stablecoins: 100000000n = $1.00) */
  initialPrice?: bigint;
  /** Initial fee in token's smallest unit */
  initialFee?: bigint;
  /** Price decimals (typically 8) */
  priceDecimals?: number;
}
