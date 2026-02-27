import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type ActivityDetails = { 'trigger' : TriggerActivityDetails } |
  { 'penalty' : PenaltyActivityDetails } |
  { 'order' : OrderActivityDetails } |
  { 'liquidity' : LiquidityActivityDetails } |
  { 'position_transfer' : PositionTransferActivityDetails } |
  { 'transfer' : TransferActivityDetails };
export type ActivityType = { 'trigger_fired' : null } |
  { 'transfer_out' : null } |
  { 'trigger_cancelled' : null } |
  { 'order_cancelled' : null } |
  { 'transfer_in' : null } |
  { 'lp_fees_collected' : null } |
  { 'lp_transferred' : null } |
  { 'trigger_failed' : null } |
  { 'transfer_in_failed' : null } |
  { 'lp_closed' : null } |
  { 'lp_decreased' : null } |
  { 'lp_opened' : null } |
  { 'circuit_breaker_penalty' : null } |
  { 'lp_increased' : null } |
  { 'order_filled' : null } |
  { 'lp_locked' : null } |
  { 'order_partial' : null } |
  { 'transfer_out_failed' : null } |
  { 'order_modified' : null };
export interface ActivityView {
  'activity_type' : ActivityType,
  'quote_usd_e12' : bigint,
  'timestamp_ms' : bigint,
  'activity_id' : bigint,
  'details' : ActivityDetails,
}
export interface AllUsersDebug {
  'user_count' : bigint,
  'total_net_lp_quote' : bigint,
  'inv2_balanced' : boolean,
  'total_inv2_drift_quote' : bigint,
  'total_fees_base' : bigint,
  'total_net_lp_base' : bigint,
  'total_locked_quote' : bigint,
  'total_pending_quote' : bigint,
  'total_net_swap_quote' : bigint,
  'total_inv2_drift_base' : bigint,
  'total_available_base' : bigint,
  'total_locked_base' : bigint,
  'total_fees_quote' : bigint,
  'total_net_external_quote' : bigint,
  'total_net_external_base' : bigint,
  'total_net_swap_base' : bigint,
  'users_with_drift' : bigint,
  'total_available_quote' : bigint,
  'total_pending_base' : bigint,
}
export interface ApiError {
  'metadata' : [] | [Array<[string, string]>],
  'code' : string,
  'message' : string,
  'category' : ErrorCategory,
}
export type ApiResult = { 'ok' : boolean } |
  { 'err' : ApiError };
export type ApiResult_1 = { 'ok' : WriteCandlesResult } |
  { 'err' : ApiError };
export type ApiResult_2 = { 'ok' : bigint } |
  { 'err' : ApiError };
export type ApiResult_4 = { 'ok' : KillAllResult } |
  { 'err' : ApiError };
export type ApiResult_5 = { 'ok' : [] | [UserDebug] } |
  { 'err' : ApiError };
export type ApiResult_6 = { 'ok' : EventLogPage } |
  { 'err' : ApiError };
export type ApiResult__1 = {
    'ok' : { 'fee' : bigint, 'input_amount' : bigint, 'output_amount' : bigint }
  } |
  { 'err' : ApiError };
export type ApiResult__1_1 = { 'ok' : null } |
  { 'err' : ApiError };
export type ApiResult__1_2 = { 'ok' : { 'trigger_id' : TriggerId } } |
  { 'err' : ApiError };
export type ApiResult__1_3 = { 'ok' : { 'order_id' : OrderId } } |
  { 'err' : ApiError };
export interface AssetsBreakdown {
  'total' : bigint,
  'quote_balance' : bigint,
  'base_balance' : bigint,
}
export interface BalanceSheet {
  'net_tracking' : NetTracking,
  'liabilities' : LiabilitiesBreakdown,
  'expected_quote' : bigint,
  'assets' : AssetsBreakdown,
  'pool_invariants' : {
    'all_pools_healthy' : boolean,
    'unhealthy_pools' : Uint32Array | number[],
    'pools' : Array<PoolInvariantStatus>,
  },
  'drift_base' : bigint,
  'expected_base' : bigint,
  'drift_quote' : bigint,
  'users_debug' : AllUsersDebug,
  'is_balanced' : boolean,
  'equity' : EquityBreakdown,
  'protocol_equity' : ProtocolEquitySummary,
}
export interface BatchSummary { 'failed' : number, 'succeeded' : number }
export interface BookLevelAggregated {
  'order_count' : bigint,
  'tick' : Tick,
  'amount' : bigint,
}
export interface BookLevelRaw { 'total' : bigint, 'tick' : Tick }
export interface BookLevelsResponse {
  'asks' : Array<BookLevelRaw>,
  'bids' : Array<BookLevelRaw>,
}
export interface BookOrderSpec {
  'input_amount' : bigint,
  'side' : Side,
  'limit_tick' : Tick,
  'immediate_or_cancel' : boolean,
}
export type CancelAllOrdersResult = {
    'ok' : {
      'cancelled' : number,
      'available_quote' : bigint,
      'available_base' : bigint,
      'versions' : PollVersions,
    }
  } |
  { 'err' : ApiError };
export type CancelAllTriggersResult = {
    'ok' : {
      'cancelled' : number,
      'available_quote' : bigint,
      'available_base' : bigint,
      'versions' : PollVersions,
    }
  } |
  { 'err' : ApiError };
export interface CancelOrderResultItem {
  'result' : ApiResult__1_1,
  'order_id' : OrderId,
}
export type CancelOrdersResult = {
    'ok' : {
      'results' : Array<CancelOrderResultItem>,
      'available_quote' : bigint,
      'summary' : BatchSummary,
      'available_base' : bigint,
      'versions' : PollVersions,
    }
  } |
  { 'err' : ApiError };
