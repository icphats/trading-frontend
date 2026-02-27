/**
 * Spot Market Type Barrel
 *
 * Type-only re-exports from Candid declarations.
 * All runtime logic lives in repositories (market.repository.ts).
 */

import type {
  _SERVICE,
  Tick,
  SqrtPriceX96,
  Liquidity,
  PositionView,
  PositionViewEnhanced,
  Side,
  OrderId,
  QuoteOrderResult,
  LiquidityResult,
  IncreaseLiquidityResult,
  LockPositionResult,
  TransferPositionResult,
  ApiResult,
  ApiResult__1_1,
  CancelOrdersResult,
  PollVersions,
  PlatformData,
  HydrateResponse,
  ChartInterval,
  SpotCandle,
  SpotTransactionResponse,
  PoolState,
  PositionId,
  MarketDepthResponse,
  BookLevelAggregated,
  PoolDepthData,
  TickLiquidityData,
  UpgradeArgs,
  OrderView,
  CandleData,
  UserData,
  CollectFeesResult,
  TriggerType,
  TriggerView,
  CreateTriggersResult,
  CancelTriggersResult,
  DecreaseLiquidityResult,
  TriggerId,
  TriggerStatus,
  TriggerSpec,
  QuoteResult,
  CreateOrdersResult,
  BookOrderSpec,
  PoolSwapSpec,
  OrderResultItem,
  SwapResultItem,
  BatchSummary,
  CancelOrderResultItem,
  PoolOverview,
  PoolSnapshotView,
  PoolSnapshotsResponse,
  MarketSnapshotView,
  MarketSnapshotsResponse,
  UpdateOrderResult,
  BalanceSheet,
  AssetsBreakdown,
  LiabilitiesBreakdown,
  EquityBreakdown,
  ProtocolEquitySummary,
  ClaimTokenId,
  DepositResult,
  WithdrawResult,
  TokenPair,
  LockedBalances,
  NetFlows,
  TokenPairInt,
  PassThroughTradeArgs,
  PassThroughTradeResult,
  PassThroughTradeSuccess,
  RoutingState,
  IndexerData,
  ActivityView,
  GetUserActivityResult,
  ChainCursor,
  ActivityType,
  ActivityDetails,
  OrderActivityDetails,
  TriggerActivityDetails,
  LiquidityActivityDetails,
  TransferActivityDetails,
  PenaltyActivityDetails,
  PositionTransferActivityDetails,
} from 'declarations/spot/spot.did';

// Amount type alias (was removed from declarations, now all amounts are nat64/bigint)
export type Amount = bigint;

// ============================================================================
// TYPE RE-EXPORTS (for domain layer imports)
// ============================================================================

export type {
  // Core types
  Tick,
  SqrtPriceX96,
  Liquidity,
  Side,
  OrderId,
  PositionId,

  // Pool types
  PoolState,
  PoolOverview,
  PoolSnapshotView,
  PoolSnapshotsResponse,
  // Market snapshot types (TVL time series)
  MarketSnapshotView,
  MarketSnapshotsResponse,

  // Market depth types (separated book + pool liquidity)
  MarketDepthResponse,
  BookLevelAggregated,
  PoolDepthData,
  TickLiquidityData,

  // Position types
  PositionView,
  PositionViewEnhanced,

  // Order types
  OrderView,
  UpdateOrderResult,
  CreateOrdersResult,
  BookOrderSpec,
  PoolSwapSpec,
  OrderResultItem,
  SwapResultItem,
  BatchSummary,
  CancelOrderResultItem,

  // Trigger types
  TriggerType,
  TriggerView,
  TriggerStatus,
  TriggerId,
  TriggerSpec,
  CreateTriggersResult,
  CancelTriggersResult,

  // Liquidity types
  LiquidityResult,
  IncreaseLiquidityResult,
  DecreaseLiquidityResult,
  CollectFeesResult,
  LockPositionResult,

  // Chart types
  ChartInterval,
  CandleData,
  SpotCandle,

  // Transaction types
  SpotTransactionResponse,

  // Data types
  UserData,
  TokenPair,
  TokenPairInt,
  LockedBalances,
  NetFlows,
  PlatformData,
  HydrateResponse,
  PollVersions,

  // Quote types
  QuoteResult,

  // Pass-through trade types
  PassThroughTradeArgs,
  PassThroughTradeResult,
  PassThroughTradeSuccess,

  // Routing types
  RoutingState,
  IndexerData,

  // Activity history types
  ActivityView,
  GetUserActivityResult,
  ChainCursor,
  ActivityType,
  ActivityDetails,
  OrderActivityDetails,
  TriggerActivityDetails,
  LiquidityActivityDetails,
  TransferActivityDetails,
  PenaltyActivityDetails,
  PositionTransferActivityDetails,

  // Config types
  UpgradeArgs,
  ApiResult,
  ApiResult__1_1 as VoidApiResult,
  // Accounting types
  BalanceSheet,
  AssetsBreakdown,
  LiabilitiesBreakdown,
  EquityBreakdown,
  ProtocolEquitySummary,

  // Token cache types
  ClaimTokenId,
  DepositResult,
  WithdrawResult,

  // Service interface
  _SERVICE as SpotMarketService,
};

