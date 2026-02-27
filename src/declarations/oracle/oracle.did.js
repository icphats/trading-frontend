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
  const ApiResult = IDL.Variant({ 'ok' : IDL.Null, 'err' : ApiError });
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
  const ApiResult_1 = IDL.Variant({ 'ok' : EventLogPage, 'err' : ApiError });
  const PriceEntry = IDL.Record({
    'timestamp' : IDL.Nat64,
    'price_e12' : IDL.Nat,
  });
  const PatchPricesArgs = IDL.Record({
    'entries' : IDL.Vec(PriceEntry),
    'symbol' : IDL.Text,
  });
  const SystemState = IDL.Variant({
    'normal' : IDL.Null,
    'halted' : IDL.Null,
    'degraded' : IDL.Null,
  });
  const UpgradeArgs = IDL.Record({
    'remove_tokens' : IDL.Opt(IDL.Vec(IDL.Text)),
    'remove_admins' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'set_treasury_principal' : IDL.Opt(IDL.Principal),
    'set_cycles_threshold' : IDL.Opt(IDL.Nat),
    'reset_topup_backoff' : IDL.Opt(IDL.Bool),
    'add_tokens' : IDL.Opt(IDL.Vec(IDL.Text)),
    'add_admins' : IDL.Opt(IDL.Vec(IDL.Principal)),
  });
  const FrozenControl = IDL.Record({
    'live_tokens' : IDL.Vec(IDL.Text),
    'system_state' : SystemState,
    'cycles_threshold' : IDL.Nat,
    'treasury_principal' : IDL.Opt(IDL.Principal),
    'this_principal' : IDL.Principal,
    'admin_principals' : IDL.Vec(IDL.Principal),
  });
  const CachedPrice = IDL.Record({
    'timestamp' : IDL.Nat64,
    'price_e12' : IDL.Nat,
  });
  const PriceArchiveResponse = IDL.Record({
    'data' : IDL.Vec(CachedPrice),
    'total_count' : IDL.Nat,
  });
  return IDL.Service({
    'admin_clear_cache' : IDL.Func([], [ApiResult], []),
    'admin_get_event_logs' : IDL.Func(
        [IDL.Opt(IDL.Nat64), IDL.Nat32],
        [ApiResult_1],
        ['query'],
      ),
    'admin_patch_prices' : IDL.Func(
        [IDL.Vec(PatchPricesArgs)],
        [ApiResult],
        [],
      ),
    'admin_set_system_state' : IDL.Func([SystemState], [ApiResult], []),
    'admin_start_timer' : IDL.Func([], [ApiResult], []),
    'admin_stop_timer' : IDL.Func([], [ApiResult], []),
    'admin_upgrade_config' : IDL.Func([UpgradeArgs], [ApiResult], []),
    'get_control' : IDL.Func([], [FrozenControl], ['query']),
    'get_most_recent_price' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(CachedPrice)],
        ['query'],
      ),
    'get_nearest_price' : IDL.Func(
        [IDL.Text, IDL.Nat64],
        [IDL.Opt(CachedPrice)],
        ['query'],
      ),
    'get_price_archive' : IDL.Func(
        [IDL.Text, IDL.Nat64, IDL.Nat64, IDL.Nat64],
        [IDL.Opt(PriceArchiveResponse)],
        ['query'],
      ),
    'get_tracked_tokens' : IDL.Func([], [IDL.Vec(IDL.Text)], ['query']),
    'get_twap' : IDL.Func([IDL.Text, IDL.Nat64], [IDL.Opt(IDL.Nat)], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