export interface CancelTriggerResultItem {
  'result' : ApiResult__1_1,
  'trigger_id' : TriggerId,
}
export type CancelTriggersResult = {
    'ok' : {
      'results' : Array<CancelTriggerResultItem>,
      'available_quote' : bigint,
      'summary' : BatchSummary,
      'available_base' : bigint,
      'versions' : PollVersions,
    }
  } |
  { 'err' : ApiError };
export type CandleData = [bigint, bigint, bigint, bigint, bigint, bigint];
export interface ChainCursor {
  'id' : bigint,
  'offset' : number,
  'partition' : number,
}
export type ChartInterval = { 'min15' : null } |
  { 'hour1' : null } |
  { 'hour4' : null } |
  { 'day1' : null } |
  { 'min1' : null };
export type ClaimTokenId = { 'base' : null } |
  { 'quote' : null };
export type CloseAllPositionsResult = {
    'ok' : {
      'closed' : number,
      'amount0' : bigint,
      'amount1' : bigint,
      'versions' : PollVersions,
    }
  } |
  { 'err' : ApiError };
export type CollectFeesResult = {
    'ok' : {
      'collected_amt0' : bigint,
      'collected_amt1' : bigint,
      'versions' : PollVersions,
    }
  } |
  { 'err' : ApiError };
export type CreateOrdersResult = {
    'ok' : {
      'swap_results' : Array<SwapResultItem>,
      'cancel_results' : Array<CancelOrderResultItem>,
      'order_results' : Array<OrderResultItem>,
      'cancel_summary' : BatchSummary,
      'order_summary' : BatchSummary,
      'available_quote' : bigint,
      'available_base' : bigint,
      'versions' : PollVersions,
    }
  } |
  { 'err' : ApiError };
export type CreateTriggersResult = {
    'ok' : {
      'cancel_results' : Array<CancelTriggerResultItem>,
      'cancel_summary' : BatchSummary,
      'results' : Array<TriggerResultItem>,
      'available_quote' : bigint,
      'summary' : BatchSummary,
      'available_base' : bigint,
      'versions' : PollVersions,
    }
  } |
  { 'err' : ApiError };
export type DecreaseLiquidityResult = {
    'ok' : { 'amount0' : bigint, 'amount1' : bigint, 'versions' : PollVersions }
  } |
  { 'err' : ApiError };
export type DepositResult = {
    'ok' : {
      'block_index' : bigint,
      'new_balance' : bigint,
      'versions' : PollVersions,
      'credited' : bigint,
    }
  } |
  { 'err' : ApiError };
export interface EquityBreakdown {
  'total' : bigint,
  'withdrawn_quote' : bigint,
  'op_fees_base' : bigint,
  'withdrawn_base' : bigint,
  'op_fees_quote' : bigint,
  'total_base' : bigint,
  'book_fees_quote' : bigint,
  'available_quote' : bigint,
  'book_fees_base' : bigint,
  'available_base' : bigint,
  'pool_fees_base' : bigint,
  'pool_fees_quote' : bigint,
  'total_quote' : bigint,
}
export type ErrorCategory = { 'resource' : null } |
  { 'admin' : null } |
  { 'other' : null } |
  { 'rate_limit' : null } |
  { 'state' : null } |
  { 'validation' : null } |
  { 'external' : null } |
  { 'authorization' : null };
export interface EventLogEntry {
  'id' : bigint,
  'principal' : [] | [Principal],
  'context' : Array<[string, string]>,
  'level' : LogLevel,
  'event' : string,
  'message' : string,
  'timestamp' : bigint,
}
export interface EventLogPage {
  'data' : Array<EventLogEntry>,
  'next_cursor' : [] | [bigint],
  'has_more' : boolean,
}
export interface FrozenControl {
  'triggers_live' : bigint,
  'pool_protocol_fee_pips' : bigint,
  'maker_fee_pips' : number,
  'system_state' : SystemState,
  'instruction_budget' : bigint,
  'timer_running' : boolean,
  'taker_fee_pips' : number,
  'market_initialized' : boolean,
  'oracle_principal' : Principal,
  'cycles_threshold' : bigint,
  'max_positions_per_user' : bigint,
  'token0' : { 'fee' : bigint, 'decimals' : number, 'ledger' : Principal },
  'token1' : { 'fee' : bigint, 'decimals' : number, 'ledger' : Principal },
  'treasury_principal' : [] | [Principal],
  'maker_rebate_pips' : number,
  'users' : bigint,
  'max_triggers_per_user' : bigint,
  'indexer_principal' : Principal,
  'pools' : bigint,
  'registry_principal' : Principal,
  'positions' : bigint,
  'this_principal' : Principal,
  'orders_live' : bigint,
  'max_orders_per_user' : bigint,
  'admin_principals' : Array<Principal>,
}
export interface GetUserActivityResult {
  'data' : Array<ActivityView>,
  'next_cursor' : [] | [ChainCursor],
  'has_more' : boolean,
}
export interface HydrateResponse {
  'chart' : {
    'data' : Array<SpotCandle>,
    'next_cursor' : [] | [bigint],
    'has_more' : boolean,
  },
  'user' : UserData,
  'platform' : PlatformData,
  'versions' : PollVersions,
  'recent_trades' : {
    'data' : Array<SpotTransactionResponse>,
    'next_cursor' : [] | [bigint],
    'has_more' : boolean,
  },
}
export type IncreaseLiquidityResult = {
    'ok' : {
      'liquidity_delta' : bigint,
      'actual_amt0' : bigint,
      'actual_amt1' : bigint,
      'versions' : PollVersions,
    }
  } |
  { 'err' : ApiError };
