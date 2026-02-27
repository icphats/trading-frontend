import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface ApiError {
  'metadata' : [] | [Array<[string, string]>],
  'code' : string,
  'message' : string,
  'category' : ErrorCategory,
}
export type ApiResult = { 'ok' : CanisterStatusInfo } |
  { 'err' : ApiError };
export type ApiResult_1 = { 'ok' : null } |
  { 'err' : ApiError };
export type ApiResult_2 = { 'ok' : ReconcileResult } |
  { 'err' : ApiError };
export type ApiResult_3 = { 'ok' : JournalEntriesResponse } |
  { 'err' : ApiError };
export type ApiResult_4 = { 'ok' : EventLogPage } |
  { 'err' : ApiError };
export type ApiResult_5 = { 'ok' : Array<string> } |
  { 'err' : ApiError };
export type CanisterRole = {
    'fee_source' : { 'fee_token_ledger' : Principal }
  } |
  { 'unmanaged' : null } |
  { 'cycles_only' : null };
export interface CanisterSettings {
  'freezing_threshold' : [] | [bigint],
  'controllers' : [] | [Array<Principal>],
  'memory_allocation' : [] | [bigint],
  'compute_allocation' : [] | [bigint],
}
export type CanisterState = { 'active' : null } |
  { 'halted' : null };
export interface CanisterStatusInfo {
  'last_topup_at' : [] | [bigint],
  'total_cycles_received' : bigint,
  'burn_rate_cycles_per_day' : bigint,
  'principal' : Principal,
  'name' : string,
  'role' : CanisterRole,
  'state' : CanisterState,
  'total_fees_collected_usd_e6' : bigint,
  'total_fees_collected' : bigint,
  'topup_count' : bigint,
  'burn_last_topup_amount' : bigint,
  'total_cycles_expense_usd_e6' : bigint,
  'last_fee_sweep_at' : [] | [bigint],
  'registered_at' : bigint,
}
export type CollectFeesResult = { 'ok' : null } |
  { 'err' : ApiError };
export type ConversionResult = { 'ok' : ConversionSuccess } |
  { 'err' : ApiError };
export interface ConversionSuccess {
  'icp_fair_value_usd_e6' : bigint,
  'icp_cost_basis_usd_e6' : bigint,
  'icp_spent' : bigint,
  'icp_usd_rate_e12' : bigint,
  'cycles_received' : bigint,
  'realized_gain_loss_e6' : bigint,
}
export type CreateCanisterResult = { 'ok' : CreateCanisterSuccess } |
  { 'err' : ApiError };
export interface CreateCanisterSuccess {
  'block_id' : bigint,
  'canister_id' : Principal,
  'cost_basis_usd_e6' : bigint,
  'cycles_spent' : bigint,
}
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
export type EventType = { 'canister_creation' : null } |
  { 'revalue' : null } |
  { 'convert' : null } |
  { 'burn' : null } |
  { 'aggregation' : null } |
  { 'distribute' : null } |
  { 'reconcile' : null } |
  { 'buyback' : null } |
  { 'collect' : null };
