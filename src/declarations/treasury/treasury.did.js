export const idlFactory = ({ IDL }) => {
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
  const ApiResult_5 = IDL.Variant({
    'ok' : IDL.Vec(IDL.Text),
    'err' : ApiError,
  });
  const RetryBurnSuccess = IDL.Record({ 'party_burned' : IDL.Nat64 });
  const RetryBurnResult = IDL.Variant({
    'ok' : RetryBurnSuccess,
    'err' : ApiError,
  });
  const ConversionSuccess = IDL.Record({
    'icp_fair_value_usd_e6' : IDL.Nat64,
    'icp_cost_basis_usd_e6' : IDL.Nat64,
    'icp_spent' : IDL.Nat64,
    'icp_usd_rate_e12' : IDL.Nat64,
    'cycles_received' : IDL.Nat,
    'realized_gain_loss_e6' : IDL.Int64,
  });
  const ConversionResult = IDL.Variant({
    'ok' : ConversionSuccess,
    'err' : ApiError,
  });
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
  const ApiResult_4 = IDL.Variant({ 'ok' : EventLogPage, 'err' : ApiError });
  const TokenType = IDL.Variant({
    'btc' : IDL.Null,
    'eth' : IDL.Null,
    'icp' : IDL.Null,
    'none' : IDL.Null,
    'ckusdc' : IDL.Null,
    'ckusdt' : IDL.Null,
    'cycles' : IDL.Null,
    'party' : IDL.Null,
  });
  const EventType = IDL.Variant({
    'canister_creation' : IDL.Null,
    'revalue' : IDL.Null,
    'convert' : IDL.Null,
    'burn' : IDL.Null,
    'aggregation' : IDL.Null,
    'distribute' : IDL.Null,
    'reconcile' : IDL.Null,
    'buyback' : IDL.Null,
    'collect' : IDL.Null,
  });
  const JournalEntry = IDL.Record({
    'id' : IDL.Nat64,
    'amount_a_token' : TokenType,
    'usd_value_e6' : IDL.Nat64,
    'memo' : IDL.Opt(IDL.Text),
    'amount_b_token' : TokenType,
    'cost_basis_usd_e6' : IDL.Nat64,
    'amount_a' : IDL.Nat64,
    'amount_b' : IDL.Nat64,
    'gain_loss_e6' : IDL.Int64,
    'counterparty' : IDL.Opt(IDL.Principal),
    'timestamp' : IDL.Nat64,
    'icp_usd_rate_e12' : IDL.Nat64,
    'event_type' : EventType,
  });
  const JournalEntriesResponse = IDL.Record({
    'data' : IDL.Vec(JournalEntry),
    'next_cursor' : IDL.Opt(IDL.Nat64),
    'has_more' : IDL.Bool,
  });
  const ApiResult_3 = IDL.Variant({
    'ok' : JournalEntriesResponse,
    'err' : ApiError,
  });
  const ReconcileResult = IDL.Record({
    'untracked_icp' : IDL.Nat64,
    'untracked_cycles' : IDL.Nat,
  });
  const ApiResult_2 = IDL.Variant({ 'ok' : ReconcileResult, 'err' : ApiError });
  const CanisterRole = IDL.Variant({
    'fee_source' : IDL.Record({ 'fee_token_ledger' : IDL.Principal }),
    'unmanaged' : IDL.Null,
    'cycles_only' : IDL.Null,
  });
  const ApiResult_1 = IDL.Variant({ 'ok' : IDL.Null, 'err' : ApiError });
  const CanisterState = IDL.Variant({
    'active' : IDL.Null,
    'halted' : IDL.Null,
  });
  const SystemState = IDL.Variant({
    'normal' : IDL.Null,
    'halted' : IDL.Null,
    'degraded' : IDL.Null,
  });
  const TransferCyclesSuccess = IDL.Record({
    'cost_usd_e6' : IDL.Nat,
    'cycles_sent' : IDL.Nat,
  });
  const TransferCyclesResult = IDL.Variant({
    'ok' : TransferCyclesSuccess,
    'err' : ApiError,
  });
  const UpgradeArgs = IDL.Record({
    'set_default_creation_subnet' : IDL.Opt(IDL.Principal),
    'remove_admins' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'set_max_allocation' : IDL.Opt(IDL.Nat),
    'set_min_cycles_per_topup' : IDL.Opt(IDL.Nat),
    'set_party_icp_spot_principal' : IDL.Opt(IDL.Principal),
    'set_registry_principal' : IDL.Opt(IDL.Principal),
    'set_oracle_principal' : IDL.Opt(IDL.Principal),
    'set_min_stablecoin_threshold_usd_e6' : IDL.Opt(IDL.Nat),
    'set_target_topup_cadence_days' : IDL.Opt(IDL.Nat),
    'set_min_icp_reserve' : IDL.Opt(IDL.Nat),
    'set_treasury_cycles_floor' : IDL.Opt(IDL.Nat),
    'add_admins' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'set_max_slippage_bps' : IDL.Opt(IDL.Nat),
    'set_icp_ckusdc_spot_principal' : IDL.Opt(IDL.Principal),
    'set_icp_ckusdt_spot_principal' : IDL.Opt(IDL.Principal),
  });
  const CollectFeesResult = IDL.Variant({ 'ok' : IDL.Null, 'err' : ApiError });
  const CanisterSettings = IDL.Record({
    'freezing_threshold' : IDL.Opt(IDL.Nat),
    'controllers' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'memory_allocation' : IDL.Opt(IDL.Nat),
    'compute_allocation' : IDL.Opt(IDL.Nat),
  });
  const CreateCanisterSuccess = IDL.Record({
    'block_id' : IDL.Nat,
    'canister_id' : IDL.Principal,
    'cost_basis_usd_e6' : IDL.Nat64,
    'cycles_spent' : IDL.Nat,
  });
  const CreateCanisterResult = IDL.Variant({
    'ok' : CreateCanisterSuccess,
    'err' : ApiError,
  });
  const CanisterStatusInfo = IDL.Record({
    'last_topup_at' : IDL.Opt(IDL.Nat64),
    'total_cycles_received' : IDL.Nat64,
    'burn_rate_cycles_per_day' : IDL.Nat,
    'principal' : IDL.Principal,
    'name' : IDL.Text,
    'role' : CanisterRole,
    'state' : CanisterState,
    'total_fees_collected_usd_e6' : IDL.Nat64,
    'total_fees_collected' : IDL.Nat64,
    'topup_count' : IDL.Nat,
    'burn_last_topup_amount' : IDL.Nat,
    'total_cycles_expense_usd_e6' : IDL.Nat64,
    'last_fee_sweep_at' : IDL.Opt(IDL.Nat64),
    'registered_at' : IDL.Nat64,
  });
  const ApiResult = IDL.Variant({
    'ok' : CanisterStatusInfo,
    'err' : ApiError,
  });
  const FrozenControl = IDL.Record({
    'default_creation_subnet' : IDL.Opt(IDL.Principal),
    'cycles_balance' : IDL.Nat,
    'party_icp_spot_principal' : IDL.Opt(IDL.Principal),
    'icp_ckusdc_spot_principal' : IDL.Opt(IDL.Principal),
    'treasury_cycles_floor' : IDL.Nat,
    'registered_canisters_count' : IDL.Nat,
    'system_state' : SystemState,
    'icp_ckusdt_spot_principal' : IDL.Opt(IDL.Principal),
    'timer_running' : IDL.Bool,
    'oracle_principal' : IDL.Opt(IDL.Principal),
    'max_allocation' : IDL.Nat,
    'min_icp_reserve' : IDL.Nat64,
    'registry_principal' : IDL.Opt(IDL.Principal),
    'target_topup_cadence_days' : IDL.Nat,
    'max_slippage_bps' : IDL.Nat,
    'this_principal' : IDL.Principal,
    'min_cycles_per_topup' : IDL.Nat,
    'admin_principals' : IDL.Vec(IDL.Principal),
    'min_stablecoin_threshold_usd_e6' : IDL.Nat64,
  });
  const RegisteredCanisterInfo = IDL.Record({
    'last_topup_at' : IDL.Opt(IDL.Nat64),
    'total_cycles_received' : IDL.Nat64,
    'principal' : IDL.Principal,
    'name' : IDL.Text,
    'role' : CanisterRole,
    'topup_count' : IDL.Nat,
    'registered_at' : IDL.Nat64,
  });
  const RegisteredCanistersResponse = IDL.Record({
    'data' : IDL.Vec(RegisteredCanisterInfo),
    'next_cursor' : IDL.Opt(IDL.Principal),
    'has_more' : IDL.Bool,
  });
  const Snapshot = IDL.Record({
    'cumulative_cycles_donation_usd_e6' : IDL.Nat,
    'cycles_balance' : IDL.Nat,
    'cumulative_icp_to_cycles' : IDL.Nat,
    'cumulative_cycles_out' : IDL.Nat,
    'fees_from_ckusdc_markets_usd_e6' : IDL.Nat,
    'fees_from_icp_markets_usd_e6' : IDL.Nat,
    'icp_fair_value_usd_e6' : IDL.Nat,
    'icp_cost_basis_usd_e6' : IDL.Nat,
    'cumulative_party_burned' : IDL.Nat,
    'registered_canister_count' : IDL.Nat32,
    'cycles_cost_basis_usd_e6' : IDL.Nat,
    'fees_from_ckusdt_markets_usd_e6' : IDL.Nat,
    'cumulative_realized_gain_loss_e6' : IDL.Int,
    'ckusdc_balance' : IDL.Nat,
    'ckusdt_balance' : IDL.Nat,
    'day_index' : IDL.Nat32,
    'timestamp' : IDL.Nat64,
    'cumulative_buyback_usd_e6' : IDL.Nat,
    'icp_usd_rate_e12' : IDL.Nat,
    'icp_balance' : IDL.Nat,
    'cumulative_cycles_expense_usd_e6' : IDL.Nat,
    'cumulative_fees_icp' : IDL.Nat,
    'unrealized_gain_loss_e6' : IDL.Int,
  });
  const SnapshotView = IDL.Record({
    'cycles_balance' : IDL.Nat,
    'fees_icp' : IDL.Nat,
    'icp_to_cycles' : IDL.Nat,
    'cycles_donation_usd_e6' : IDL.Nat,
    'party_burned' : IDL.Nat,
    'fees_from_ckusdc_markets_usd_e6' : IDL.Nat,
    'fees_from_icp_markets_usd_e6' : IDL.Nat,
    'icp_fair_value_usd_e6' : IDL.Nat,
    'icp_cost_basis_usd_e6' : IDL.Nat,
    'registered_canister_count' : IDL.Nat32,
    'cycles_cost_basis_usd_e6' : IDL.Nat,
    'fees_from_ckusdt_markets_usd_e6' : IDL.Nat,
    'ckusdc_balance' : IDL.Nat,
    'ckusdt_balance' : IDL.Nat,
    'day_index' : IDL.Nat32,
    'cycles_expense_usd_e6' : IDL.Nat,
    'cycles_out' : IDL.Nat,
    'timestamp' : IDL.Nat64,
    'icp_usd_rate_e12' : IDL.Nat,
    'buyback_usd_e6' : IDL.Nat,
    'icp_balance' : IDL.Nat,
    'unrealized_gain_loss_e6' : IDL.Int,
    'realized_gain_loss_e6' : IDL.Int,
  });
  const SnapshotsResponse = IDL.Record({
    'data' : IDL.Vec(SnapshotView),
    'next_cursor' : IDL.Opt(IDL.Nat64),
    'has_more' : IDL.Bool,
  });
  return IDL.Service({
    'admin_approve_spot_markets' : IDL.Func([], [ApiResult_5], []),
    'admin_burn_party' : IDL.Func([IDL.Nat], [RetryBurnResult], []),
    'admin_convert_icp_to_cycles' : IDL.Func([IDL.Nat], [ConversionResult], []),
    'admin_get_event_logs' : IDL.Func(
        [IDL.Opt(IDL.Nat64), IDL.Nat32],
        [ApiResult_4],
        ['query'],
      ),
    'admin_get_journal_entries' : IDL.Func(
        [IDL.Opt(IDL.Nat64), IDL.Nat32],
        [ApiResult_3],
        ['query'],
      ),
    'admin_reconcile' : IDL.Func([], [ApiResult_2], []),
    'admin_register_canister' : IDL.Func(
        [IDL.Principal, CanisterRole, IDL.Text],
        [ApiResult_1],
        [],
      ),
    'admin_remove_canister' : IDL.Func([IDL.Principal], [ApiResult_1], []),
    'admin_set_canister_state' : IDL.Func(
        [IDL.Principal, CanisterState],
        [ApiResult_1],
        [],
      ),
    'admin_set_system_state' : IDL.Func([SystemState], [ApiResult_1], []),
    'admin_start_timer' : IDL.Func([], [ApiResult_1], []),
    'admin_stop_timer' : IDL.Func([], [ApiResult_1], []),
    'admin_topup_canister' : IDL.Func(
        [IDL.Principal, IDL.Nat],
        [TransferCyclesResult],
        [],
      ),
    'admin_upgrade_config' : IDL.Func([UpgradeArgs], [ApiResult_1], []),
    'collect_protocol_fees' : IDL.Func([IDL.Nat], [CollectFeesResult], []),
    'create_canister_shell' : IDL.Func(
        [IDL.Opt(CanisterSettings), IDL.Text, CanisterRole, IDL.Nat],
        [CreateCanisterResult],
        [],
      ),
    'get_canister_status' : IDL.Func([IDL.Principal], [ApiResult], ['query']),
    'get_control' : IDL.Func([], [FrozenControl], ['query']),
    'get_registered_canisters' : IDL.Func(
        [IDL.Opt(IDL.Principal), IDL.Nat32],
        [RegisteredCanistersResponse],
        ['query'],
      ),
    'get_snapshot' : IDL.Func(
        [IDL.Opt(IDL.Nat32)],
        [IDL.Opt(Snapshot)],
        ['query'],
      ),
    'get_snapshots' : IDL.Func(
        [IDL.Opt(IDL.Nat64), IDL.Nat],
        [SnapshotsResponse],
        ['query'],
      ),
    'request_topup' : IDL.Func([], [TransferCyclesResult], []),
  });
};
export const init = ({ IDL }) => { return []; };
