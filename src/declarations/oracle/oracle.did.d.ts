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
export interface CachedPrice { 'timestamp' : bigint, 'price_e12' : bigint }
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
  'live_tokens' : Array<string>,
  'system_state' : SystemState,
  'cycles_threshold' : bigint,
  'treasury_principal' : [] | [Principal],
  'this_principal' : Principal,
  'admin_principals' : Array<Principal>,
}
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
export interface PatchPricesArgs {
  'entries' : Array<PriceEntry>,
  'symbol' : string,
}
export interface PriceArchiveResponse {
  'data' : Array<CachedPrice>,
  'total_count' : bigint,
}
export interface PriceEntry { 'timestamp' : bigint, 'price_e12' : bigint }
export type SystemState = { 'normal' : null } |
  { 'halted' : null } |
  { 'degraded' : null };
export interface UpgradeArgs {
  'remove_tokens' : [] | [Array<string>],
  'remove_admins' : [] | [Array<Principal>],
  'set_treasury_principal' : [] | [Principal],
  'set_cycles_threshold' : [] | [bigint],
  'reset_topup_backoff' : [] | [boolean],
  'add_tokens' : [] | [Array<string>],
  'add_admins' : [] | [Array<Principal>],
}
export interface _SERVICE {
  /**
   * / Clear all cached price data (admin only).
   */
  'admin_clear_cache' : ActorMethod<[], ApiResult>,
  /**
   * / Get event log entries with cursor-based pagination (admin only).
   */
  'admin_get_event_logs' : ActorMethod<[[] | [bigint], number], ApiResult_1>,
  /**
   * / Patch price archives: correct mispriced entries or backfill gaps (admin only).
   */
  'admin_patch_prices' : ActorMethod<[Array<PatchPricesArgs>], ApiResult>,
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
   * / Update oracle configuration (admin only).
   */
  'admin_upgrade_config' : ActorMethod<[UpgradeArgs], ApiResult>,
  /**
   * / Get oracle configuration.
   */
  'get_control' : ActorMethod<[], FrozenControl>,
  /**
   * / Get most recent price for a token.
   */
  'get_most_recent_price' : ActorMethod<[string], [] | [CachedPrice]>,
  /**
   * / Get the archive entry nearest to a timestamp.
   */
  'get_nearest_price' : ActorMethod<[string, bigint], [] | [CachedPrice]>,
  /**
   * / Query price archive for a token in a time range.
   */
  'get_price_archive' : ActorMethod<
    [string, bigint, bigint, bigint],
    [] | [PriceArchiveResponse]
  >,
  /**
   * / Get list of tracked tokens.
   */
  'get_tracked_tokens' : ActorMethod<[], Array<string>>,
  /**
   * / Get TWAP for a token over a configurable window.
   * / window_ms: lookback duration in milliseconds (e.g., 600_000 for 10 min).
   */
  'get_twap' : ActorMethod<[string, bigint], [] | [bigint]>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