export interface FrozenControl {
  'default_creation_subnet' : [] | [Principal],
  'cycles_balance' : bigint,
  'party_icp_spot_principal' : [] | [Principal],
  'icp_ckusdc_spot_principal' : [] | [Principal],
  'treasury_cycles_floor' : bigint,
  'registered_canisters_count' : bigint,
  'system_state' : SystemState,
  'icp_ckusdt_spot_principal' : [] | [Principal],
  'timer_running' : boolean,
  'oracle_principal' : [] | [Principal],
  'max_allocation' : bigint,
  'min_icp_reserve' : bigint,
  'registry_principal' : [] | [Principal],
  'target_topup_cadence_days' : bigint,
  'max_slippage_bps' : bigint,
  'this_principal' : Principal,
  'min_cycles_per_topup' : bigint,
  'admin_principals' : Array<Principal>,
  'min_stablecoin_threshold_usd_e6' : bigint,
}
export interface JournalEntriesResponse {
  'data' : Array<JournalEntry>,
  'next_cursor' : [] | [bigint],
  'has_more' : boolean,
}
export interface JournalEntry {
  'id' : bigint,
  'amount_a_token' : TokenType,
  'usd_value_e6' : bigint,
  'memo' : [] | [string],
  'amount_b_token' : TokenType,
  'cost_basis_usd_e6' : bigint,
  'amount_a' : bigint,
  'amount_b' : bigint,
  'gain_loss_e6' : bigint,
  'counterparty' : [] | [Principal],
  'timestamp' : bigint,
  'icp_usd_rate_e12' : bigint,
  'event_type' : EventType,
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
export interface ReconcileResult {
  'untracked_icp' : bigint,
  'untracked_cycles' : bigint,
}
export interface RegisteredCanisterInfo {
  'last_topup_at' : [] | [bigint],
  'total_cycles_received' : bigint,
  'principal' : Principal,
  'name' : string,
  'role' : CanisterRole,
  'topup_count' : bigint,
  'registered_at' : bigint,
}
export interface RegisteredCanistersResponse {
  'data' : Array<RegisteredCanisterInfo>,
  'next_cursor' : [] | [Principal],
  'has_more' : boolean,
}
export type RetryBurnResult = { 'ok' : RetryBurnSuccess } |
  { 'err' : ApiError };
export interface RetryBurnSuccess { 'party_burned' : bigint }
export interface Snapshot {
  'cumulative_cycles_donation_usd_e6' : bigint,
  'cycles_balance' : bigint,
  'cumulative_icp_to_cycles' : bigint,
  'cumulative_cycles_out' : bigint,
  'fees_from_ckusdc_markets_usd_e6' : bigint,
  'fees_from_icp_markets_usd_e6' : bigint,
  'icp_fair_value_usd_e6' : bigint,
  'icp_cost_basis_usd_e6' : bigint,
  'cumulative_party_burned' : bigint,
  'registered_canister_count' : number,
  'cycles_cost_basis_usd_e6' : bigint,
  'fees_from_ckusdt_markets_usd_e6' : bigint,
  'cumulative_realized_gain_loss_e6' : bigint,
  'ckusdc_balance' : bigint,
  'ckusdt_balance' : bigint,
  'day_index' : number,
  'timestamp' : bigint,
  'cumulative_buyback_usd_e6' : bigint,
  'icp_usd_rate_e12' : bigint,
  'icp_balance' : bigint,
  'cumulative_cycles_expense_usd_e6' : bigint,
  'cumulative_fees_icp' : bigint,
  'unrealized_gain_loss_e6' : bigint,
}
export interface SnapshotView {
  'cycles_balance' : bigint,
  'fees_icp' : bigint,
  'icp_to_cycles' : bigint,
  'cycles_donation_usd_e6' : bigint,
  'party_burned' : bigint,
  'fees_from_ckusdc_markets_usd_e6' : bigint,
  'fees_from_icp_markets_usd_e6' : bigint,
  'icp_fair_value_usd_e6' : bigint,
  'icp_cost_basis_usd_e6' : bigint,
  'registered_canister_count' : number,
  'cycles_cost_basis_usd_e6' : bigint,
  'fees_from_ckusdt_markets_usd_e6' : bigint,
  'ckusdc_balance' : bigint,
  'ckusdt_balance' : bigint,
  'day_index' : number,
  'cycles_expense_usd_e6' : bigint,
  'cycles_out' : bigint,
  'timestamp' : bigint,
  'icp_usd_rate_e12' : bigint,
  'buyback_usd_e6' : bigint,
  'icp_balance' : bigint,
  'unrealized_gain_loss_e6' : bigint,
  'realized_gain_loss_e6' : bigint,
}
export interface SnapshotsResponse {
  'data' : Array<SnapshotView>,
  'next_cursor' : [] | [bigint],
  'has_more' : boolean,
}
export type SystemState = { 'normal' : null } |
  { 'halted' : null } |
  { 'degraded' : null };
export type TokenType = { 'btc' : null } |
  { 'eth' : null } |
  { 'icp' : null } |
  { 'none' : null } |
  { 'ckusdc' : null } |
  { 'ckusdt' : null } |
  { 'cycles' : null } |
  { 'party' : null };
export type TransferCyclesResult = { 'ok' : TransferCyclesSuccess } |
  { 'err' : ApiError };
export interface TransferCyclesSuccess {
  'cost_usd_e6' : bigint,
  'cycles_sent' : bigint,
}
export interface UpgradeArgs {
  'set_default_creation_subnet' : [] | [Principal],
  'remove_admins' : [] | [Array<Principal>],
  'set_max_allocation' : [] | [bigint],
  'set_min_cycles_per_topup' : [] | [bigint],
  'set_party_icp_spot_principal' : [] | [Principal],
  'set_registry_principal' : [] | [Principal],
  'set_oracle_principal' : [] | [Principal],
  'set_min_stablecoin_threshold_usd_e6' : [] | [bigint],
  'set_target_topup_cadence_days' : [] | [bigint],
  'set_min_icp_reserve' : [] | [bigint],
  'set_treasury_cycles_floor' : [] | [bigint],
  'add_admins' : [] | [Array<Principal>],
  'set_max_slippage_bps' : [] | [bigint],
  'set_icp_ckusdc_spot_principal' : [] | [Principal],
  'set_icp_ckusdt_spot_principal' : [] | [Principal],
}
export interface _SERVICE {
  /**
   * / Set up ICRC-2 approvals for all configured spot markets (admin only).
   * / Must be called after setting spot principals via admin_upgrade_config.
   * / Returns errors for any markets that failed (empty = all succeeded).
   */
  'admin_approve_spot_markets' : ActorMethod<[], ApiResult_5>,
  /**
   * / Burn specified PARTY amount to the minting account (admin only).
   * / Use after a buyback where the swap succeeded but the burn failed.
   */
  'admin_burn_party' : ActorMethod<[bigint], RetryBurnResult>,
  /**
   * / Convert ICP to cycles via CMC for reserve replenishment (admin only).
   */
  'admin_convert_icp_to_cycles' : ActorMethod<[bigint], ConversionResult>,
  /**
   * / Get event log entries with cursor-based pagination (admin only).
   */
  'admin_get_event_logs' : ActorMethod<[[] | [bigint], number], ApiResult_4>,
  /**
   * / Get journal entries with cursor-based pagination (admin only).
   */
  'admin_get_journal_entries' : ActorMethod<
    [[] | [bigint], number],
    ApiResult_3
  >,
  /**
   * / Reconcile ICP and Cycles inventory with actual ledger balances (admin only).
   * / Use after initial funding to bring untracked assets into inventory with $0 cost basis.
   * / Creates a journal entry if any deviation is found.
   */
  'admin_reconcile' : ActorMethod<[], ApiResult_2>,
  /**
   * / Register a canister for cycle management (admin only, idempotent).
   */
  'admin_register_canister' : ActorMethod<
    [Principal, CanisterRole, string],
    ApiResult_1
  >,
  /**
   * / Remove a canister from management registry (admin only).
   */
  'admin_remove_canister' : ActorMethod<[Principal], ApiResult_1>,
  /**
   * / Set operational state for a registered canister (admin only).
   */
  'admin_set_canister_state' : ActorMethod<
    [Principal, CanisterState],
    ApiResult_1
  >,
  /**
   * / Set system operational state (admin only).
   */
  'admin_set_system_state' : ActorMethod<[SystemState], ApiResult_1>,
  /**
   * / Start the heartbeat timer (admin only). No-op if already running.
   */
  'admin_start_timer' : ActorMethod<[], ApiResult_1>,
  /**
   * / Stop the heartbeat timer (admin only).
   */
  'admin_stop_timer' : ActorMethod<[], ApiResult_1>,
  /**
   * / Push-based topup to a specific registered canister (admin only).
   * / Bypasses profitability checks — for emergencies or manual intervention.
   */
  'admin_topup_canister' : ActorMethod<
    [Principal, bigint],
    TransferCyclesResult
  >,
  /**
   * / Update runtime configuration (admin_principals, target_runway, etc.).
   */
  'admin_upgrade_config' : ActorMethod<[UpgradeArgs], ApiResult_1>,
  /**
   * / Collect protocol fees from a registered canister (push-based).
   * / Caller must pre-approve Treasury for ICRC-2 transfer_from.
   * / Fee collection is independent from topup requests - self-calibrating threshold.
   */
  'collect_protocol_fees' : ActorMethod<[bigint], CollectFeesResult>,
  /**
   * / Create a canister shell via Cycles Ledger (registry inter-canister call).
   * / Treasury handles cycles provisioning, cost tracking, and auto-registration.
   * / Authorized callers: registry_principal OR admins.
   */
  'create_canister_shell' : ActorMethod<
    [[] | [CanisterSettings], string, CanisterRole, bigint],
    CreateCanisterResult
  >,
  /**
   * / Get comprehensive status for a registered canister.
   */
  'get_canister_status' : ActorMethod<[Principal], ApiResult>,
  /**
   * / Get current control plane state (public, transparent).
   */
  'get_control' : ActorMethod<[], FrozenControl>,
  /**
   * / Get registered canisters with cycle metrics (paginated).
   */
  'get_registered_canisters' : ActorMethod<
    [[] | [Principal], number],
    RegisteredCanistersResponse
  >,
  /**
   * / Get a specific snapshot by day_index (null = today's snapshot).
   */
  'get_snapshot' : ActorMethod<[[] | [number]], [] | [Snapshot]>,
  /**
   * / Daily snapshots with timestamp-based cursor pagination.
   */
  'get_snapshots' : ActorMethod<[[] | [bigint], bigint], SnapshotsResponse>,
  /**
   * / Transfer cycles to calling canister (pull-based topup).
   * / Caller must be a registered canister. Inter-canister only.
   * / See: md/canon/backend/_shared/08-CycleManagement.md
   */
  'request_topup' : ActorMethod<[], TransferCyclesResult>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