export interface IndexerData {
  'triggers_live' : number,
  'base_tvl_usd_e6' : bigint,
  'pool_data' : Array<IndexerPoolData>,
  'book_fees_cumulative_usd_e6' : bigint,
  'total_transactions' : bigint,
  'book_volume_cumulative_usd_e6' : bigint,
  'book_open_interest_usd_e6' : bigint,
  'trigger_locked_usd_e6' : bigint,
  'token_data' : IndexerTokenData,
  'orders_live' : number,
  'quote_tvl_usd_e6' : bigint,
  'total_positions' : number,
  'pool_reserve_usd_e6' : bigint,
}
export interface IndexerPoolData {
  'volume_cumulative_usd_e6' : bigint,
  'tvl_usd_e6' : bigint,
  'volume_24h_usd_e6' : bigint,
  'fees_24h_usd_e6' : bigint,
  'apr_bps' : bigint,
  'quote_ledger' : Principal,
  'fee_pips' : number,
  'current_price_usd_e12' : bigint,
  'volume_30d_usd_e6' : bigint,
  'volume_7d_usd_e6' : bigint,
}
export interface IndexerTokenData {
  'volume_cumulative_usd_e6' : bigint,
  'price_change_bps' : [bigint, bigint, bigint, bigint, bigint],
  'volume_24h_usd_e6' : bigint,
  'current_price_usd_e12' : bigint,
  'volume_30d_usd_e6' : bigint,
  'volume_7d_usd_e6' : bigint,
}
export interface InitArgs {
  'maker_fee_pips' : [] | [number],
  'taker_fee_pips' : [] | [number],
  'oracle_principal' : Principal,
  'token0' : TokenMetadata,
  'token1' : TokenMetadata,
  'treasury_principal' : [] | [Principal],
  'maker_rebate_pips' : [] | [number],
  'indexer_principal' : Principal,
  'registry_principal' : Principal,
  'admin_principals' : Array<Principal>,
}
export interface KillAllResult {
  'orders' : bigint,
  'budget_hit' : boolean,
  'positions' : bigint,
  'triggers' : bigint,
}
export interface LiabilitiesBreakdown {
  'orders_output_base' : bigint,
  'total' : bigint,
  'pending_base' : bigint,
  'pending_quote' : bigint,
  'triggers_quote' : bigint,
  'pool_reserves_quote' : bigint,
  'total_base' : bigint,
  'available_quote' : bigint,
  'available_base' : bigint,
  'pool_reserves_base' : bigint,
  'orders_quote' : bigint,
  'total_quote' : bigint,
  'orders_base' : bigint,
  'orders_output_quote' : bigint,
  'triggers_base' : bigint,
}
export type Liquidity = bigint;
export interface LiquidityActivityDetails {
  'tick_at_event' : number,
  'amount_quote' : bigint,
  'liquidity_delta' : bigint,
  'amount_base' : bigint,
  'fee_pips' : number,
  'tick_lower' : number,
  'tick_upper' : number,
  'position_id' : bigint,
}
export interface LiquidityLockSummary {
  'locked_position_count' : bigint,
  'total_position_count' : bigint,
  'total_unlocked_base_usd_e6' : bigint,
  'total_locked_quote_usd_e6' : bigint,
  'schedule' : Array<LockScheduleEntry>,
  'total_unlocked_quote_usd_e6' : bigint,
  'total_locked_base_usd_e6' : bigint,
}
export type LiquidityResult = {
    'ok' : {
      'actual_amt0' : bigint,
      'actual_amt1' : bigint,
      'versions' : PollVersions,
      'position_id' : PositionId,
    }
  } |
  { 'err' : ApiError };
export type LockPositionResult = { 'ok' : { 'versions' : PollVersions } } |
  { 'err' : ApiError };
export interface LockScheduleEntry {
  'locked_until_ms' : bigint,
  'quote_usd_e6' : bigint,
  'base_usd_e6' : bigint,
  'liquidity' : bigint,
  'fee_pips' : number,
  'position_id' : PositionId,
}
export interface LockedBalances {
  'orders' : TokenPair,
  'positions' : TokenPair,
  'triggers' : TokenPair,
}
export type LogLevel = { 'Error' : null } |
  { 'Info' : null } |
  { 'Warn' : null } |
  { 'Debug' : null } |
  { 'Critical' : null };
