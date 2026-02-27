import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface ApiError {
  'metadata' : [] | [Array<[string, string]>],
  'code' : string,
  'message' : string,
  'category' : ErrorCategory,
}
export type ApiResult = { 'ok' : null } |
  { 'err' : ApiError };
export type ApiResult_1 = { 'ok' : EventLogPage } |
  { 'err' : ApiError };
export type ErrorCategory = { 'resource' : null } |
  { 'admin' : null } |
  { 'other' : null } |
  { 'rate_limit' : null } |
  { 'state' : null } |
  { 'validation' : null } |
  { 'external' : null } |
  { 'authorization' : null };
export interface EventLogPage {
  'data' : Array<LogEntry>,
  'next_cursor' : [] | [bigint],
  'has_more' : boolean,
}
export interface FrozenControl {
  'system_state' : SystemState,
  'cycles_threshold' : bigint,
  'treasury_principal' : [] | [Principal],
  'this_principal' : Principal,
  'admin_principals' : Array<Principal>,
}
export interface FrozenPlatformStats {
  'pool_fees_cumulative_usd_e6' : bigint,
  'triggers_live' : number,
  'volume_change_24h_bps' : bigint,
  'total_tvl_usd_e6' : bigint,
  'volume_24h_usd_e6' : bigint,
  'last_updated' : bigint,
  'book_fees_24h_usd_e6' : bigint,
  'pool_fees_24h_usd_e6' : bigint,
  'book_fees_cumulative_usd_e6' : bigint,
  'total_transactions' : bigint,
  'book_volume_cumulative_usd_e6' : bigint,
  'book_open_interest_usd_e6' : bigint,
  'snapshot_count' : bigint,
  'tvl_change_24h_bps' : bigint,
  'trigger_locked_usd_e6' : bigint,
  'active_markets' : number,
  'pool_volume_cumulative_usd_e6' : bigint,
  'active_pools' : number,
  'orders_live' : number,
  'total_positions' : number,
  'pool_reserve_usd_e6' : bigint,
}
export interface FrozenTokenEntry {
  'decimals' : number,
  'name' : string,
  'canister_id' : Principal,
  'symbol' : string,
}
export interface IndexerStatus {
  'pool_count' : bigint,
  'market_count' : bigint,
  'last_push_time' : bigint,
  'token_count' : bigint,
}
export interface ListQuery { 'cursor' : [] | [VolumeCursor], 'limit' : bigint }
export interface LogEntry {
  'id' : bigint,
  'principal' : [] | [Principal],
  'context' : Array<[string, string]>,
  'level' : LogLevel,
  'event' : string,
  'message' : string,
  'timestamp' : bigint,
}
export type LogLevel = { 'Error' : null } |
  { 'Info' : null } |
  { 'Warn' : null } |
  { 'Debug' : null } |
  { 'Critical' : null };
