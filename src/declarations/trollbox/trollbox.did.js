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
  const ApiResult_2 = IDL.Variant({ 'ok' : EventLogPage, 'err' : ApiError });
  const ApiResult_1 = IDL.Variant({ 'ok' : IDL.Bool, 'err' : ApiError });
  const ApiResult = IDL.Variant({ 'ok' : IDL.Null, 'err' : ApiError });
  const SystemState = IDL.Variant({
    'normal' : IDL.Null,
    'halted' : IDL.Null,
    'degraded' : IDL.Null,
  });
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
  const MessageId = IDL.Nat64;
  const MessageResponse = IDL.Record({
    'id' : MessageId,
    'content' : IDL.Text,
    'username' : IDL.Opt(IDL.Text),
    'created_at' : IDL.Nat64,
    'author' : IDL.Principal,
  });
  const HydrateResponse = IDL.Record({
    'my_username' : IDL.Opt(IDL.Text),
    'messages' : IDL.Vec(MessageResponse),
  });
  const MessagesResponse = IDL.Record({
    'data' : IDL.Vec(MessageResponse),
    'next_cursor' : IDL.Opt(MessageId),
    'has_more' : IDL.Bool,
  });
  const MessageResult = IDL.Variant({
    'ok' : MessageResponse,
    'err' : ApiError,
  });
  const UsernameResult = IDL.Variant({ 'ok' : IDL.Text, 'err' : ApiError });
  return IDL.Service({
    'admin_get_event_logs' : IDL.Func(
        [IDL.Opt(IDL.Nat64), IDL.Nat32],
        [ApiResult_2],
        ['query'],
      ),
    'admin_release_rate_limit' : IDL.Func([IDL.Principal], [ApiResult_1], []),
    'admin_set_lockdown' : IDL.Func([IDL.Bool], [ApiResult], []),
    'admin_set_system_state' : IDL.Func([SystemState], [ApiResult], []),
    'admin_start_timer' : IDL.Func([], [ApiResult], []),
    'admin_stop_timer' : IDL.Func([], [ApiResult], []),
    'admin_upgrade_config' : IDL.Func([UpgradeArgs], [ApiResult], []),
    'check_username_available' : IDL.Func([IDL.Text], [IDL.Bool], ['query']),
    'get_control' : IDL.Func([], [FrozenControl], ['query']),
    'get_hydration' : IDL.Func([IDL.Nat], [HydrateResponse], ['query']),
    'get_messages' : IDL.Func(
        [IDL.Opt(MessageId), IDL.Nat],
        [MessagesResponse],
        ['query'],
      ),
    'get_username' : IDL.Func([IDL.Principal], [IDL.Opt(IDL.Text)], ['query']),
    'send_message' : IDL.Func([IDL.Text], [MessageResult], []),
    'set_username' : IDL.Func([IDL.Text], [UsernameResult], []),
  });
};
export const init = ({ IDL }) => { return []; };