export interface MarketDepthResponse {
  'book_asks' : Array<BookLevelAggregated>,
  'book_bids' : Array<BookLevelAggregated>,
  'version' : bigint,
  'last_trade_sqrt_price_x96' : SqrtPriceX96,
  'pools' : Array<PoolDepthData>,
}
export interface MarketSnapshotView {
  'triggers_live' : bigint,
  'pool_volume_quote' : bigint,
  'trigger_locked_base' : bigint,
  'book_volume_quote' : bigint,
  'base_custody' : bigint,
  'pool_volume_usd_e6' : bigint,
  'pool_base_reserve' : bigint,
  'total_transactions' : bigint,
  'book_fees_usd_e6' : bigint,
  'book_open_interest_base' : bigint,
  'timestamp' : bigint,
  'users' : bigint,
  'quote_custody' : bigint,
  'book_volume_usd_e6' : bigint,
  'trigger_locked_quote' : bigint,
  'pool_fees_usd_e6' : bigint,
  'reference_price_e12' : bigint,
  'book_open_interest_quote' : bigint,
  'orders_live' : bigint,
  'pool_quote_reserve' : bigint,
  'total_positions' : bigint,
}
export interface MarketSnapshotsResponse {
  'data' : Array<MarketSnapshotView>,
  'next_cursor' : [] | [bigint],
  'has_more' : boolean,
}
export interface NetFlows {
  'lp' : TokenPairInt,
  'swap' : TokenPairInt,
  'external' : TokenPairInt,
}
export interface NetTracking {
  'net_external_quote' : bigint,
  'net_lp_quote' : bigint,
  'net_lp_base' : bigint,
  'net_swap_quote' : bigint,
  'net_swap_base' : bigint,
  'total_net_quote' : bigint,
  'net_external_base' : bigint,
  'total_net_base' : bigint,
}
export interface OrderActivityDetails {
  'output_received' : bigint,
  'input_spent' : bigint,
  'side' : Side,
  'tick' : number,
  'created_at_ms' : bigint,
  'locked_input' : bigint,
  'order_id' : bigint,
  'immediate_or_cancel' : boolean,
  'fees_paid' : bigint,
}
export interface OrderDebugEntry {
  'id' : bigint,
  'side' : Side,
  'tick' : bigint,
  'locked_input' : bigint,
  'remaining_input' : bigint,
}
export type OrderId = bigint;
export interface OrderResultItem { 'result' : ApiResult__1_3, 'index' : number }
export type OrderStatus = { 'cancelled' : null } |
  { 'pending' : null } |
  { 'filled' : null } |
  { 'partial' : null };
export interface OrderView {
  'fee' : bigint,
  'status' : OrderStatus,
  'side' : Side,
  'tick' : Tick,
  'quote_filled' : bigint,
  'base_filled' : bigint,
  'timestamp' : bigint,
  'quote_amount' : bigint,
  'order_id' : bigint,
  'base_amount' : bigint,
  'immediate_or_cancel' : boolean,
  'quote_usd_rate_e12' : bigint,
}
export interface PassThroughTradeArgs {
  'recipient' : [] | [Principal],
  'pool_swaps' : Array<PoolSwapSpec>,
  'book_order' : [] | [BookOrderSpec],
}
export type PassThroughTradeResult = { 'ok' : PassThroughTradeSuccess } |
  { 'err' : ApiError };
export interface PassThroughTradeSuccess {
  'output' : bigint,
  'swap_results' : Array<SwapResultItem>,
  'output_error' : [] | [string],
  'output_block_index' : [] | [bigint],
  'refund_error' : [] | [string],
  'refund_block_index' : [] | [bigint],
  'versions' : PollVersions,
  'refund' : bigint,
}
export interface PenaltyActivityDetails {
  'token' : { 'base' : null } |
    { 'quote' : null },
  'tick_after' : number,
  'bound_lower' : number,
  'bound_upper' : number,
  'order_id' : bigint,
  'penalty_amount' : bigint,
  'tick_before' : number,
  'pool_fee_pips' : number,
}
export interface PlatformData {
  'triggers_live' : bigint,
  'book_depth_base_usd_e6' : bigint,
  'maker_fee_pips' : number,
  'reference_tick' : [] | [Tick],
  'last_book_tick' : [] | [Tick],
  'liquidity' : Liquidity,
  'volume_24h_usd_e6' : bigint,
  'taker_fee_pips' : number,
  'book_depth_quote_usd_e6' : bigint,
  'total_transactions' : bigint,
  'maker_rebate_pips' : number,
  'users' : bigint,
  'candle' : CandleData,
  'current_price_usd_e12' : bigint,
  'last_trade_sqrt_price_x96' : [] | [SqrtPriceX96],
  'pool_depth_base_usd_e6' : bigint,
  'market_depth' : MarketDepthResponse,
  'price_change_24h_bps' : bigint,
  'pool_depth_quote_usd_e6' : bigint,
  'last_trade_tick' : [] | [Tick],
  'orders_live' : bigint,
  'total_positions' : bigint,
}
export interface PollVersions {
  'user' : bigint,
  'platform' : bigint,
  'orderbook' : bigint,
  'candle' : bigint,
}
export interface PoolDepthData {
  'sqrt_price_x96' : SqrtPriceX96,
  'liquidity' : bigint,
  'fee_pips' : number,
  'current_tick' : Tick,
  'initialized_ticks' : Array<TickLiquidityData>,
  'tick_spacing' : bigint,
}
export interface PoolInvariantStatus {
  'liquidity_net_sum' : bigint,
  'liquidity' : bigint,
  'computed_liquidity' : bigint,
  'inv3c_balanced' : boolean,
  'fee_pips' : number,
  'inv3b_balanced' : boolean,
  'inv3a_balanced' : boolean,
}
export interface PoolOverview {
  'quote_usd_e6' : bigint,
  'base_usd_e6' : bigint,
  'tick' : Tick,
  'volume_24h_usd_e6' : bigint,
  'apr_bps' : bigint,
  'fee_pips' : number,
  'positions' : bigint,
}
export interface PoolSnapshotView {
  'base_reserve' : bigint,
  'timestamp' : bigint,
  'quote_reserve' : bigint,
  'fees_usd_e6' : bigint,
  'volume_quote' : bigint,
  'volume_usd_e6' : bigint,
}
export interface PoolSnapshotsResponse {
  'data' : Array<PoolSnapshotView>,
  'next_cursor' : [] | [bigint],
  'has_more' : boolean,
}
export interface PoolState {
  'sqrt_price_x96' : SqrtPriceX96,
  'tvl_usd_e6' : bigint,
  'tick' : Tick,
  'liquidity' : bigint,
  'volume_24h_usd_e6' : bigint,
  'fees_24h_usd_e6' : bigint,
  'token1_reserve' : bigint,
  'apr_bps' : bigint,
  'token0_reserve' : bigint,
  'fee_pips' : number,
  'initialized_ticks' : Array<TickLiquidityData>,
  'tick_spacing' : bigint,
}
export interface PoolSwapSpec {
  'input_amount' : bigint,
  'side' : Side,
  'limit_tick' : Tick,
  'fee_pips' : number,
}
export interface PositionDebugEntry {
  'id' : bigint,
  'liquidity' : bigint,
  'fee_pips' : number,
  'tick_lower' : bigint,
  'tokens_owed_0' : bigint,
  'tokens_owed_1' : bigint,
  'tick_upper' : bigint,
}
export type PositionId = bigint;
export interface PositionTransferActivityDetails {
  'direction' : { 'sent' : null } |
    { 'received' : null },
  'liquidity' : bigint,
  'counterparty' : Principal,
  'fee_pips' : number,
  'tick_lower' : number,
  'tick_upper' : number,
  'position_id' : bigint,
}
export interface PositionView {
  'uncollected_fees_base' : bigint,
  'owner' : Principal,
  'uncollected_fees_quote' : bigint,
  'fee_growth_inside_1_last_x128' : bigint,
  'liquidity' : Liquidity,
  'fee_pips' : number,
  'locked_until' : [] | [bigint],
  'tick_lower' : Tick,
  'fee_growth_inside_0_last_x128' : bigint,
  'tick_upper' : Tick,
  'position_id' : PositionId,
}
export interface PositionViewEnhanced {
  'fees_usd_value_e6' : bigint,
  'owner' : Principal,
  'usd_value_e6' : bigint,
  'liquidity' : Liquidity,
  'amount_quote' : bigint,
  'apr_bps' : bigint,
  'fees_quote' : bigint,
  'amount_base' : bigint,
  'fee_pips' : number,
  'locked_until' : [] | [bigint],
  'tick_lower' : Tick,
  'tick_upper' : Tick,
  'fees_base' : bigint,
  'position_id' : PositionId,
}
export interface ProtocolEquitySummary {
  'pool_fees' : [bigint, bigint],
  'book_fees' : [bigint, bigint],
  'available' : [bigint, bigint],
  'op_fees' : [bigint, bigint],
  'withdrawn' : [bigint, bigint],
}
export type QuoteOrderResult = { 'ok' : QuoteResult } |
  { 'err' : ApiError };
