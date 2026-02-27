/**
 * Markets Domain Public API
 *
 * Central export point for all market domain functionality.
 *
 * Structure:
 * - state/    → Reactive state classes (.svelte.ts)
 * - utils/    → Pure functions (math, formatting, ticks, swaps)
 * - types.ts  → Type definitions
 */

// ============================================
// State (Reactive Classes)
// ============================================

export {
  MarketRegistry,
  marketRegistry,
  type MarketInstance
} from './state/market-registry.svelte';

export { SpotMarket } from './state/spot-market.svelte';
export { marketCreation } from './state/market-creation.svelte';
export { marketSelection } from './state/market-selection.svelte';

// ============================================
// Types
// ============================================

export type {
  // Core Types
  MarketType,
  MarketCapabilities,
  BaseMarket,
  SpotMarket as ISpotMarket,
  MarketState,

  // Transaction Types
  BaseTransaction,
  BaseChartData,

  // User Position Types
  UserPosition,
  SpotUserPosition,

  // Metadata Types
  MarketExtraMetadata,
  MarketMetadata,
  MarketRegistryEntry,

  // Filtering & Sorting
  MarketFilter,
  MarketSortBy,
  MarketSortOptions,

  // Utility Types
  Result
} from './market.types';

// Quote Token Types
export type { QuoteToken, QuoteTokenSymbol } from './quote-token.types';
export {
  toQuoteToken,
  fromQuoteToken,
  quoteTokenDisplayName,
  isValidQuoteToken,
  DEFAULT_QUOTE_TOKEN,
  DEFAULT_QUOTE_TOKEN_SYMBOL,
  QUOTE_TOKENS,
  QUOTE_TOKEN_META,
  // ck-token normalization
  CK_TOKEN_MAP,
  CK_DISPLAY_NAMES,
  CK_TOKEN_REVERSE_MAP,
  normalizeTokenSymbol,
  denormalizeTokenSymbol,
  normalizeQuoteSymbol
} from './quote-token.types';

// Spot Types (candid re-exports + frontend types)
export type {
  // Candid re-exports
  SpotLiquidity,
  SpotPositionId,
  SpotTick,
  SpotSqrtPriceX96,
  SpotTransactionResponse,
  SpotPositionView,
  SpotPositionViewEnhanced,
  SpotCandle,
  SpotCandleData,
  SpotChartInterval,
  SpotPlatformData,
  SpotPollVersions,
  SpotHydrateResponse,
  SpotSide,
  // Market depth types (separated book + pool liquidity)
  SpotMarketDepthResponse,
  SpotBookLevelAggregated,
  SpotPoolDepthData,
  SpotTickLiquidityData,
  SpotMarketService,
  // Frontend types
  SpotAddLiquidityParams,
  SpotIncreaseLiquidityParams,
  SpotDecreaseLiquidityParams,
  SpotSwapParams,
  SpotQuoteSwapParams,
  SpotSwapResult,
  SpotOrderBookParams,
  SpotCollectedFees,
  SpotLiquidityQuote,
  SpotAmountsQuote,
  SpotTransaction,
  SpotOrderSide,
  SpotOrderType,
  SpotOrderFormValidation,
  SpotSwapQuote,
  SpotSwapExecutionParams,
  SpotChartParams,
  SpotHydrateAllParams
} from './spot.types';

// ============================================
// Utils (Pure Functions)
// ============================================

export * from './utils';

// ============================================
// Orchestration (re-exported for convenience)
// ============================================

export {
  discoverAndLoadMarkets,
  loadMarket,
} from '../orchestration/market-loader';
