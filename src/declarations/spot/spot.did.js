export const idlFactory = ({ IDL }) => {
  const TokenMetadata = IDL.Record({
    'fee' : IDL.Nat,
    'decimals' : IDL.Nat8,
    'ledger' : IDL.Principal,
  });
  const InitArgs = IDL.Record({
    'maker_fee_pips' : IDL.Opt(IDL.Nat32),
    'taker_fee_pips' : IDL.Opt(IDL.Nat32),
    'oracle_principal' : IDL.Principal,
    'token0' : TokenMetadata,
    'token1' : TokenMetadata,
    'treasury_principal' : IDL.Opt(IDL.Principal),
    'maker_rebate_pips' : IDL.Opt(IDL.Nat32),
    'indexer_principal' : IDL.Principal,
    'registry_principal' : IDL.Principal,
    'admin_principals' : IDL.Vec(IDL.Principal),
  });
  const Tick = IDL.Int32;
  const PollVersions = IDL.Record({
    'user' : IDL.Nat,
    'platform' : IDL.Nat,
    'orderbook' : IDL.Nat,
    'candle' : IDL.Nat,
  });
  const PositionId = IDL.Nat64;
  const ErrorCategory = IDL.Variant({
    'resource' : IDL.Null,
    'admin' : IDL.Null,
    'other' : IDL.Null,
    'rate_limit' : IDL.Null,
    'state' : IDL.Null,
    'validation' : IDL.Null,
    'external' : IDL.Null,
    'authorization' : IDL.Null,
  });
  const ApiError = IDL.Record({
    'metadata' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))),
    'code' : IDL.Text,
    'message' : IDL.Text,
    'category' : ErrorCategory,
  });
  const LiquidityResult = IDL.Variant({
    'ok' : IDL.Record({
      'actual_amt0' : IDL.Nat,
      'actual_amt1' : IDL.Nat,
      'versions' : PollVersions,
      'position_id' : PositionId,
    }),
    'err' : ApiError,
  });
  const LogLevel = IDL.Variant({
    'Error' : IDL.Null,
    'Info' : IDL.Null,
    'Warn' : IDL.Null,
    'Debug' : IDL.Null,
    'Critical' : IDL.Null,
  });
  const EventLogEntry = IDL.Record({
    'id' : IDL.Nat64,
    'principal' : IDL.Opt(IDL.Principal),
    'context' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'level' : LogLevel,
    'event' : IDL.Text,
    'message' : IDL.Text,
    'timestamp' : IDL.Nat64,
  });
  const EventLogPage = IDL.Record({
    'data' : IDL.Vec(EventLogEntry),
    'next_cursor' : IDL.Opt(IDL.Nat64),
    'has_more' : IDL.Bool,
  });
  const ApiResult_6 = IDL.Variant({ 'ok' : EventLogPage, 'err' : ApiError });
  const Side = IDL.Variant({ 'buy' : IDL.Null, 'sell' : IDL.Null });
  const OrderDebugEntry = IDL.Record({
    'id' : IDL.Nat,
    'side' : Side,
    'tick' : IDL.Int,
    'locked_input' : IDL.Nat,
    'remaining_input' : IDL.Nat,
  });
  const PositionDebugEntry = IDL.Record({
    'id' : IDL.Nat,
    'liquidity' : IDL.Nat,
    'fee_pips' : IDL.Nat32,
    'tick_lower' : IDL.Int,
    'tokens_owed_0' : IDL.Nat,
    'tokens_owed_1' : IDL.Nat,
    'tick_upper' : IDL.Int,
  });
  const TriggerStatus = IDL.Variant({
    'active' : IDL.Null,
    'cancelled' : IDL.Null,
    'activation_failed' : IDL.Null,
    'triggered' : IDL.Null,
  });
  const TriggerDebugEntry = IDL.Record({
    'id' : IDL.Nat,
    'status' : TriggerStatus,
    'input_amount' : IDL.Nat,
    'side' : Side,
    'trigger_tick' : IDL.Int,
  });
  const UserDebug = IDL.Record({
    'principal' : IDL.Principal,
    'net_external_quote' : IDL.Int,
    'pending_base' : IDL.Nat,
    'pending_quote' : IDL.Nat,
    'net_lp_quote' : IDL.Int,
    'orders' : IDL.Vec(OrderDebugEntry),
    'locked_quote' : IDL.Nat,
    'net_lp_base' : IDL.Int,
    'net_swap_quote' : IDL.Int,
    'fees_quote' : IDL.Nat,
    'available_quote' : IDL.Nat,
    'net_swap_base' : IDL.Int,
    'available_base' : IDL.Nat,
    'locked_base' : IDL.Nat,
    'net_external_base' : IDL.Int,
    'positions' : IDL.Vec(PositionDebugEntry),
    'inv2_drift_quote' : IDL.Int,
    'fees_base' : IDL.Nat,
    'inv2_drift_base' : IDL.Int,
    'triggers' : IDL.Vec(TriggerDebugEntry),
  });
  const ApiResult_5 = IDL.Variant({
    'ok' : IDL.Opt(UserDebug),
    'err' : ApiError,
  });
  const KillAllResult = IDL.Record({
    'orders' : IDL.Nat,
    'budget_hit' : IDL.Bool,
    'positions' : IDL.Nat,
    'triggers' : IDL.Nat,
  });
  const ApiResult_4 = IDL.Variant({ 'ok' : KillAllResult, 'err' : ApiError });
  const ApiResult = IDL.Variant({ 'ok' : IDL.Bool, 'err' : ApiError });
  const ApiResult__1_1 = IDL.Variant({ 'ok' : IDL.Null, 'err' : ApiError });
  const SystemState = IDL.Variant({
    'normal' : IDL.Null,
    'halted' : IDL.Null,
    'degraded' : IDL.Null,
  });
  const UpgradeArgs = IDL.Record({
    'rate_limit_cleanup_tier2_ms' : IDL.Opt(IDL.Nat64),
    'remove_admins' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'set_treasury_principal' : IDL.Opt(IDL.Principal),
    'rate_limit_cleanup_tier01_ms' : IDL.Opt(IDL.Nat64),
    'set_cycles_threshold' : IDL.Opt(IDL.Nat),
    'rate_limit_degrade_threshold' : IDL.Opt(IDL.Nat),
    'set_maker_rebate_pips' : IDL.Opt(IDL.Nat32),
    'rate_limit_soft_block_cooldown_ms' : IDL.Opt(IDL.Nat64),
    'rate_limit_degrade_max_duration_ms' : IDL.Opt(IDL.Nat64),
    'reset_topup_backoff' : IDL.Opt(IDL.Bool),
    'max_positions_per_user' : IDL.Opt(IDL.Nat),
    'rate_limit_degrade_base_duration_ms' : IDL.Opt(IDL.Nat64),
    'set_maker_fee_pips' : IDL.Opt(IDL.Nat32),
    'max_triggers_per_user' : IDL.Opt(IDL.Nat),
    'add_admins' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'set_pool_protocol_fee_pips' : IDL.Opt(IDL.Nat),
    'rate_limit_soft_block_threshold' : IDL.Opt(IDL.Nat),
    'rate_limit_hard_block_threshold' : IDL.Opt(IDL.Nat),
    'rate_limit_degrade_delta' : IDL.Opt(IDL.Nat),
    'set_instruction_budget' : IDL.Opt(IDL.Nat64),
    'set_taker_fee_pips' : IDL.Opt(IDL.Nat32),
    'max_orders_per_user' : IDL.Opt(IDL.Nat),
  });
  const ApiResult_2 = IDL.Variant({ 'ok' : IDL.Nat, 'err' : ApiError });
  const ChartInterval = IDL.Variant({
    'min15' : IDL.Null,
    'hour1' : IDL.Null,
    'hour4' : IDL.Null,
    'day1' : IDL.Null,
    'min1' : IDL.Null,
  });
  const SpotCandle = IDL.Tuple(
    IDL.Nat64,
    IDL.Nat64,
    IDL.Nat64,
    IDL.Nat64,
    IDL.Nat64,
    IDL.Nat,
  );
  const WriteCandlesResult = IDL.Record({
    'errors' : IDL.Nat,
    'backfilled' : IDL.Nat,
    'overwritten' : IDL.Nat,
  });
  const ApiResult_1 = IDL.Variant({
    'ok' : WriteCandlesResult,
    'err' : ApiError,
  });
  const CancelAllOrdersResult = IDL.Variant({
    'ok' : IDL.Record({
      'cancelled' : IDL.Nat32,
      'available_quote' : IDL.Nat,
      'available_base' : IDL.Nat,
      'versions' : PollVersions,
    }),
    'err' : ApiError,
  });
  const CancelAllTriggersResult = IDL.Variant({
    'ok' : IDL.Record({
      'cancelled' : IDL.Nat32,
      'available_quote' : IDL.Nat,
      'available_base' : IDL.Nat,
      'versions' : PollVersions,
    }),
    'err' : ApiError,
  });
  const OrderId = IDL.Nat;
  const CancelOrderResultItem = IDL.Record({
    'result' : ApiResult__1_1,
    'order_id' : OrderId,
  });
  const BatchSummary = IDL.Record({
    'failed' : IDL.Nat32,
    'succeeded' : IDL.Nat32,
  });
  const CancelOrdersResult = IDL.Variant({
    'ok' : IDL.Record({
      'results' : IDL.Vec(CancelOrderResultItem),
      'available_quote' : IDL.Nat,
      'summary' : BatchSummary,
      'available_base' : IDL.Nat,
      'versions' : PollVersions,
    }),
    'err' : ApiError,
  });
  const TriggerId = IDL.Nat;
  const CancelTriggerResultItem = IDL.Record({
    'result' : ApiResult__1_1,
    'trigger_id' : TriggerId,
  });
  const CancelTriggersResult = IDL.Variant({
    'ok' : IDL.Record({
      'results' : IDL.Vec(CancelTriggerResultItem),
      'available_quote' : IDL.Nat,
      'summary' : BatchSummary,
      'available_base' : IDL.Nat,
      'versions' : PollVersions,
    }),
    'err' : ApiError,
  });
  const CloseAllPositionsResult = IDL.Variant({
    'ok' : IDL.Record({
      'closed' : IDL.Nat32,
      'amount0' : IDL.Nat,
      'amount1' : IDL.Nat,
      'versions' : PollVersions,
    }),
    'err' : ApiError,
  });
  const CollectFeesResult = IDL.Variant({
    'ok' : IDL.Record({
      'collected_amt0' : IDL.Nat,
      'collected_amt1' : IDL.Nat,
      'versions' : PollVersions,
    }),
    'err' : ApiError,
  });
  const BookOrderSpec = IDL.Record({
    'input_amount' : IDL.Nat,
    'side' : Side,
    'limit_tick' : Tick,
    'immediate_or_cancel' : IDL.Bool,
  });
  const PoolSwapSpec = IDL.Record({
    'input_amount' : IDL.Nat,
    'side' : Side,
    'limit_tick' : Tick,
    'fee_pips' : IDL.Nat32,
  });
  const ApiResult__1 = IDL.Variant({
    'ok' : IDL.Record({
      'fee' : IDL.Nat,
      'input_amount' : IDL.Nat,
      'output_amount' : IDL.Nat,
    }),
    'err' : ApiError,
  });
  const SwapResultItem = IDL.Record({
    'result' : ApiResult__1,
    'index' : IDL.Nat32,
  });
  const ApiResult__1_3 = IDL.Variant({
    'ok' : IDL.Record({ 'order_id' : OrderId }),
    'err' : ApiError,
  });
  const OrderResultItem = IDL.Record({
    'result' : ApiResult__1_3,
    'index' : IDL.Nat32,
  });
  const CreateOrdersResult = IDL.Variant({
    'ok' : IDL.Record({
      'swap_results' : IDL.Vec(SwapResultItem),
      'cancel_results' : IDL.Vec(CancelOrderResultItem),
      'order_results' : IDL.Vec(OrderResultItem),
      'cancel_summary' : BatchSummary,
      'order_summary' : BatchSummary,
      'available_quote' : IDL.Nat,
      'available_base' : IDL.Nat,
      'versions' : PollVersions,
    }),
    'err' : ApiError,
  });
  const TriggerSpec = IDL.Record({
    'input_amount' : IDL.Nat,
    'reference_tick' : Tick,
    'side' : Side,
    'limit_tick' : Tick,
    'immediate_or_cancel' : IDL.Bool,
    'trigger_tick' : Tick,
  });
  const ApiResult__1_2 = IDL.Variant({
    'ok' : IDL.Record({ 'trigger_id' : TriggerId }),
    'err' : ApiError,
  });
  const TriggerResultItem = IDL.Record({
    'result' : ApiResult__1_2,
    'index' : IDL.Nat32,
  });
  const CreateTriggersResult = IDL.Variant({
    'ok' : IDL.Record({
      'cancel_results' : IDL.Vec(CancelTriggerResultItem),
      'cancel_summary' : BatchSummary,
      'results' : IDL.Vec(TriggerResultItem),
      'available_quote' : IDL.Nat,
      'summary' : BatchSummary,
      'available_base' : IDL.Nat,
      'versions' : PollVersions,
    }),
    'err' : ApiError,
  });
  const DecreaseLiquidityResult = IDL.Variant({
    'ok' : IDL.Record({
      'amount0' : IDL.Nat,
      'amount1' : IDL.Nat,
      'versions' : PollVersions,
    }),
    'err' : ApiError,
  });
  const ClaimTokenId = IDL.Variant({ 'base' : IDL.Null, 'quote' : IDL.Null });
  const DepositResult = IDL.Variant({
    'ok' : IDL.Record({
      'block_index' : IDL.Nat,
      'new_balance' : IDL.Nat,
      'versions' : PollVersions,
      'credited' : IDL.Nat,
    }),
    'err' : ApiError,
  });
  const NetTracking = IDL.Record({
    'net_external_quote' : IDL.Int,
    'net_lp_quote' : IDL.Int,
    'net_lp_base' : IDL.Int,
    'net_swap_quote' : IDL.Int,
    'net_swap_base' : IDL.Int,
    'total_net_quote' : IDL.Int,
    'net_external_base' : IDL.Int,
    'total_net_base' : IDL.Int,
  });
  const LiabilitiesBreakdown = IDL.Record({
    'orders_output_base' : IDL.Nat,
    'total' : IDL.Nat,
    'pending_base' : IDL.Nat,
    'pending_quote' : IDL.Nat,
    'triggers_quote' : IDL.Nat,
    'pool_reserves_quote' : IDL.Nat,
    'total_base' : IDL.Nat,
    'available_quote' : IDL.Nat,
    'available_base' : IDL.Nat,
    'pool_reserves_base' : IDL.Nat,
    'orders_quote' : IDL.Nat,
    'total_quote' : IDL.Nat,
    'orders_base' : IDL.Nat,
    'orders_output_quote' : IDL.Nat,
    'triggers_base' : IDL.Nat,
  });
  const AssetsBreakdown = IDL.Record({
    'total' : IDL.Nat,
    'quote_balance' : IDL.Nat,
    'base_balance' : IDL.Nat,
  });
  const PoolInvariantStatus = IDL.Record({
    'liquidity_net_sum' : IDL.Int,
    'liquidity' : IDL.Nat,
    'computed_liquidity' : IDL.Nat,
    'inv3c_balanced' : IDL.Bool,
    'fee_pips' : IDL.Nat32,
    'inv3b_balanced' : IDL.Bool,
    'inv3a_balanced' : IDL.Bool,
  });
  const AllUsersDebug = IDL.Record({
    'user_count' : IDL.Nat,
    'total_net_lp_quote' : IDL.Int,
    'inv2_balanced' : IDL.Bool,
    'total_inv2_drift_quote' : IDL.Int,
    'total_fees_base' : IDL.Nat,
    'total_net_lp_base' : IDL.Int,
    'total_locked_quote' : IDL.Nat,
    'total_pending_quote' : IDL.Nat,
    'total_net_swap_quote' : IDL.Int,
    'total_inv2_drift_base' : IDL.Int,
    'total_available_base' : IDL.Nat,
    'total_locked_base' : IDL.Nat,
    'total_fees_quote' : IDL.Nat,
    'total_net_external_quote' : IDL.Int,
    'total_net_external_base' : IDL.Int,
    'total_net_swap_base' : IDL.Int,
    'users_with_drift' : IDL.Nat,
    'total_available_quote' : IDL.Nat,
    'total_pending_base' : IDL.Nat,
  });
  const EquityBreakdown = IDL.Record({
    'total' : IDL.Nat,
    'withdrawn_quote' : IDL.Nat,
    'op_fees_base' : IDL.Nat,
    'withdrawn_base' : IDL.Nat,
    'op_fees_quote' : IDL.Nat,
    'total_base' : IDL.Nat,
    'book_fees_quote' : IDL.Nat,
    'available_quote' : IDL.Nat,
    'book_fees_base' : IDL.Nat,
    'available_base' : IDL.Nat,
    'pool_fees_base' : IDL.Nat,
    'pool_fees_quote' : IDL.Nat,
    'total_quote' : IDL.Nat,
  });
  const ProtocolEquitySummary = IDL.Record({
    'pool_fees' : IDL.Tuple(IDL.Nat, IDL.Nat),
    'book_fees' : IDL.Tuple(IDL.Nat, IDL.Nat),
    'available' : IDL.Tuple(IDL.Nat, IDL.Nat),
    'op_fees' : IDL.Tuple(IDL.Nat, IDL.Nat),
    'withdrawn' : IDL.Tuple(IDL.Nat, IDL.Nat),
  });
  const BalanceSheet = IDL.Record({
    'net_tracking' : NetTracking,
    'liabilities' : LiabilitiesBreakdown,
    'expected_quote' : IDL.Nat,
    'assets' : AssetsBreakdown,
    'pool_invariants' : IDL.Record({
      'all_pools_healthy' : IDL.Bool,
      'unhealthy_pools' : IDL.Vec(IDL.Nat32),
      'pools' : IDL.Vec(PoolInvariantStatus),
    }),
    'drift_base' : IDL.Int,
    'expected_base' : IDL.Nat,
    'drift_quote' : IDL.Int,
    'users_debug' : AllUsersDebug,
    'is_balanced' : IDL.Bool,
    'equity' : EquityBreakdown,
    'protocol_equity' : ProtocolEquitySummary,
  });
  const FrozenControl = IDL.Record({
    'triggers_live' : IDL.Nat,
    'pool_protocol_fee_pips' : IDL.Nat,
    'maker_fee_pips' : IDL.Nat32,
    'system_state' : SystemState,
    'instruction_budget' : IDL.Nat64,
    'timer_running' : IDL.Bool,
    'taker_fee_pips' : IDL.Nat32,
    'market_initialized' : IDL.Bool,
    'oracle_principal' : IDL.Principal,
    'cycles_threshold' : IDL.Nat,
    'max_positions_per_user' : IDL.Nat,
    'token0' : IDL.Record({
      'fee' : IDL.Nat,
      'decimals' : IDL.Nat8,
      'ledger' : IDL.Principal,
    }),
    'token1' : IDL.Record({
      'fee' : IDL.Nat,
      'decimals' : IDL.Nat8,
      'ledger' : IDL.Principal,
    }),
    'treasury_principal' : IDL.Opt(IDL.Principal),
    'maker_rebate_pips' : IDL.Nat32,
    'users' : IDL.Nat,
    'max_triggers_per_user' : IDL.Nat,
    'indexer_principal' : IDL.Principal,
    'pools' : IDL.Nat,
    'registry_principal' : IDL.Principal,
    'positions' : IDL.Nat,
    'this_principal' : IDL.Principal,
    'orders_live' : IDL.Nat,
    'max_orders_per_user' : IDL.Nat,
    'admin_principals' : IDL.Vec(IDL.Principal),
  });
  const TokenPairInt = IDL.Record({ 'base' : IDL.Int, 'quote' : IDL.Int });
  const NetFlows = IDL.Record({
    'lp' : TokenPairInt,
    'swap' : TokenPairInt,
    'external' : TokenPairInt,
  });
  const TokenPair = IDL.Record({ 'base' : IDL.Nat, 'quote' : IDL.Nat });
  const OrderStatus = IDL.Variant({
    'cancelled' : IDL.Null,
    'pending' : IDL.Null,
    'filled' : IDL.Null,
    'partial' : IDL.Null,
  });
  const OrderView = IDL.Record({
    'fee' : IDL.Int,
    'status' : OrderStatus,
    'side' : Side,
    'tick' : Tick,
    'quote_filled' : IDL.Nat,
    'base_filled' : IDL.Nat,
    'timestamp' : IDL.Nat64,
    'quote_amount' : IDL.Nat,
    'order_id' : IDL.Nat64,
    'base_amount' : IDL.Nat,
    'immediate_or_cancel' : IDL.Bool,
    'quote_usd_rate_e12' : IDL.Nat,
  });
  const LockedBalances = IDL.Record({
    'orders' : TokenPair,
    'positions' : TokenPair,
    'triggers' : TokenPair,
  });
  const Liquidity = IDL.Nat;
  const PositionViewEnhanced = IDL.Record({
    'fees_usd_value_e6' : IDL.Nat,
    'owner' : IDL.Principal,
    'usd_value_e6' : IDL.Nat,
    'liquidity' : Liquidity,
    'amount_quote' : IDL.Nat,
    'apr_bps' : IDL.Nat,
    'fees_quote' : IDL.Nat,
    'amount_base' : IDL.Nat,
    'fee_pips' : IDL.Nat32,
    'locked_until' : IDL.Opt(IDL.Nat64),
    'tick_lower' : Tick,
    'tick_upper' : Tick,
    'fees_base' : IDL.Nat,
    'position_id' : PositionId,
  });
  const TimestampMs = IDL.Nat64;
  const TriggerType = IDL.Variant({ 'above' : IDL.Null, 'below' : IDL.Null });
  const TriggerView = IDL.Record({
    'status' : TriggerStatus,
    'input_amount' : IDL.Nat,
    'owner' : IDL.Principal,
    'side' : Side,
    'limit_tick' : Tick,
    'timestamp' : TimestampMs,
    'immediate_or_cancel' : IDL.Bool,
    'quote_usd_rate_e12' : IDL.Nat,
    'trigger_id' : TriggerId,
    'trigger_tick' : Tick,
    'trigger_type' : TriggerType,
  });
  const UserData = IDL.Opt(
    IDL.Record({
      'net_flows' : NetFlows,
      'fees' : TokenPair,
      'orders' : IDL.Vec(OrderView),
      'locked' : LockedBalances,
      'cumulative_lp_fees' : TokenPair,
      'available' : TokenPair,
      'positions' : IDL.Vec(PositionViewEnhanced),
      'versions' : PollVersions,
      'triggers' : IDL.Vec(TriggerView),
    })
  );
  const CandleData = IDL.Tuple(
    IDL.Nat64,
    IDL.Nat64,
    IDL.Nat64,
    IDL.Nat64,
    IDL.Nat64,
    IDL.Nat,
  );
  const SqrtPriceX96 = IDL.Nat;
  const BookLevelAggregated = IDL.Record({
    'order_count' : IDL.Nat,
    'tick' : Tick,
    'amount' : IDL.Nat,
  });
  const TickLiquidityData = IDL.Record({
    'liquidity_gross' : IDL.Nat,
    'tick' : Tick,
    'liquidity_net' : IDL.Int,
  });
  const PoolDepthData = IDL.Record({
    'sqrt_price_x96' : SqrtPriceX96,
    'liquidity' : IDL.Nat,
    'fee_pips' : IDL.Nat32,
    'current_tick' : Tick,
    'initialized_ticks' : IDL.Vec(TickLiquidityData),
    'tick_spacing' : IDL.Nat,
  });
  const MarketDepthResponse = IDL.Record({
    'book_asks' : IDL.Vec(BookLevelAggregated),
    'book_bids' : IDL.Vec(BookLevelAggregated),
    'version' : IDL.Nat,
    'last_trade_sqrt_price_x96' : SqrtPriceX96,
    'pools' : IDL.Vec(PoolDepthData),
  });
  const PlatformData = IDL.Record({
    'triggers_live' : IDL.Nat,
    'book_depth_base_usd_e6' : IDL.Nat,
    'maker_fee_pips' : IDL.Nat32,
    'reference_tick' : IDL.Opt(Tick),
    'last_book_tick' : IDL.Opt(Tick),
    'liquidity' : Liquidity,
    'volume_24h_usd_e6' : IDL.Nat,
    'taker_fee_pips' : IDL.Nat32,
    'book_depth_quote_usd_e6' : IDL.Nat,
    'total_transactions' : IDL.Nat64,
    'maker_rebate_pips' : IDL.Nat32,
    'users' : IDL.Nat,
    'candle' : CandleData,
    'current_price_usd_e12' : IDL.Nat,
    'last_trade_sqrt_price_x96' : IDL.Opt(SqrtPriceX96),
    'pool_depth_base_usd_e6' : IDL.Nat,
    'market_depth' : MarketDepthResponse,
    'price_change_24h_bps' : IDL.Int,
    'pool_depth_quote_usd_e6' : IDL.Nat,
    'last_trade_tick' : IDL.Opt(Tick),
    'orders_live' : IDL.Nat,
    'total_positions' : IDL.Nat,
  });
  const SpotTransactionResponse = IDL.Record({
    'id' : IDL.Nat64,
    'usd_value_e6' : IDL.Nat64,
    'side' : Side,
    'timestamp' : IDL.Nat64,
    'quote_amount' : IDL.Nat,
    'base_amount' : IDL.Nat,
    'price_e12' : IDL.Nat64,
  });
  const HydrateResponse = IDL.Record({
    'chart' : IDL.Record({
      'data' : IDL.Vec(SpotCandle),
      'next_cursor' : IDL.Opt(IDL.Nat64),
      'has_more' : IDL.Bool,
    }),
    'user' : UserData,
    'platform' : PlatformData,
    'versions' : PollVersions,
    'recent_trades' : IDL.Record({
      'data' : IDL.Vec(SpotTransactionResponse),
      'next_cursor' : IDL.Opt(IDL.Nat64),
      'has_more' : IDL.Bool,
    }),
  });
  const IndexerPoolData = IDL.Record({
    'volume_cumulative_usd_e6' : IDL.Nat,
    'tvl_usd_e6' : IDL.Nat,
    'volume_24h_usd_e6' : IDL.Nat,
    'fees_24h_usd_e6' : IDL.Nat,
    'apr_bps' : IDL.Nat,
    'quote_ledger' : IDL.Principal,
    'fee_pips' : IDL.Nat32,
    'current_price_usd_e12' : IDL.Nat,
    'volume_30d_usd_e6' : IDL.Nat,
    'volume_7d_usd_e6' : IDL.Nat,
  });
  const IndexerTokenData = IDL.Record({
    'volume_cumulative_usd_e6' : IDL.Nat,
    'price_change_bps' : IDL.Tuple(IDL.Int, IDL.Int, IDL.Int, IDL.Int, IDL.Int),
    'volume_24h_usd_e6' : IDL.Nat,
    'current_price_usd_e12' : IDL.Nat,
    'volume_30d_usd_e6' : IDL.Nat,
    'volume_7d_usd_e6' : IDL.Nat,
  });
  const IndexerData = IDL.Record({
    'triggers_live' : IDL.Nat32,
    'base_tvl_usd_e6' : IDL.Nat,
    'pool_data' : IDL.Vec(IndexerPoolData),
    'book_fees_cumulative_usd_e6' : IDL.Nat,
    'total_transactions' : IDL.Nat64,
    'book_volume_cumulative_usd_e6' : IDL.Nat,
    'book_open_interest_usd_e6' : IDL.Nat,
    'trigger_locked_usd_e6' : IDL.Nat,
    'token_data' : IndexerTokenData,
    'orders_live' : IDL.Nat32,
    'quote_tvl_usd_e6' : IDL.Nat,
    'total_positions' : IDL.Nat32,
    'pool_reserve_usd_e6' : IDL.Nat,
  });
  const LockScheduleEntry = IDL.Record({
    'locked_until_ms' : IDL.Nat64,
    'quote_usd_e6' : IDL.Nat,
    'base_usd_e6' : IDL.Nat,
    'liquidity' : IDL.Nat,
    'fee_pips' : IDL.Nat32,
    'position_id' : PositionId,
  });
  const LiquidityLockSummary = IDL.Record({
    'locked_position_count' : IDL.Nat,
    'total_position_count' : IDL.Nat,
    'total_unlocked_base_usd_e6' : IDL.Nat,
    'total_locked_quote_usd_e6' : IDL.Nat,
    'schedule' : IDL.Vec(LockScheduleEntry),
    'total_unlocked_quote_usd_e6' : IDL.Nat,
    'total_locked_base_usd_e6' : IDL.Nat,
  });
  const MarketSnapshotView = IDL.Record({
    'triggers_live' : IDL.Nat,
    'pool_volume_quote' : IDL.Nat,
    'trigger_locked_base' : IDL.Nat,
    'book_volume_quote' : IDL.Nat,
    'base_custody' : IDL.Nat,
    'pool_volume_usd_e6' : IDL.Nat,
    'pool_base_reserve' : IDL.Nat,
    'total_transactions' : IDL.Nat64,
    'book_fees_usd_e6' : IDL.Nat,
    'book_open_interest_base' : IDL.Nat,
    'timestamp' : IDL.Nat64,
    'users' : IDL.Nat,
    'quote_custody' : IDL.Nat,
    'book_volume_usd_e6' : IDL.Nat,
    'trigger_locked_quote' : IDL.Nat,
    'pool_fees_usd_e6' : IDL.Nat,
    'reference_price_e12' : IDL.Nat,
    'book_open_interest_quote' : IDL.Nat,
    'orders_live' : IDL.Nat,
    'pool_quote_reserve' : IDL.Nat,
    'total_positions' : IDL.Nat,
  });
  const MarketSnapshotsResponse = IDL.Record({
    'data' : IDL.Vec(MarketSnapshotView),
    'next_cursor' : IDL.Opt(IDL.Nat64),
    'has_more' : IDL.Bool,
  });
  const PoolState = IDL.Record({
    'sqrt_price_x96' : SqrtPriceX96,
    'tvl_usd_e6' : IDL.Nat,
    'tick' : Tick,
    'liquidity' : IDL.Nat,
    'volume_24h_usd_e6' : IDL.Nat,
    'fees_24h_usd_e6' : IDL.Nat,
    'token1_reserve' : IDL.Nat,
    'apr_bps' : IDL.Nat,
    'token0_reserve' : IDL.Nat,
    'fee_pips' : IDL.Nat32,
    'initialized_ticks' : IDL.Vec(TickLiquidityData),
    'tick_spacing' : IDL.Nat,
  });
  const PoolSnapshotView = IDL.Record({
    'base_reserve' : IDL.Nat,
    'timestamp' : IDL.Nat64,
    'quote_reserve' : IDL.Nat,
    'fees_usd_e6' : IDL.Nat,
    'volume_quote' : IDL.Nat,
    'volume_usd_e6' : IDL.Nat,
  });
  const PoolSnapshotsResponse = IDL.Record({
    'data' : IDL.Vec(PoolSnapshotView),
    'next_cursor' : IDL.Opt(IDL.Nat64),
    'has_more' : IDL.Bool,
  });
  const PoolOverview = IDL.Record({
    'quote_usd_e6' : IDL.Nat,
    'base_usd_e6' : IDL.Nat,
    'tick' : Tick,
    'volume_24h_usd_e6' : IDL.Nat,
    'apr_bps' : IDL.Nat,
    'fee_pips' : IDL.Nat32,
    'positions' : IDL.Nat,
  });
  const PositionView = IDL.Record({
    'uncollected_fees_base' : IDL.Nat,
    'owner' : IDL.Principal,
    'uncollected_fees_quote' : IDL.Nat,
    'fee_growth_inside_1_last_x128' : IDL.Nat,
    'liquidity' : Liquidity,
    'fee_pips' : IDL.Nat32,
    'locked_until' : IDL.Opt(IDL.Nat64),
    'tick_lower' : Tick,
    'fee_growth_inside_0_last_x128' : IDL.Nat,
    'tick_upper' : Tick,
    'position_id' : PositionId,
  });
  const BookLevelRaw = IDL.Record({ 'total' : IDL.Nat, 'tick' : Tick });
  const BookLevelsResponse = IDL.Record({
    'asks' : IDL.Vec(BookLevelRaw),
    'bids' : IDL.Vec(BookLevelRaw),
  });
  const RoutingTokenInfo = IDL.Record({
    'fee' : IDL.Nat,
    'decimals' : IDL.Nat8,
    'ledger' : IDL.Principal,
  });
  const RoutingPoolState = IDL.Record({
    'sqrt_price_x96' : SqrtPriceX96,
    'tick' : Tick,
    'liquidity' : IDL.Nat,
    'token1_reserve' : IDL.Nat,
    'token0_reserve' : IDL.Nat,
    'fee_pips' : IDL.Nat32,
    'initialized_ticks' : IDL.Vec(TickLiquidityData),
    'tick_spacing' : IDL.Nat,
  });
  const RoutingState = IDL.Record({
    'maker_fee_pips' : IDL.Nat32,
    'reference_tick' : IDL.Opt(Tick),
    'system_state' : SystemState,
    'last_book_tick' : IDL.Opt(Tick),
    'book' : BookLevelsResponse,
    'taker_fee_pips' : IDL.Nat32,
    'token0' : RoutingTokenInfo,
    'token1' : RoutingTokenInfo,
    'last_trade_sqrt_price_x96' : IDL.Opt(SqrtPriceX96),
    'pools' : IDL.Vec(RoutingPoolState),
    'last_trade_tick' : IDL.Opt(Tick),
  });
  const ChainCursor = IDL.Record({
    'id' : IDL.Nat64,
    'offset' : IDL.Nat32,
    'partition' : IDL.Nat16,
  });
  const ActivityType = IDL.Variant({
    'trigger_fired' : IDL.Null,
    'transfer_out' : IDL.Null,
    'trigger_cancelled' : IDL.Null,
    'order_cancelled' : IDL.Null,
    'transfer_in' : IDL.Null,
    'lp_fees_collected' : IDL.Null,
    'lp_transferred' : IDL.Null,
    'trigger_failed' : IDL.Null,
    'transfer_in_failed' : IDL.Null,
    'lp_closed' : IDL.Null,
    'lp_decreased' : IDL.Null,
    'lp_opened' : IDL.Null,
    'circuit_breaker_penalty' : IDL.Null,
    'lp_increased' : IDL.Null,
    'order_filled' : IDL.Null,
    'lp_locked' : IDL.Null,
    'order_partial' : IDL.Null,
    'transfer_out_failed' : IDL.Null,
    'order_modified' : IDL.Null,
  });
  const TriggerActivityDetails = IDL.Record({
    'input_amount' : IDL.Nat,
    'side' : Side,
    'limit_tick' : IDL.Int32,
    'created_at_ms' : IDL.Nat64,
    'immediate_or_cancel' : IDL.Bool,
    'trigger_id' : IDL.Nat64,
    'resulting_order_id' : IDL.Opt(IDL.Nat64),
    'trigger_tick' : IDL.Int32,
    'trigger_type' : TriggerType,
  });
  const PenaltyActivityDetails = IDL.Record({
    'token' : IDL.Variant({ 'base' : IDL.Null, 'quote' : IDL.Null }),
    'tick_after' : IDL.Int32,
    'bound_lower' : IDL.Int32,
    'bound_upper' : IDL.Int32,
    'order_id' : IDL.Nat64,
    'penalty_amount' : IDL.Nat,
    'tick_before' : IDL.Int32,
    'pool_fee_pips' : IDL.Nat32,
  });
  const OrderActivityDetails = IDL.Record({
    'output_received' : IDL.Nat,
    'input_spent' : IDL.Nat,
    'side' : Side,
    'tick' : IDL.Int32,
    'created_at_ms' : IDL.Nat64,
    'locked_input' : IDL.Nat,
    'order_id' : IDL.Nat64,
    'immediate_or_cancel' : IDL.Bool,
    'fees_paid' : IDL.Int,
  });
  const LiquidityActivityDetails = IDL.Record({
    'tick_at_event' : IDL.Int32,
    'amount_quote' : IDL.Nat,
    'liquidity_delta' : IDL.Nat,
    'amount_base' : IDL.Nat,
    'fee_pips' : IDL.Nat32,
    'tick_lower' : IDL.Int32,
    'tick_upper' : IDL.Int32,
    'position_id' : IDL.Nat64,
  });
  const PositionTransferActivityDetails = IDL.Record({
    'direction' : IDL.Variant({ 'sent' : IDL.Null, 'received' : IDL.Null }),
    'liquidity' : IDL.Nat,
    'counterparty' : IDL.Principal,
    'fee_pips' : IDL.Nat32,
    'tick_lower' : IDL.Int32,
    'tick_upper' : IDL.Int32,
    'position_id' : IDL.Nat64,
  });
  const TransferActivityDetails = IDL.Record({
    'direction' : IDL.Variant({ 'inbound' : IDL.Null, 'outbound' : IDL.Null }),
    'token' : IDL.Variant({ 'base' : IDL.Null, 'quote' : IDL.Null }),
    'block_index' : IDL.Opt(IDL.Nat64),
    'ledger_principal' : IDL.Principal,
    'ledger_fee' : IDL.Nat,
    'amount' : IDL.Nat,
  });
  const ActivityDetails = IDL.Variant({
    'trigger' : TriggerActivityDetails,
    'penalty' : PenaltyActivityDetails,
    'order' : OrderActivityDetails,
    'liquidity' : LiquidityActivityDetails,
    'position_transfer' : PositionTransferActivityDetails,
    'transfer' : TransferActivityDetails,
  });
  const ActivityView = IDL.Record({
    'activity_type' : ActivityType,
    'quote_usd_e12' : IDL.Nat64,
    'timestamp_ms' : IDL.Nat64,
    'activity_id' : IDL.Nat64,
    'details' : ActivityDetails,
  });
  const GetUserActivityResult = IDL.Record({
    'data' : IDL.Vec(ActivityView),
    'next_cursor' : IDL.Opt(ChainCursor),
    'has_more' : IDL.Bool,
  });
  const IncreaseLiquidityResult = IDL.Variant({
    'ok' : IDL.Record({
      'liquidity_delta' : IDL.Nat,
      'actual_amt0' : IDL.Nat,
      'actual_amt1' : IDL.Nat,
      'versions' : PollVersions,
    }),
    'err' : ApiError,
  });
  const LockPositionResult = IDL.Variant({
    'ok' : IDL.Record({ 'versions' : PollVersions }),
    'err' : ApiError,
  });
  const PassThroughTradeArgs = IDL.Record({
    'recipient' : IDL.Opt(IDL.Principal),
    'pool_swaps' : IDL.Vec(PoolSwapSpec),
    'book_order' : IDL.Opt(BookOrderSpec),
  });
  const PassThroughTradeSuccess = IDL.Record({
    'output' : IDL.Nat,
    'swap_results' : IDL.Vec(SwapResultItem),
    'output_error' : IDL.Opt(IDL.Text),
    'output_block_index' : IDL.Opt(IDL.Nat),
    'refund_error' : IDL.Opt(IDL.Text),
    'refund_block_index' : IDL.Opt(IDL.Nat),
    'versions' : PollVersions,
    'refund' : IDL.Nat,
  });
  const PassThroughTradeResult = IDL.Variant({
    'ok' : PassThroughTradeSuccess,
    'err' : ApiError,
  });
  const VenueId = IDL.Variant({ 'book' : IDL.Null, 'pool' : IDL.Nat32 });
  const VenueBreakdown = IDL.Record({
    'input_amount' : IDL.Nat,
    'venue_id' : VenueId,
    'output_amount' : IDL.Nat,
    'fee_amount' : IDL.Nat,
  });
  const QuoteResult = IDL.Record({
    'input_amount' : IDL.Nat,
    'reference_tick' : Tick,
    'price_impact_bps' : IDL.Nat,
    'output_amount' : IDL.Nat,
    'total_fees' : IDL.Nat,
    'pool_swaps' : IDL.Vec(PoolSwapSpec),
    'book_order' : IDL.Opt(BookOrderSpec),
    'min_output' : IDL.Nat,
    'effective_tick' : Tick,
    'venue_breakdown' : IDL.Vec(VenueBreakdown),
  });
  const QuoteOrderResult = IDL.Variant({
    'ok' : QuoteResult,
    'err' : ApiError,
  });
  const TransferPositionResult = IDL.Variant({
    'ok' : IDL.Record({
      'versions' : PollVersions,
      'position_id' : PositionId,
    }),
    'err' : ApiError,
  });
  const UpdateOrderResult = IDL.Variant({
    'ok' : IDL.Variant({
      'modified' : IDL.Record({
        'refunded' : IDL.Nat,
        'available_quote' : IDL.Nat,
        'available_base' : IDL.Nat,
        'versions' : PollVersions,
      }),
      'replaced' : IDL.Record({
        'available_quote' : IDL.Nat,
        'available_base' : IDL.Nat,
        'order_id' : OrderId,
        'versions' : PollVersions,
      }),
    }),
    'err' : ApiError,
  });
  const WithdrawResult = IDL.Variant({
    'ok' : IDL.Record({
      'block_index' : IDL.Opt(IDL.Nat),
      'remaining' : IDL.Nat,
      'withdrawn' : IDL.Nat,
      'versions' : PollVersions,
    }),
    'err' : ApiError,
  });
  const Spot = IDL.Service({
    'add_liquidity' : IDL.Func(
        [
          IDL.Nat32,
          Tick,
          Tick,
          IDL.Nat,
          IDL.Nat,
          IDL.Opt(Tick),
          IDL.Opt(IDL.Nat64),
        ],
        [LiquidityResult],
        [],
      ),
    'admin_get_event_logs' : IDL.Func(
        [IDL.Opt(IDL.Nat64), IDL.Nat32],
        [ApiResult_6],
        ['query'],
      ),
    'admin_get_user_debug' : IDL.Func(
        [IDL.Principal],
        [ApiResult_5],
        ['query'],
      ),
    'admin_kill_all' : IDL.Func([], [ApiResult_4], []),
    'admin_release_rate_limit' : IDL.Func([IDL.Principal], [ApiResult], []),
    'admin_set_lockdown' : IDL.Func([IDL.Bool], [ApiResult__1_1], []),
    'admin_set_system_state' : IDL.Func([SystemState], [ApiResult__1_1], []),
    'admin_start_timer' : IDL.Func([], [ApiResult__1_1], []),
    'admin_stop_timer' : IDL.Func([], [ApiResult__1_1], []),
    'admin_upgrade_config' : IDL.Func([UpgradeArgs], [ApiResult__1_1], []),
    'admin_withdraw_fees' : IDL.Func([IDL.Principal], [ApiResult_2], []),
    'admin_write_candles' : IDL.Func(
        [ChartInterval, IDL.Vec(SpotCandle)],
        [ApiResult_1],
        [],
      ),
    'cancel_all_orders' : IDL.Func([], [CancelAllOrdersResult], []),
    'cancel_all_triggers' : IDL.Func([], [CancelAllTriggersResult], []),
    'cancel_orders' : IDL.Func([IDL.Vec(OrderId)], [CancelOrdersResult], []),
    'cancel_triggers' : IDL.Func(
        [IDL.Vec(TriggerId)],
        [CancelTriggersResult],
        [],
      ),
    'close_all_positions' : IDL.Func([], [CloseAllPositionsResult], []),
    'collect_fees' : IDL.Func([PositionId], [CollectFeesResult], []),
    'create_orders' : IDL.Func(
        [IDL.Vec(OrderId), IDL.Vec(BookOrderSpec), IDL.Vec(PoolSwapSpec)],
        [CreateOrdersResult],
        [],
      ),
    'create_triggers' : IDL.Func(
        [IDL.Vec(TriggerId), IDL.Vec(TriggerSpec)],
        [CreateTriggersResult],
        [],
      ),
    'decrease_liquidity' : IDL.Func(
        [PositionId, IDL.Nat],
        [DecreaseLiquidityResult],
        [],
      ),
    'deposit' : IDL.Func([ClaimTokenId, IDL.Nat], [DepositResult], []),
    'get_balance_sheet' : IDL.Func([], [BalanceSheet], ['query']),
    'get_chart' : IDL.Func(
        [ChartInterval, IDL.Opt(IDL.Nat64), IDL.Nat32],
        [
          IDL.Record({
            'data' : IDL.Vec(SpotCandle),
            'next_cursor' : IDL.Opt(IDL.Nat64),
            'has_more' : IDL.Bool,
          }),
        ],
        ['query'],
      ),
    'get_control' : IDL.Func([], [FrozenControl], ['query']),
    'get_hydration' : IDL.Func(
        [ChartInterval, IDL.Nat32, IDL.Nat32, IDL.Nat32],
        [HydrateResponse],
        ['query'],
      ),
    'get_indexer_data' : IDL.Func([], [IndexerData], ['query']),
    'get_live_candle' : IDL.Func([ChartInterval], [CandleData], ['query']),
    'get_lock_schedule' : IDL.Func([], [LiquidityLockSummary], ['query']),
    'get_market_depth' : IDL.Func(
        [IDL.Nat32, IDL.Nat32],
        [MarketDepthResponse],
        ['query'],
      ),
    'get_market_snapshots' : IDL.Func(
        [IDL.Opt(IDL.Nat64), IDL.Nat32, IDL.Nat32],
        [MarketSnapshotsResponse],
        ['query'],
      ),
    'get_platform' : IDL.Func(
        [ChartInterval, IDL.Nat32, IDL.Nat32],
        [PlatformData],
        ['query'],
      ),
    'get_pool' : IDL.Func([IDL.Nat32], [IDL.Opt(PoolState)], ['query']),
    'get_pool_snapshots' : IDL.Func(
        [IDL.Nat32, IDL.Opt(IDL.Nat64), IDL.Nat32, IDL.Nat32],
        [PoolSnapshotsResponse],
        ['query'],
      ),
    'get_pools_overview' : IDL.Func([], [IDL.Vec(PoolOverview)], ['query']),
    'get_position' : IDL.Func([PositionId], [IDL.Opt(PositionView)], ['query']),
    'get_reference_tick' : IDL.Func([], [IDL.Opt(Tick)], ['query']),
    'get_routing_state' : IDL.Func([], [RoutingState], ['query']),
    'get_transactions' : IDL.Func(
        [IDL.Opt(IDL.Nat32), IDL.Opt(IDL.Nat64)],
        [
          IDL.Record({
            'data' : IDL.Vec(SpotTransactionResponse),
            'next_cursor' : IDL.Opt(IDL.Nat64),
            'has_more' : IDL.Bool,
          }),
        ],
        ['query'],
      ),
    'get_user' : IDL.Func([], [UserData], ['query']),
    'get_user_activity' : IDL.Func(
        [IDL.Opt(ChainCursor), IDL.Opt(IDL.Nat32)],
        [GetUserActivityResult],
        ['query'],
      ),
    'get_versions' : IDL.Func([], [PollVersions], ['query']),
    'increase_liquidity' : IDL.Func(
        [PositionId, IDL.Nat, IDL.Nat],
        [IncreaseLiquidityResult],
        [],
      ),
    'lock_position' : IDL.Func(
        [PositionId, IDL.Nat64],
        [LockPositionResult],
        [],
      ),
    'pass_through_trade' : IDL.Func(
        [PassThroughTradeArgs],
        [PassThroughTradeResult],
        [],
      ),
    'quote_order' : IDL.Func(
        [Side, IDL.Nat, Tick, IDL.Opt(IDL.Nat32)],
        [QuoteOrderResult],
        ['query'],
      ),
    'release_rate_limit' : IDL.Func([IDL.Principal], [ApiResult], []),
    'transfer_position' : IDL.Func(
        [PositionId, IDL.Principal],
        [TransferPositionResult],
        [],
      ),
    'update_order' : IDL.Func(
        [OrderId, Tick, IDL.Nat],
        [UpdateOrderResult],
        [],
      ),
    'withdraw' : IDL.Func([ClaimTokenId, IDL.Nat], [WithdrawResult], []),
  });
  return Spot;
};
export const init = ({ IDL }) => {
  const TokenMetadata = IDL.Record({
    'fee' : IDL.Nat,
    'decimals' : IDL.Nat8,
    'ledger' : IDL.Principal,
  });
  const InitArgs = IDL.Record({
    'maker_fee_pips' : IDL.Opt(IDL.Nat32),
    'taker_fee_pips' : IDL.Opt(IDL.Nat32),
    'oracle_principal' : IDL.Principal,
    'token0' : TokenMetadata,
    'token1' : TokenMetadata,
    'treasury_principal' : IDL.Opt(IDL.Principal),
    'maker_rebate_pips' : IDL.Opt(IDL.Nat32),
    'indexer_principal' : IDL.Principal,
    'registry_principal' : IDL.Principal,
    'admin_principals' : IDL.Vec(IDL.Principal),
  });
  return [InitArgs];
};