export interface QuoteResult {
  'input_amount' : bigint,
  'reference_tick' : Tick,
  'price_impact_bps' : bigint,
  'output_amount' : bigint,
  'total_fees' : bigint,
  'pool_swaps' : Array<PoolSwapSpec>,
  'book_order' : [] | [BookOrderSpec],
  'min_output' : bigint,
  'effective_tick' : Tick,
  'venue_breakdown' : Array<VenueBreakdown>,
}
export interface RoutingPoolState {
  'sqrt_price_x96' : SqrtPriceX96,
  'tick' : Tick,
  'liquidity' : bigint,
  'token1_reserve' : bigint,
  'token0_reserve' : bigint,
  'fee_pips' : number,
  'initialized_ticks' : Array<TickLiquidityData>,
  'tick_spacing' : bigint,
}
export interface RoutingState {
  'maker_fee_pips' : number,
  'reference_tick' : [] | [Tick],
  'system_state' : SystemState,
  'last_book_tick' : [] | [Tick],
  'book' : BookLevelsResponse,
  'taker_fee_pips' : number,
  'token0' : RoutingTokenInfo,
  'token1' : RoutingTokenInfo,
  'last_trade_sqrt_price_x96' : [] | [SqrtPriceX96],
  'pools' : Array<RoutingPoolState>,
  'last_trade_tick' : [] | [Tick],
}
export interface RoutingTokenInfo {
  'fee' : bigint,
  'decimals' : number,
  'ledger' : Principal,
}
export type Side = { 'buy' : null } |
  { 'sell' : null };
