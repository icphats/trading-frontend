import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Account {
  'owner' : Principal,
  'subaccount' : [] | [Uint8Array | number[]],
}
export interface ApiError {
  'metadata' : [] | [Array<[string, string]>],
  'code' : string,
  'message' : string,
  'category' : ErrorCategory,
}
export type ApiResult = { 'ok' : boolean } |
  { 'err' : ApiError };
export type ApiResult_1 = { 'ok' : bigint } |
  { 'err' : ApiError };
export type ApiResult_2 = { 'ok' : null } |
  { 'err' : ApiError };
export type ApiResult_3 = { 'ok' : EventLogPage } |
  { 'err' : ApiError };
export interface ArchiveOptions {
  'num_blocks_to_archive' : bigint,
  'max_transactions_per_response' : [] | [bigint],
  'trigger_threshold' : bigint,
  'more_controller_ids' : [] | [Array<Principal>],
  'max_message_size_bytes' : [] | [bigint],
  'cycles_for_archive_creation' : [] | [bigint],
  'node_max_memory_size_bytes' : [] | [bigint],
  'controller_id' : Principal,
}
export interface CreateLedgerArgs {
  'controllers' : [] | [Array<Principal>],
  'init_args' : LedgerInitArgs,
}
export interface CreationFees { 'spot' : bigint, 'ledger' : bigint }
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
export interface FeatureFlags { 'icrc2' : boolean }
export interface FrozenControl {
  'system_state' : SystemState,
  'icp_spot_creation_fee' : bigint,
  'icp_ledger_creation_fee' : bigint,
  'treasury_allowance_set' : boolean,
  'timer_running' : boolean,
  'spot_creation_cycles' : bigint,
  'oracle_principal' : Principal,
  'cycles_threshold' : bigint,
  'icp_transfer_fee' : bigint,
  'treasury_principal' : [] | [Principal],
  'indexer_principal' : [] | [Principal],
  'this_principal' : Principal,
  'ledger_creation_cycles' : bigint,
  'admin_principals' : Array<Principal>,
}
export interface InternalCanisterMetadata {
  'created_at' : bigint,
  'created_by' : Principal,
  'version' : string,
}
export interface LedgerInitArgs {
  'decimals' : [] | [number],
  'token_symbol' : string,
  'transfer_fee' : bigint,
  'metadata' : Array<[string, MetadataValue]>,
  'minting_account' : Account,
  'initial_balances' : Array<[Account, bigint]>,
  'fee_collector_account' : [] | [Account],
  'archive_options' : ArchiveOptions,
  'max_memo_length' : [] | [number],
  'index_principal' : [] | [Principal],
  'token_name' : string,
  'feature_flags' : [] | [FeatureFlags],
}
export interface LedgerMetadata {
  'internal' : InternalCanisterMetadata,
  'canister_id' : Principal,
}
export type LedgerResult = { 'ok' : LedgerMetadata } |
  { 'err' : ApiError };
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
export type MetadataValue = { 'Int' : bigint } |
  { 'Nat' : bigint } |
  { 'Blob' : Uint8Array | number[] } |
  { 'Text' : string };
export interface SpotInitArgs { 'base' : Principal, 'quote' : Principal }
export interface SpotMarketMetadata {
  'internal' : InternalCanisterMetadata,
  'quote_name' : string,
  'canister_id' : Principal,
  'quote_ledger' : Principal,
  'base_name' : string,
  'base_ledger' : Principal,
  'registry_principal' : Principal,
  'quote_symbol' : string,
  'base_symbol' : string,
}
export type SpotMarketResult = { 'ok' : SpotMarketMetadata } |
  { 'err' : ApiError };
export type SystemState = { 'normal' : null } |
  { 'halted' : null } |
  { 'degraded' : null };
