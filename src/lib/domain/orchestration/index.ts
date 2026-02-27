/**
 * Domain Orchestration Layer
 *
 * Cross-domain coordination and centralized stores.
 * These modules coordinate data flow between repositories and domain entities.
 */

// Entity Store - Normalized cache for all entities
export {
  entityStore,
  type NormalizedToken,
  type NormalizedMarket,
  type NormalizedPool,
  type TokenUpsert,
  type MarketUpsert,
  type PoolUpsert,
  type PriceSource,
  type EntitySource,
} from './entity-store.svelte';

// Market Loader - Discovery and hydration orchestration
export {
  discoverAndLoadMarkets,
  loadMarket,
} from './market-loader';

// Token Discovery - Token discovery orchestration
export {
  seedPlatformTokens,
  discoverToken,
  discoverTokens,
  getMarketsForSearch,
  getPopularTokens,
} from './token-discovery';

// Spot Activity - Transaction fetching for explore pages
export {
  getSpotTransactions,
  isBuy,
  type ParsedTransaction,
  type Side,
} from './spot-activity';

// Polling Coordinator - Unified visibility-driven real-time polling
export { pollingCoordinator } from './polling-coordinator.svelte';
export { ticker, tokenTicker } from './ticker-action';
export { indexerDataToUpserts, createTokenContribution, aggregateTokenContributions, type TickerUpserts, type MarketTokenContribution } from './ticker-transforms';

// Market Operations - Market creation and pool operations
export {
  createMarket,
  isRegistryAvailable,
  fetchPoolState,
  fetchPoolsOverview,
  type CreateMarketParams,
  type CreateMarketResult,
  type SpotMarketMetadata,
  type PoolState,
  type PoolOverview,
} from './market-operations';