export interface Spot {
  /**
   * / Add liquidity to a new concentrated position.
   * / First LP must supply initial_tick to set pool price; subsequent LPs add at current price.
   */
  'add_liquidity' : ActorMethod<
    [number, Tick, Tick, bigint, bigint, [] | [Tick], [] | [bigint]],
    LiquidityResult
  >,
  /**
   * / Get event log entries with cursor-based pagination (newest first).
   */
  'admin_get_event_logs' : ActorMethod<[[] | [bigint], number], ApiResult_6>,
  /**
   * / User debug info for INV-2 verification (single user).
   */
  'admin_get_user_debug' : ActorMethod<[Principal], ApiResult_5>,
  /**
   * / Nuclear cleanup: cancel all orders, triggers, and close all positions.
   * / Requires system to be #halted. Use with extreme caution.
   */
  'admin_kill_all' : ActorMethod<[], ApiResult_4>,
  /**
   * / Release a principal from rate limiting (admin override).
   */
  'admin_release_rate_limit' : ActorMethod<[Principal], ApiResult>,
  /**
   * / Set system-wide lockdown (admin override for rate limiter).
   */
  'admin_set_lockdown' : ActorMethod<[boolean], ApiResult__1_1>,
  /**
   * / Set system operational state. States: #normal (full op), #degraded (exit only), #halted (admin only).
   */
  'admin_set_system_state' : ActorMethod<[SystemState], ApiResult__1_1>,
  /**
   * / Start the heartbeat timer (admin only). No-op if already running.
   */
  'admin_start_timer' : ActorMethod<[], ApiResult__1_1>,
  /**
   * / Stop the heartbeat timer (admin only).
   */
  'admin_stop_timer' : ActorMethod<[], ApiResult__1_1>,
  /**
   * / Update runtime configuration (admin_principals, fee_tier).
   */
  'admin_upgrade_config' : ActorMethod<[UpgradeArgs], ApiResult__1_1>,
  /**
   * / Withdraw accumulated protocol fees to a recipient (Treasury sweep).
   */
  'admin_withdraw_fees' : ActorMethod<[Principal], ApiResult_2>,
  /**
   * / Write candles to chart archive (backfill historical or overwrite existing).
   * / Works with any interval; boundary sync is automatic and idempotent.
   */
  'admin_write_candles' : ActorMethod<
    [ChartInterval, Array<SpotCandle>],
    ApiResult_1
  >,
  /**
   * / Cancel all orders for caller (parameterless kill switch). Works in degraded mode.
   */
  'cancel_all_orders' : ActorMethod<[], CancelAllOrdersResult>,
  /**
   * / Cancel all triggers for caller (parameterless kill switch). Works in degraded mode.
   */
  'cancel_all_triggers' : ActorMethod<[], CancelAllTriggersResult>,
  /**
   * / Batch cancel orders. Per-order cancellation — failures don't block other cancels.
   */
  'cancel_orders' : ActorMethod<[Array<OrderId>], CancelOrdersResult>,
  /**
   * / Bulk cancel triggers by ID. Per-trigger cancellation — failures don't block others.
   */
  'cancel_triggers' : ActorMethod<[Array<TriggerId>], CancelTriggersResult>,
  /**
   * / Close all positions for caller (parameterless kill switch).
   * / Full withdrawal on every position with fees auto-collected. Works in degraded mode.
   */
  'close_all_positions' : ActorMethod<[], CloseAllPositionsResult>,
  /**
   * / Collect accumulated fees and withdrawn tokens from a position into trading balance.
   */
  'collect_fees' : ActorMethod<[PositionId], CollectFeesResult>,
  /**
   * / Unified order creation: optional cancels + book orders + pool swaps.
   * / Cancels execute first (freeing slots + balance), then pool swaps, then book orders.
   * / Uses pre-deposited trading balance.
   */
  'create_orders' : ActorMethod<
    [Array<OrderId>, Array<BookOrderSpec>, Array<PoolSwapSpec>],
    CreateOrdersResult
  >,
  /**
   * / Unified trigger creation: optional cancels + batch create in a single call.
   * / Cancels execute first (freeing slots + balance), then creates.
   */
  'create_triggers' : ActorMethod<
    [Array<TriggerId>, Array<TriggerSpec>],
    CreateTriggersResult
  >,
  /**
   * / Decrease liquidity from an existing position.
   * / Full withdrawal auto-collects fees and deletes the position; partial stores tokens in tokensOwed.
   */
  'decrease_liquidity' : ActorMethod<
    [PositionId, bigint],
    DecreaseLiquidityResult
  >,
  /**
   * / Deposit tokens to trading balance via ICRC-2 transfer_from.
   * / Pre-deposits so subsequent orders can skip async ICRC transfer (fully atomic).
   */
  'deposit' : ActorMethod<[ClaimTokenId, bigint], DepositResult>,
  /**
   * / Complete balance sheet with detailed breakdowns and invariant checks (sync, uses virtual custody).
   * / Covers INV-1a (balance sheet), INV-2 (user fund conservation), INV-3 (pool consistency).
   */
  'get_balance_sheet' : ActorMethod<[], BalanceSheet>,
  /**
   * / Chart data with pagination. before_ts fetches candles before that timestamp.
   */
  'get_chart' : ActorMethod<
    [ChartInterval, [] | [bigint], number],
    {
      'data' : Array<SpotCandle>,
      'next_cursor' : [] | [bigint],
      'has_more' : boolean,
    }
  >,
  /**
   * / Get current control state.
   */
  'get_control' : ActorMethod<[], FrozenControl>,
  /**
   * / Get all data for initial page load in a single atomic call.
   * / Works for both logged-in and logged-out users.
   */
  'get_hydration' : ActorMethod<
    [ChartInterval, number, number, number],
    HydrateResponse
  >,
  /**
   * / Optimized endpoint for indexer canister providing aggregate token stats and per-pool breakdowns.
   */
  'get_indexer_data' : ActorMethod<[], IndexerData>,
  /**
   * / Live candle for a specific chart interval.
   * / Returns CandleData tuple (timestamp, open, high, low, close, volume).
   */
  'get_live_candle' : ActorMethod<[ChartInterval], CandleData>,
  /**
   * / Liquidity lock schedule for investor transparency.
   * / Shows locked vs unlocked TVL and upcoming unlock times.
   */
  'get_lock_schedule' : ActorMethod<[], LiquidityLockSummary>,
  /**
   * / Market depth with separated order book and pool liquidity.
   * / levels sets price levels per side; tick_bucket_size aggregates orders within N ticks (0 = finest).
   */
  'get_market_depth' : ActorMethod<[number, number], MarketDepthResponse>,
  /**
   * / Historical market-level snapshots for TVL charts (explore page token/market detail).
   * / Any interval_hours supported via step pattern over hourly append-only list.
   */
  'get_market_snapshots' : ActorMethod<
    [[] | [bigint], number, number],
    MarketSnapshotsResponse
  >,
  /**
   * / Platform data (conditional fetch when platform_version changes).
   * / Returns price, liquidity, live candle, and market depth for the given interval and depth params.
   */
  'get_platform' : ActorMethod<[ChartInterval, number, number], PlatformData>,
  /**
   * / Get essential state for a specific pool tier identified by fee_pips.
   * / Returns null if no pool exists for the given fee tier.
   */
  'get_pool' : ActorMethod<[number], [] | [PoolState]>,
  /**
   * / Historical fee snapshots for a specific pool (explore page charts).
   * / Any interval_hours supported via step pattern over hourly append-only list.
   */
  'get_pool_snapshots' : ActorMethod<
    [number, [] | [bigint], number, number],
    PoolSnapshotsResponse
  >,
  /**
   * / Overview of all pools with fee tier, position count, and TVL.
   */
  'get_pools_overview' : ActorMethod<[], Array<PoolOverview>>,
  /**
   * / Get position details by ID.
   */
  'get_position' : ActorMethod<[PositionId], [] | [PositionView]>,
  /**
   * / Returns current reference tick (null if market uninitialized).
   */
  'get_reference_tick' : ActorMethod<[], [] | [Tick]>,
  /**
   * / Atomic snapshot of complete routing state for external routers.
   * / Single call provides token metadata, reference tick, pool state, and order book.
   */
  'get_routing_state' : ActorMethod<[], RoutingState>,
  /**
   * / Recent market transactions with cursor-based pagination (newest first).
   * / limit defaults to 20 (max 100); cursor is exclusive on tx_id.
   */
  'get_transactions' : ActorMethod<
    [[] | [number], [] | [bigint]],
    {
      'data' : Array<SpotTransactionResponse>,
      'next_cursor' : [] | [bigint],
      'has_more' : boolean,
    }
  >,
  /**
   * / User account data (conditional fetch when user_version changes).
   * / Returns complete breakdown: orders, positions, trading/locked balances, fees.
   */
  'get_user' : ActorMethod<[], UserData>,
  /**
   * / Get unified activity history for current user (orders, triggers, LP events).
   * / cursor resumes from previous page (null = newest); limit defaults to 20 (max 100).
   */
  'get_user_activity' : ActorMethod<
    [[] | [ChainCursor], [] | [number]],
    GetUserActivityResult
  >,
  /**
   * / Get version counters (primary polling endpoint, ~500ms interval).
   */
  'get_versions' : ActorMethod<[], PollVersions>,
  /**
   * / Increase liquidity in an existing position by position ID.
   */
  'increase_liquidity' : ActorMethod<
    [PositionId, bigint, bigint],
    IncreaseLiquidityResult
  >,
  /**
   * / Lock a position until lock_until_ms (one-way ratchet: can only extend).
   * / Blocks decrease_liquidity and close_all_positions while locked.
   */
  'lock_position' : ActorMethod<[PositionId, bigint], LockPositionResult>,
  /**
   * / Execute a trade directly from wallet using ICRC-2 approval flow (pass-through).
   * / Pulls input via transfer_from, settles output/refund to wallet. Always executes as market order.
   */
  'pass_through_trade' : ActorMethod<
    [PassThroughTradeArgs],
    PassThroughTradeResult
  >,
  /**
   * / Quote order for UI preview. Does not modify state.
   * / Returns pool_swaps for pass-through to create_orders or pass_through_trade.
   */
  'quote_order' : ActorMethod<
    [Side, bigint, Tick, [] | [number]],
    QuoteOrderResult
  >,
  /**
   * / Pay to release a rate-limited principal. Costs 11x quote ledger fee via ICRC-2.
   */
  'release_rate_limit' : ActorMethod<[Principal], ApiResult>,
  /**
   * / Transfer a position to another user. Ownership moves, position stays unchanged.
   * / Locked positions are transferable. Accrued fees carry over to new owner.
   */
  'transfer_position' : ActorMethod<
    [PositionId, Principal],
    TransferPositionResult
  >,
  /**
   * / Update order tick and/or input amount. Closes old order and creates a new one.
   * / Delta vs remaining_input is debited or refunded from trading balance.
   */
  'update_order' : ActorMethod<[OrderId, Tick, bigint], UpdateOrderResult>,
  /**
   * / Withdraw tokens from trading balance to wallet.
   * / Deducts from trading balance before async transfer; credits back on failure.
   */
  'withdraw' : ActorMethod<[ClaimTokenId, bigint], WithdrawResult>,
}
export type SpotCandle = [bigint, bigint, bigint, bigint, bigint, bigint];
export interface SpotTransactionResponse {
  'id' : bigint,
  'usd_value_e6' : bigint,
  'side' : Side,
  'timestamp' : bigint,
  'quote_amount' : bigint,
  'base_amount' : bigint,
  'price_e12' : bigint,
}
export type SqrtPriceX96 = bigint;
export interface SwapResultItem { 'result' : ApiResult__1, 'index' : number }
export type SystemState = { 'normal' : null } |
  { 'halted' : null } |
  { 'degraded' : null };
