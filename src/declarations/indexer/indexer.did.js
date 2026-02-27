export const idlFactory = ({ IDL }) => {
  const LogLevel = IDL.Variant({
    'Error' : IDL.Null,
    'Info' : IDL.Null,
    'Warn' : IDL.Null,
    'Debug' : IDL.Null,
    'Critical' : IDL.Null,
  });
  const LogEntry = IDL.Record({
    'id' : IDL.Nat64,
    'principal' : IDL.Opt(IDL.Principal),
    'context' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'level' : LogLevel,
    'event' : IDL.Text,
    'message' : IDL.Text,
    'timestamp' : IDL.Nat64,
  });
  const EventLogPage = IDL.Record({
    'data' : IDL.Vec(LogEntry),
    'next_cursor' : IDL.Opt(IDL.Nat64),
    'has_more' : IDL.Bool,
  });
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
  const ApiResult_1 = IDL.Variant({ 'ok' : EventLogPage, 'err' : ApiError });
  const SystemState = IDL.Variant({
    'normal' : IDL.Null,
    'halted' : IDL.Null,
    'degraded' : IDL.Null,
  });
  const ApiResult = IDL.Variant({ 'ok' : IDL.Null, 'err' : ApiError });
  const UpgradeArgs = IDL.Record({
    'remove_admins' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'set_treasury_principal' : IDL.Opt(IDL.Principal),
    'set_cycles_threshold' : IDL.Opt(IDL.Nat),
    'reset_topup_backoff' : IDL.Opt(IDL.Bool),
    'add_admins' : IDL.Opt(IDL.Vec(IDL.Principal)),
  });
  const FrozenControl = IDL.Record({
    'system_state' : SystemState,
    'cycles_threshold' : IDL.Nat,
    'treasury_principal' : IDL.Opt(IDL.Principal),
    'this_principal' : IDL.Principal,
    'admin_principals' : IDL.Vec(IDL.Principal),
  });
  const FrozenTokenEntry = IDL.Record({
    'decimals' : IDL.Nat8,
    'name' : IDL.Text,
    'canister_id' : IDL.Principal,
    'symbol' : IDL.Text,
  });
  const VolumeCursor = IDL.Record({ 'id' : IDL.Principal, 'volume' : IDL.Nat });
  const ListQuery = IDL.Record({
    'cursor' : IDL.Opt(VolumeCursor),
    'limit' : IDL.Nat,
  });
  const MarketListItem = IDL.Record({
    'canister_id' : IDL.Principal,
    'volume_24h_usd_e6' : IDL.Nat,
    'quote_token' : IDL.Principal,
    'base_token' : IDL.Principal,
    'price_change_24h_bps' : IDL.Int,
    'last_price_usd_e12' : IDL.Nat,
    'symbol' : IDL.Text,
  });
  const MarketListResponse = IDL.Record({
    'data' : IDL.Vec(MarketListItem),
    'next_cursor' : IDL.Opt(VolumeCursor),
    'has_more' : IDL.Bool,
  });
  const PlatformSnapshotView = IDL.Record({
    'triggers_live' : IDL.Nat32,
    'tvl_usd_e6' : IDL.Nat64,
    'book_fees_usd_e6' : IDL.Nat64,
    'timestamp' : IDL.Nat64,
    'book_open_interest_usd_e6' : IDL.Nat64,
    'transactions' : IDL.Nat64,
    'pool_fees_usd_e6' : IDL.Nat64,
    'trigger_locked_usd_e6' : IDL.Nat64,
    'orders_live' : IDL.Nat32,
    'total_positions' : IDL.Nat32,
    'volume_usd_e6' : IDL.Nat64,
    'pool_reserve_usd_e6' : IDL.Nat64,
  });
  const PlatformSnapshotsResponse = IDL.Record({
    'data' : IDL.Vec(PlatformSnapshotView),
    'next_cursor' : IDL.Opt(IDL.Nat64),
    'has_more' : IDL.Bool,
  });
  const FrozenPlatformStats = IDL.Record({
    'pool_fees_cumulative_usd_e6' : IDL.Nat64,
    'triggers_live' : IDL.Nat32,
    'volume_change_24h_bps' : IDL.Int,
    'total_tvl_usd_e6' : IDL.Nat64,
    'volume_24h_usd_e6' : IDL.Nat64,
    'last_updated' : IDL.Nat64,
    'book_fees_24h_usd_e6' : IDL.Nat64,
    'pool_fees_24h_usd_e6' : IDL.Nat64,
    'book_fees_cumulative_usd_e6' : IDL.Nat64,
    'total_transactions' : IDL.Nat64,
    'book_volume_cumulative_usd_e6' : IDL.Nat64,
    'book_open_interest_usd_e6' : IDL.Nat64,
    'snapshot_count' : IDL.Nat,
    'tvl_change_24h_bps' : IDL.Int,
    'trigger_locked_usd_e6' : IDL.Nat64,
    'active_markets' : IDL.Nat32,
    'pool_volume_cumulative_usd_e6' : IDL.Nat64,
    'active_pools' : IDL.Nat32,
    'orders_live' : IDL.Nat32,
    'total_positions' : IDL.Nat32,
    'pool_reserve_usd_e6' : IDL.Nat64,
  });
  const PoolListItem = IDL.Record({
    'tvl_usd_e6' : IDL.Nat,
    'volume_24h_usd_e6' : IDL.Nat,
    'fees_24h_usd_e6' : IDL.Nat,
    'apr_bps' : IDL.Nat,
    'quote_ledger' : IDL.Principal,
    'base_ledger' : IDL.Principal,
    'fee_pips' : IDL.Nat32,
    'current_price_usd_e12' : IDL.Nat,
    'symbol' : IDL.Text,
    'spot_canister' : IDL.Principal,
  });
  const PoolListResponse = IDL.Record({
    'data' : IDL.Vec(PoolListItem),
    'next_cursor' : IDL.Opt(VolumeCursor),
    'has_more' : IDL.Bool,
  });
  const QuoteTokenSnapshotView = IDL.Record({
    'tvl_usd_e6' : IDL.Nat,
    'timestamp' : IDL.Nat64,
    'fees_usd_e6' : IDL.Nat,
    'volume_usd_e6' : IDL.Nat,
  });
  const QuoteTokenSnapshotsResponse = IDL.Record({
    'data' : IDL.Vec(QuoteTokenSnapshotView),
    'next_cursor' : IDL.Opt(IDL.Nat64),
    'has_more' : IDL.Bool,
  });
  const IndexerStatus = IDL.Record({
    'pool_count' : IDL.Nat,
    'market_count' : IDL.Nat,
    'last_push_time' : IDL.Nat64,
    'token_count' : IDL.Nat,
  });
  const TokenAggregate = IDL.Record({
    'total_volume_7d_usd_e6' : IDL.Nat,
    'total_tvl_usd_e6' : IDL.Nat,
    'market_count' : IDL.Nat,
    'total_volume_24h_usd_e6' : IDL.Nat,
    'token_ledger' : IDL.Principal,
    'total_volume_30d_usd_e6' : IDL.Nat,
  });
  const TokenListItem = IDL.Record({
    'decimals' : IDL.Nat8,
    'price_change_30d_bps' : IDL.Int,
    'tvl_usd_e6' : IDL.Nat,
    'base_markets' : IDL.Vec(IDL.Principal),
    'name' : IDL.Text,
    'volume_24h_usd_e6' : IDL.Nat,
    'quote_markets' : IDL.Vec(IDL.Principal),
    'current_price_usd_e12' : IDL.Nat,
    'token_ledger' : IDL.Principal,
    'price_change_24h_bps' : IDL.Int,
    'volume_30d_usd_e6' : IDL.Nat,
    'symbol' : IDL.Text,
    'volume_7d_usd_e6' : IDL.Nat,
    'price_change_7d_bps' : IDL.Int,
  });
  const TokenListResponse = IDL.Record({
    'data' : IDL.Vec(TokenListItem),
    'next_cursor' : IDL.Opt(VolumeCursor),
    'has_more' : IDL.Bool,
  });
  const PoolDataUpdate = IDL.Record({
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
  const MarketMetricsUpdate = IDL.Record({
    'triggers_live' : IDL.Nat32,
    'base_tvl_usd_e6' : IDL.Nat,
    'book_fees_cumulative_usd_e6' : IDL.Nat,
    'total_transactions' : IDL.Nat64,
    'book_volume_cumulative_usd_e6' : IDL.Nat,
    'book_open_interest_usd_e6' : IDL.Nat,
    'trigger_locked_usd_e6' : IDL.Nat,
    'orders_live' : IDL.Nat32,
    'quote_tvl_usd_e6' : IDL.Nat,
    'total_positions' : IDL.Nat32,
    'pool_reserve_usd_e6' : IDL.Nat,
  });
  const TokenDataUpdate = IDL.Record({
    'volume_cumulative_usd_e6' : IDL.Nat,
    'price_change_bps' : IDL.Tuple(IDL.Int, IDL.Int, IDL.Int, IDL.Int, IDL.Int),
    'volume_24h_usd_e6' : IDL.Nat,
    'current_price_usd_e12' : IDL.Nat,
    'volume_30d_usd_e6' : IDL.Nat,
    'volume_7d_usd_e6' : IDL.Nat,
  });
  const MarketDataUpdate = IDL.Record({
    'pool_data' : IDL.Vec(PoolDataUpdate),
    'market_metrics' : MarketMetricsUpdate,
    'token_data' : TokenDataUpdate,
  });
  const TokenInfo = IDL.Record({
    'decimals' : IDL.Nat8,
    'name' : IDL.Text,
    'ledger' : IDL.Principal,
    'symbol' : IDL.Text,
  });
  const SearchFilter = IDL.Variant({
    'all' : IDL.Null,
    'markets' : IDL.Null,
    'tokens' : IDL.Null,
  });
  const SearchResponse = IDL.Record({
    'markets' : IDL.Vec(MarketListItem),
    'tokens' : IDL.Vec(TokenListItem),
  });
  return IDL.Service({
    'admin_get_event_logs' : IDL.Func(
        [IDL.Opt(IDL.Nat64), IDL.Nat32],
        [ApiResult_1],
        ['query'],
      ),
    'admin_set_system_state' : IDL.Func([SystemState], [ApiResult], []),
    'admin_start_timer' : IDL.Func([], [ApiResult], []),
    'admin_stop_timer' : IDL.Func([], [ApiResult], []),
    'admin_upgrade_config' : IDL.Func([UpgradeArgs], [ApiResult], []),
    'deregister_user_from_market' : IDL.Func([IDL.Principal], [ApiResult], []),
    'get_control' : IDL.Func([], [FrozenControl], ['query']),
    'get_hydration' : IDL.Func([], [IDL.Vec(FrozenTokenEntry)], ['query']),
    'get_market_by_pair' : IDL.Func(
        [IDL.Principal, IDL.Principal],
        [IDL.Opt(IDL.Principal)],
        ['query'],
      ),
    'get_market_by_symbols' : IDL.Func(
        [IDL.Text, IDL.Text],
        [IDL.Opt(IDL.Principal)],
        ['query'],
      ),
    'get_markets' : IDL.Func([ListQuery], [MarketListResponse], ['query']),
    'get_platform_snapshots' : IDL.Func(
        [IDL.Opt(IDL.Nat64), IDL.Nat, IDL.Nat],
        [PlatformSnapshotsResponse],
        ['query'],
      ),
    'get_platform_stats' : IDL.Func([], [FrozenPlatformStats], ['query']),
    'get_pools' : IDL.Func([ListQuery], [PoolListResponse], ['query']),
    'get_quote_token_snapshots' : IDL.Func(
        [IDL.Principal, IDL.Opt(IDL.Nat64), IDL.Nat, IDL.Nat],
        [QuoteTokenSnapshotsResponse],
        ['query'],
      ),
    'get_status' : IDL.Func([], [IndexerStatus], ['query']),
    'get_token_aggregate' : IDL.Func(
        [IDL.Principal],
        [IDL.Opt(TokenAggregate)],
        ['query'],
      ),
    'get_tokens' : IDL.Func([ListQuery], [TokenListResponse], ['query']),
    'get_user_markets' : IDL.Func([], [IDL.Vec(IDL.Principal)], ['query']),
    'push_market_data' : IDL.Func([MarketDataUpdate], [], []),
    'register_spot_market' : IDL.Func(
        [IDL.Principal, TokenInfo, TokenInfo, IDL.Text],
        [ApiResult],
        [],
      ),
    'register_user_to_market' : IDL.Func([IDL.Principal], [ApiResult], []),
    'search' : IDL.Func(
        [IDL.Text, IDL.Nat, SearchFilter],
        [SearchResponse],
        ['query'],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