export interface MarketDataUpdate {
  'pool_data' : Array<PoolDataUpdate>,
  'market_metrics' : MarketMetricsUpdate,
  'token_data' : TokenDataUpdate,
}
export interface MarketListItem {
  'canister_id' : Principal,
  'volume_24h_usd_e6' : bigint,
  'quote_token' : Principal,
  'base_token' : Principal,
  'price_change_24h_bps' : bigint,
  'last_price_usd_e12' : bigint,
  'symbol' : string,
}
export interface MarketListResponse {
  'data' : Array<MarketListItem>,
  'next_cursor' : [] | [VolumeCursor],
  'has_more' : boolean,
}
export interface MarketMetricsUpdate {
  'triggers_live' : number,
  'base_tvl_usd_e6' : bigint,
  'book_fees_cumulative_usd_e6' : bigint,
  'total_transactions' : bigint,
  'book_volume_cumulative_usd_e6' : bigint,
  'book_open_interest_usd_e6' : bigint,
  'trigger_locked_usd_e6' : bigint,
  'orders_live' : number,
  'quote_tvl_usd_e6' : bigint,
  'total_positions' : number,
  'pool_reserve_usd_e6' : bigint,
}
export interface PlatformSnapshotView {
  'triggers_live' : number,
  'tvl_usd_e6' : bigint,
  'book_fees_usd_e6' : bigint,
  'timestamp' : bigint,
  'book_open_interest_usd_e6' : bigint,
  'transactions' : bigint,
  'pool_fees_usd_e6' : bigint,
  'trigger_locked_usd_e6' : bigint,
  'orders_live' : number,
  'total_positions' : number,
  'volume_usd_e6' : bigint,
  'pool_reserve_usd_e6' : bigint,
}
export interface PlatformSnapshotsResponse {
  'data' : Array<PlatformSnapshotView>,
  'next_cursor' : [] | [bigint],
  'has_more' : boolean,
}
export interface PoolDataUpdate {
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
export interface PoolListItem {
  'tvl_usd_e6' : bigint,
  'volume_24h_usd_e6' : bigint,
  'fees_24h_usd_e6' : bigint,
  'apr_bps' : bigint,
  'quote_ledger' : Principal,
  'base_ledger' : Principal,
  'fee_pips' : number,
  'current_price_usd_e12' : bigint,
  'symbol' : string,
  'spot_canister' : Principal,
}
export interface PoolListResponse {
  'data' : Array<PoolListItem>,
  'next_cursor' : [] | [VolumeCursor],
  'has_more' : boolean,
}
export interface QuoteTokenSnapshotView {
  'tvl_usd_e6' : bigint,
  'timestamp' : bigint,
  'fees_usd_e6' : bigint,
  'volume_usd_e6' : bigint,
}
export interface QuoteTokenSnapshotsResponse {
  'data' : Array<QuoteTokenSnapshotView>,
  'next_cursor' : [] | [bigint],
  'has_more' : boolean,
}
export type SearchFilter = { 'all' : null } |
  { 'markets' : null } |
  { 'tokens' : null };
export interface SearchResponse {
  'markets' : Array<MarketListItem>,
  'tokens' : Array<TokenListItem>,
}
export type SystemState = { 'normal' : null } |
  { 'halted' : null } |
  { 'degraded' : null };
export interface TokenAggregate {
  'total_volume_7d_usd_e6' : bigint,
  'total_tvl_usd_e6' : bigint,
  'market_count' : bigint,
  'total_volume_24h_usd_e6' : bigint,
  'token_ledger' : Principal,
  'total_volume_30d_usd_e6' : bigint,
}
export interface TokenDataUpdate {
  'volume_cumulative_usd_e6' : bigint,
  'price_change_bps' : [bigint, bigint, bigint, bigint, bigint],
  'volume_24h_usd_e6' : bigint,
  'current_price_usd_e12' : bigint,
  'volume_30d_usd_e6' : bigint,
  'volume_7d_usd_e6' : bigint,
}
export interface TokenInfo {
  'decimals' : number,
  'name' : string,
  'ledger' : Principal,
  'symbol' : string,
}
export interface TokenListItem {
  'decimals' : number,
  'price_change_30d_bps' : bigint,
  'tvl_usd_e6' : bigint,
  'base_markets' : Array<Principal>,
  'name' : string,
  'volume_24h_usd_e6' : bigint,
  'quote_markets' : Array<Principal>,
  'current_price_usd_e12' : bigint,
  'token_ledger' : Principal,
  'price_change_24h_bps' : bigint,
  'volume_30d_usd_e6' : bigint,
  'symbol' : string,
  'volume_7d_usd_e6' : bigint,
  'price_change_7d_bps' : bigint,
}
export interface TokenListResponse {
  'data' : Array<TokenListItem>,
  'next_cursor' : [] | [VolumeCursor],
  'has_more' : boolean,
}
export interface UpgradeArgs {
  'remove_admins' : [] | [Array<Principal>],
  'set_treasury_principal' : [] | [Principal],
  'set_cycles_threshold' : [] | [bigint],
  'reset_topup_backoff' : [] | [boolean],
  'add_admins' : [] | [Array<Principal>],
}
export interface VolumeCursor { 'id' : Principal, 'volume' : bigint }
export interface _SERVICE {
  /**
   * / Get event log entries with cursor-based pagination (admin only).
   */
  'admin_get_event_logs' : ActorMethod<[[] | [bigint], number], ApiResult_1>,
  /**
   * / Set system operational state (admin only).
   */
  'admin_set_system_state' : ActorMethod<[SystemState], ApiResult>,
  /**
   * / Start the heartbeat timer (admin only). No-op if already running.
   */
  'admin_start_timer' : ActorMethod<[], ApiResult>,
  /**
   * / Stop the heartbeat timer (admin only).
   */
  'admin_stop_timer' : ActorMethod<[], ApiResult>,
  /**
   * / Update runtime configuration (admin_principals, etc).
   */
  'admin_upgrade_config' : ActorMethod<[UpgradeArgs], ApiResult>,
  /**
   * / Untrack user from a market (called by spot canister on full withdrawal).
   * / Caller must be a registered market canister.
   */
  'deregister_user_from_market' : ActorMethod<[Principal], ApiResult>,
  /**
   * / Get current configuration.
   */
  'get_control' : ActorMethod<[], FrozenControl>,
  /**
   * / Initial hydration data for frontend (all tokens with basic stats).
   */
  'get_hydration' : ActorMethod<[], Array<FrozenTokenEntry>>,
  /**
   * / Get spot market canister for a base/quote token pair.
   * / Returns null if no market exists for this pair.
   * / Primary endpoint for swap widget market lookup.
   */
  'get_market_by_pair' : ActorMethod<[Principal, Principal], [] | [Principal]>,
  /**
   * / Get spot market canister by token symbols (e.g., "BOOM", "ICP").
   * / Case-insensitive. Returns null if tokens or market not found.
   * / Primary endpoint for URL-based market resolution (e.g., /trade/BOOM/ICP).
   */
  'get_market_by_symbols' : ActorMethod<[string, string], [] | [Principal]>,
  /**
   * / List markets with pagination and sorting.
   */
  'get_markets' : ActorMethod<[ListQuery], MarketListResponse>,
  /**
   * / Platform snapshots at any hourly interval.
   * / interval_hours: 1 (1D), 24 (1M), 168 (1Y). All from hourly append-only list.
   */
  'get_platform_snapshots' : ActorMethod<
    [[] | [bigint], bigint, bigint],
    PlatformSnapshotsResponse
  >,
  /**
   * / Platform-wide statistics (TVL, volume, fees, etc).
   */
  'get_platform_stats' : ActorMethod<[], FrozenPlatformStats>,
  /**
   * / List pools with pagination and sorting.
   */
  'get_pools' : ActorMethod<[ListQuery], PoolListResponse>,
  /**
   * / Get snapshots for a quote token (aggregated across all markets).
   * / interval_hours: 1 (1D), 6 (1W), 24 (1M), 168 (1Y). All from hourly append-only lists.
   */
  'get_quote_token_snapshots' : ActorMethod<
    [Principal, [] | [bigint], bigint, bigint],
    QuoteTokenSnapshotsResponse
  >,
  /**
   * / Get indexer status (for debugging/transparency).
   */
  'get_status' : ActorMethod<[], IndexerStatus>,
  /**
   * / Get aggregated TVL/volume for a token across all markets.
   * / Returns null if token has no registered markets.
   * / Computes on-demand by summing per-market data.
   */
  'get_token_aggregate' : ActorMethod<[Principal], [] | [TokenAggregate]>,
  /**
   * / List tokens with pagination and sorting.
   */
  'get_tokens' : ActorMethod<[ListQuery], TokenListResponse>,
  /**
   * / Get all spot canisters where caller has any involvement (balances, orders, LP positions).
   * / Used by frontend to know which markets to query for user's portfolio.
   */
  'get_user_markets' : ActorMethod<[], Array<Principal>>,
  /**
   * / Receive market data update from spot canister.
   * / Only include sections that changed (token_data, pool_data, market_metrics).
   */
  'push_market_data' : ActorMethod<[MarketDataUpdate], undefined>,
  /**
   * / Register new spot market for indexing.
   * / Called by registry canister during market deployment.
   * / Token metadata is passed through from the registry (avoids redundant ledger queries).
   */
  'register_spot_market' : ActorMethod<
    [Principal, TokenInfo, TokenInfo, string],
    ApiResult
  >,
  /**
   * / Track user involvement with a market (called by spot canister on trades/deposits).
   * / Caller must be a registered market canister.
   */
  'register_user_to_market' : ActorMethod<[Principal], ApiResult>,
  /**
   * / Search markets, pools, and tokens by symbol or name.
   */
  'search' : ActorMethod<[string, bigint, SearchFilter], SearchResponse>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