export type Tick = number;
export interface TickLiquidityData {
  'liquidity_gross' : bigint,
  'tick' : Tick,
  'liquidity_net' : bigint,
}
export type TimestampMs = bigint;
export interface TokenMetadata {
  'fee' : bigint,
  'decimals' : number,
  'ledger' : Principal,
}
export interface TokenPair { 'base' : bigint, 'quote' : bigint }
export interface TokenPairInt { 'base' : bigint, 'quote' : bigint }
export interface TransferActivityDetails {
  'direction' : { 'inbound' : null } |
    { 'outbound' : null },
  'token' : { 'base' : null } |
    { 'quote' : null },
  'block_index' : [] | [bigint],
  'ledger_principal' : Principal,
  'ledger_fee' : bigint,
  'amount' : bigint,
}
export type TransferPositionResult = {
    'ok' : { 'versions' : PollVersions, 'position_id' : PositionId }
  } |
  { 'err' : ApiError };
export interface TriggerActivityDetails {
  'input_amount' : bigint,
  'side' : Side,
  'limit_tick' : number,
  'created_at_ms' : bigint,
  'immediate_or_cancel' : boolean,
  'trigger_id' : bigint,
  'resulting_order_id' : [] | [bigint],
  'trigger_tick' : number,
  'trigger_type' : TriggerType,
}
export interface TriggerDebugEntry {
  'id' : bigint,
  'status' : TriggerStatus,
  'input_amount' : bigint,
  'side' : Side,
  'trigger_tick' : bigint,
}
export type TriggerId = bigint;
export interface TriggerResultItem {
  'result' : ApiResult__1_2,
  'index' : number,
}
export interface TriggerSpec {
  'input_amount' : bigint,
  'reference_tick' : Tick,
  'side' : Side,
  'limit_tick' : Tick,
  'immediate_or_cancel' : boolean,
  'trigger_tick' : Tick,
}
export type TriggerStatus = { 'active' : null } |
  { 'cancelled' : null } |
  { 'activation_failed' : null } |
  { 'triggered' : null };
