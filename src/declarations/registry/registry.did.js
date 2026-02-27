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
  const ApiResult = IDL.Variant({ 'ok' : IDL.Bool, 'err' : ApiError });
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
  const ApiResult_3 = IDL.Variant({ 'ok' : EventLogPage, 'err' : ApiError });
  const WasmType = IDL.Variant({ 'spot' : IDL.Null, 'ledger' : IDL.Null });
  const ApiResult_2 = IDL.Variant({ 'ok' : IDL.Null, 'err' : ApiError });
  const SystemState = IDL.Variant({
    'normal' : IDL.Null,
    'halted' : IDL.Null,
    'degraded' : IDL.Null,
  });
  const UpgradeArgs = IDL.Record({
    'remove_admins' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'set_treasury_principal' : IDL.Opt(IDL.Principal),
    'set_icp_ledger_creation_fee' : IDL.Opt(IDL.Nat),
    'set_oracle_principal' : IDL.Opt(IDL.Principal),
    'set_cycles_threshold' : IDL.Opt(IDL.Nat),
    'reset_topup_backoff' : IDL.Opt(IDL.Bool),
    'set_indexer_principal' : IDL.Opt(IDL.Principal),
    'set_icp_spot_creation_fee' : IDL.Opt(IDL.Nat),
    'add_admins' : IDL.Opt(IDL.Vec(IDL.Principal)),
  });
  const WasmUploadResult = IDL.Variant({ 'ok' : IDL.Bool, 'err' : ApiError });
  const ApiResult_1 = IDL.Variant({ 'ok' : IDL.Nat, 'err' : ApiError });
  const MetadataValue = IDL.Variant({
    'Int' : IDL.Int,
    'Nat' : IDL.Nat,
    'Blob' : IDL.Vec(IDL.Nat8),
    'Text' : IDL.Text,
  });
  const Account = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const ArchiveOptions = IDL.Record({
    'num_blocks_to_archive' : IDL.Nat64,
    'max_transactions_per_response' : IDL.Opt(IDL.Nat64),
    'trigger_threshold' : IDL.Nat64,
    'more_controller_ids' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'max_message_size_bytes' : IDL.Opt(IDL.Nat64),
    'cycles_for_archive_creation' : IDL.Opt(IDL.Nat64),
    'node_max_memory_size_bytes' : IDL.Opt(IDL.Nat64),
    'controller_id' : IDL.Principal,
  });
  const FeatureFlags = IDL.Record({ 'icrc2' : IDL.Bool });
  const LedgerInitArgs = IDL.Record({
    'decimals' : IDL.Opt(IDL.Nat8),
    'token_symbol' : IDL.Text,
    'transfer_fee' : IDL.Nat,
    'metadata' : IDL.Vec(IDL.Tuple(IDL.Text, MetadataValue)),
    'minting_account' : Account,
    'initial_balances' : IDL.Vec(IDL.Tuple(Account, IDL.Nat)),
    'fee_collector_account' : IDL.Opt(Account),
    'archive_options' : ArchiveOptions,
    'max_memo_length' : IDL.Opt(IDL.Nat16),
    'index_principal' : IDL.Opt(IDL.Principal),
    'token_name' : IDL.Text,
    'feature_flags' : IDL.Opt(FeatureFlags),
  });
  const CreateLedgerArgs = IDL.Record({
    'controllers' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'init_args' : LedgerInitArgs,
  });
  const InternalCanisterMetadata = IDL.Record({
    'created_at' : IDL.Nat64,
    'created_by' : IDL.Principal,
    'version' : IDL.Text,
  });
  const LedgerMetadata = IDL.Record({
    'internal' : InternalCanisterMetadata,
    'canister_id' : IDL.Principal,
  });
  const LedgerResult = IDL.Variant({ 'ok' : LedgerMetadata, 'err' : ApiError });
  const SpotInitArgs = IDL.Record({
    'base' : IDL.Principal,
    'quote' : IDL.Principal,
  });
  const SpotMarketMetadata = IDL.Record({
    'internal' : InternalCanisterMetadata,
    'token0_ledger' : IDL.Principal,
    'canister_id' : IDL.Principal,
    'token1_ledger' : IDL.Principal,
    'token0_name' : IDL.Text,
    'token0_symbol' : IDL.Text,
    'registry_principal' : IDL.Principal,
    'token1_symbol' : IDL.Text,
    'token1_name' : IDL.Text,
  });
  const SpotMarketResult = IDL.Variant({
    'ok' : SpotMarketMetadata,
    'err' : ApiError,
  });
  const FrozenControl = IDL.Record({
    'system_state' : SystemState,
    'icp_spot_creation_fee' : IDL.Nat,
    'icp_ledger_creation_fee' : IDL.Nat,
    'treasury_allowance_set' : IDL.Bool,
    'oracle_principal' : IDL.Principal,
    'cycles_threshold' : IDL.Nat,
    'icp_transfer_fee' : IDL.Nat,
    'treasury_principal' : IDL.Opt(IDL.Principal),
    'indexer_principal' : IDL.Opt(IDL.Principal),
    'this_principal' : IDL.Principal,
    'admin_principals' : IDL.Vec(IDL.Principal),
  });
  const CreationFees = IDL.Record({ 'spot' : IDL.Nat, 'ledger' : IDL.Nat });
  return IDL.Service({
    'admin_delete_wasm' : IDL.Func([IDL.Text], [ApiResult], []),
    'admin_get_event_logs' : IDL.Func(
        [IDL.Opt(IDL.Nat64), IDL.Nat32],
        [ApiResult_3],
        ['query'],
      ),
    'admin_set_active_version' : IDL.Func(
        [WasmType, IDL.Text],
        [ApiResult_2],
        [],
      ),
    'admin_set_lockdown' : IDL.Func([IDL.Bool], [ApiResult_2], []),
    'admin_set_system_state' : IDL.Func([SystemState], [ApiResult_2], []),
    'admin_start_timer' : IDL.Func([], [ApiResult_2], []),
    'admin_stop_timer' : IDL.Func([], [ApiResult_2], []),
    'admin_upgrade_config' : IDL.Func([UpgradeArgs], [ApiResult_2], []),
    'admin_upload_chunk' : IDL.Func(
        [
          IDL.Text,
          IDL.Nat32,
          IDL.Nat32,
          IDL.Vec(IDL.Nat8),
          WasmType,
          IDL.Text,
          IDL.Bool,
        ],
        [WasmUploadResult],
        [],
      ),
    'claim_refund' : IDL.Func([], [ApiResult_1], []),
    'create_ledger' : IDL.Func([CreateLedgerArgs], [LedgerResult], []),
    'create_spot_market' : IDL.Func([SpotInitArgs], [SpotMarketResult], []),
    'get_all_markets' : IDL.Func([], [IDL.Vec(SpotMarketMetadata)], ['query']),
    'get_control' : IDL.Func([], [FrozenControl], ['query']),
    'get_creation_fees' : IDL.Func([], [CreationFees], ['query']),
    'get_ledgers_by_creator' : IDL.Func(
        [IDL.Principal],
        [IDL.Vec(IDL.Principal)],
        ['query'],
      ),
    'get_spot_market' : IDL.Func(
        [IDL.Principal, IDL.Principal],
        [IDL.Opt(SpotMarketMetadata)],
        ['query'],
      ),
    'release_rate_limit' : IDL.Func([IDL.Principal], [ApiResult], []),
  });
};
export const init = ({ IDL }) => { return []; };
