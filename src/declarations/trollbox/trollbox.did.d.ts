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
export type ApiResult_1 = { 'ok' : boolean } |
  { 'err' : ApiError };
export type ApiResult_2 = { 'ok' : EventLogPage } |
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
export interface HydrateResponse {
  'my_username' : [] | [string],
  'messages' : Array<MessageResponse>,
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
export type MessageId = bigint;
export interface MessageResponse {
  'id' : MessageId,
  'content' : string,
  'username' : [] | [string],
  'created_at' : bigint,
  'author' : Principal,
}
export type MessageResult = { 'ok' : MessageResponse } |
  { 'err' : ApiError };
export interface MessagesResponse {
  'data' : Array<MessageResponse>,
  'next_cursor' : [] | [MessageId],
  'has_more' : boolean,
}
export type SystemState = { 'normal' : null } |
  { 'halted' : null } |
  { 'degraded' : null };
export interface UpgradeArgs {
  'remove_admins' : [] | [Array<Principal>],
  'set_treasury_principal' : [] | [Principal],
  'set_cycles_threshold' : [] | [bigint],
  'reset_topup_backoff' : [] | [boolean],
  'add_admins' : [] | [Array<Principal>],
}
export type UsernameResult = { 'ok' : string } |
  { 'err' : ApiError };
export interface _SERVICE {
  /**
   * / Get event log entries with cursor-based pagination (admin only).
   */
  'admin_get_event_logs' : ActorMethod<[[] | [bigint], number], ApiResult_2>,
  /**
   * / Release a rate-limited principal (admin only).
   */
  'admin_release_rate_limit' : ActorMethod<[Principal], ApiResult_1>,
  /**
   * / Set system-wide lockdown (admin override for rate limiter).
   */
  'admin_set_lockdown' : ActorMethod<[boolean], ApiResult>,
  /**
   * / Set system operational state (admin only).
   */
  'admin_set_system_state' : ActorMethod<[SystemState], ApiResult>,
  /**
   * / Start the heartbeat timer (admin only).
   */
  'admin_start_timer' : ActorMethod<[], ApiResult>,
  /**
   * / Stop the heartbeat timer (admin only).
   */
  'admin_stop_timer' : ActorMethod<[], ApiResult>,
  /**
   * / Update configuration (admin only).
   */
  'admin_upgrade_config' : ActorMethod<[UpgradeArgs], ApiResult>,
  /**
   * / Check if a username is available.
   */
  'check_username_available' : ActorMethod<[string], boolean>,
  /**
   * / Get current configuration.
   */
  'get_control' : ActorMethod<[], FrozenControl>,
  /**
   * / Hydrate all data needed for initial page load.
   */
  'get_hydration' : ActorMethod<[bigint], HydrateResponse>,
  /**
   * / Get messages with cursor-based pagination (newest first).
   * / cursor: null = start from newest; ?id = messages before that id (exclusive).
   */
  'get_messages' : ActorMethod<[[] | [MessageId], bigint], MessagesResponse>,
  /**
   * / Get username for a specific principal.
   */
  'get_username' : ActorMethod<[Principal], [] | [string]>,
  /**
   * / Send a new message.
   */
  'send_message' : ActorMethod<[string], MessageResult>,
  /**
   * / Set username for the caller (register or update).
   */
  'set_username' : ActorMethod<[string], UsernameResult>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