export type TriggerType = { 'above' : null } |
  { 'below' : null };
export interface TriggerView {
  'status' : TriggerStatus,
  'input_amount' : bigint,
  'owner' : Principal,
  'side' : Side,
  'limit_tick' : Tick,
  'timestamp' : TimestampMs,
  'immediate_or_cancel' : boolean,
  'quote_usd_rate_e12' : bigint,
  'trigger_id' : TriggerId,
  'trigger_tick' : Tick,
  'trigger_type' : TriggerType,
}
export type UpdateOrderResult = {
    'ok' : {
        'modified' : {
          'refunded' : bigint,
          'available_quote' : bigint,
          'available_base' : bigint,
          'versions' : PollVersions,
        }
      } |
      {
        'replaced' : {
          'available_quote' : bigint,
          'available_base' : bigint,
          'order_id' : OrderId,
          'versions' : PollVersions,
        }
      }
  } |
  { 'err' : ApiError };
export interface UpgradeArgs {
  'rate_limit_cleanup_tier2_ms' : [] | [bigint],
  'remove_admins' : [] | [Array<Principal>],
  'set_treasury_principal' : [] | [Principal],
  'rate_limit_cleanup_tier01_ms' : [] | [bigint],
  'set_cycles_threshold' : [] | [bigint],
  'rate_limit_degrade_threshold' : [] | [bigint],
  'set_maker_rebate_pips' : [] | [number],
  'rate_limit_soft_block_cooldown_ms' : [] | [bigint],
  'rate_limit_degrade_max_duration_ms' : [] | [bigint],
  'reset_topup_backoff' : [] | [boolean],
  'max_positions_per_user' : [] | [bigint],
  'rate_limit_degrade_base_duration_ms' : [] | [bigint],
  'set_maker_fee_pips' : [] | [number],
  'max_triggers_per_user' : [] | [bigint],
  'add_admins' : [] | [Array<Principal>],
  'set_pool_protocol_fee_pips' : [] | [bigint],
  'rate_limit_soft_block_threshold' : [] | [bigint],
  'rate_limit_hard_block_threshold' : [] | [bigint],
  'rate_limit_degrade_delta' : [] | [bigint],
  'set_instruction_budget' : [] | [bigint],
  'set_taker_fee_pips' : [] | [number],
  'max_orders_per_user' : [] | [bigint],
}
export type UserData = [] | [
  {
    'net_flows' : NetFlows,
    'fees' : TokenPair,
    'orders' : Array<OrderView>,
    'locked' : LockedBalances,
    'cumulative_lp_fees' : TokenPair,
    'available' : TokenPair,
    'positions' : Array<PositionViewEnhanced>,
    'versions' : PollVersions,
    'triggers' : Array<TriggerView>,
  }
];
export interface UserDebug {
  'principal' : Principal,
  'net_external_quote' : bigint,
  'pending_base' : bigint,
  'pending_quote' : bigint,
  'net_lp_quote' : bigint,
  'orders' : Array<OrderDebugEntry>,
  'locked_quote' : bigint,
  'net_lp_base' : bigint,
  'net_swap_quote' : bigint,
  'fees_quote' : bigint,
  'available_quote' : bigint,
  'net_swap_base' : bigint,
  'available_base' : bigint,
  'locked_base' : bigint,
  'net_external_base' : bigint,
  'positions' : Array<PositionDebugEntry>,
  'inv2_drift_quote' : bigint,
  'fees_base' : bigint,
  'inv2_drift_base' : bigint,
  'triggers' : Array<TriggerDebugEntry>,
}
export interface VenueBreakdown {
  'input_amount' : bigint,
  'venue_id' : VenueId,
  'output_amount' : bigint,
  'fee_amount' : bigint,
}
export type VenueId = { 'book' : null } |
  { 'pool' : number };
export type WithdrawResult = {
    'ok' : {
      'block_index' : [] | [bigint],
      'remaining' : bigint,
      'withdrawn' : bigint,
      'versions' : PollVersions,
    }
  } |
  { 'err' : ApiError };
export interface WriteCandlesResult {
  'errors' : bigint,
  'backfilled' : bigint,
  'overwritten' : bigint,
}
/**
 * / Spot trading canister with hybrid CLOB+AMM execution.
 * / Supports limit orders, triggers, concentrated liquidity, and direct ICRC trades.
 */
export interface _SERVICE extends Spot {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