export interface UpgradeArgs {
  'remove_admins' : [] | [Array<Principal>],
  'set_treasury_principal' : [] | [Principal],
  'set_icp_ledger_creation_fee' : [] | [bigint],
  'set_oracle_principal' : [] | [Principal],
  'set_cycles_threshold' : [] | [bigint],
  'set_ledger_creation_cycles' : [] | [bigint],
  'reset_topup_backoff' : [] | [boolean],
  'set_indexer_principal' : [] | [Principal],
  'set_icp_spot_creation_fee' : [] | [bigint],
  'add_admins' : [] | [Array<Principal>],
  'set_spot_creation_cycles' : [] | [bigint],
}
export type WasmType = { 'spot' : null } |
  { 'ledger' : null };
export type WasmUploadResult = { 'ok' : boolean } |
  { 'err' : ApiError };
export interface _SERVICE {
  /**
   * / Delete a stored WASM module.
   */
  'admin_delete_wasm' : ActorMethod<[string], ApiResult>,
  /**
   * / Get event log entries with cursor-based pagination (admin only).
   */
  'admin_get_event_logs' : ActorMethod<[[] | [bigint], number], ApiResult_3>,
  /**
   * / Set the active WASM version for a canister type.
   */
  'admin_set_active_version' : ActorMethod<[WasmType, string], ApiResult_2>,
  /**
   * / Set system-wide lockdown (admin override for rate limiter).
   */
  'admin_set_lockdown' : ActorMethod<[boolean], ApiResult_2>,
  /**
   * / Set system operational state (admin only).
   */
  'admin_set_system_state' : ActorMethod<[SystemState], ApiResult_2>,
  /**
   * / Start the heartbeat timer (admin only). No-op if already running.
   */
  'admin_start_timer' : ActorMethod<[], ApiResult_2>,
  /**
   * / Stop the heartbeat timer (admin only).
   */
  'admin_stop_timer' : ActorMethod<[], ApiResult_2>,
  /**
   * / Update runtime configuration (admin_principals, fee settings).
   */
  'admin_upgrade_config' : ActorMethod<[UpgradeArgs], ApiResult_2>,
  /**
   * / Upload a WASM chunk for chunked deployment.
   * / On final chunk, assembles and stores with version metadata.
   */
  'admin_upload_chunk' : ActorMethod<
    [string, number, number, Uint8Array | number[], WasmType, string, boolean],
    WasmUploadResult
  >,
  /**
   * / Claim owed ICP refund from a failed creation refund.
   * / Returns net amount transferred (gross - ledger fee), or 0 if nothing owed.
   */
  'claim_refund' : ActorMethod<[], ApiResult_1>,
  /**
   * / Create a new ICRC-1 ledger canister.
   */
  'create_ledger' : ActorMethod<[CreateLedgerArgs], LedgerResult>,
  /**
   * / Create a new spot market canister.
   */
  'create_spot_market' : ActorMethod<[SpotInitArgs], SpotMarketResult>,
  /**
   * / Get all registered spot markets.
   */
  'get_all_markets' : ActorMethod<[], Array<SpotMarketMetadata>>,
  /**
   * / Get frozen registry control state.
   */
  'get_control' : ActorMethod<[], FrozenControl>,
  /**
   * / Get creation fees in ICP e8s.
   */
  'get_creation_fees' : ActorMethod<[], CreationFees>,
  /**
   * / Get ledger principals created by a specific principal.
   */
  'get_ledgers_by_creator' : ActorMethod<[Principal], Array<Principal>>,
  /**
   * / Get a spot market by its base and quote ledger principals.
   */
  'get_spot_market' : ActorMethod<
    [Principal, Principal],
    [] | [SpotMarketMetadata]
  >,
  /**
   * / Pay to release a rate-limited principal.
   * / Costs 11x ICP transfer fee, pulled from caller's wallet via ICRC-2.
   * / Caller must not be hard-blocked. Target must have violations.
   */
  'release_rate_limit' : ActorMethod<[Principal], ApiResult>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
