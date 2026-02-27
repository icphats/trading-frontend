export const idlFactory = ({ IDL }) => {
  const TransferType = IDL.Variant({ 'burn' : IDL.Null, 'mint' : IDL.Null });
  const InterCanisterTransferArgs = IDL.Record({
    'canister_id' : IDL.Principal,
    'user_id' : IDL.Principal,
    'created_at_time' : IDL.Opt(IDL.Nat64),
    'amount' : IDL.Nat,
    'transfer_type' : TransferType,
  });
  const BlockIndex = IDL.Nat;
  const MinterError = IDL.Variant({
    'GenericError' : IDL.Record({
      'message' : IDL.Text,
      'error_code' : IDL.Nat,
    }),
    'TemporarilyUnavailable' : IDL.Null,
    'BadBurn' : IDL.Record({ 'min_burn_amount' : IDL.Nat }),
    'Duplicate' : IDL.Record({ 'duplicate_of' : IDL.Nat }),
    'BadFee' : IDL.Record({ 'expected_fee' : IDL.Nat }),
    'CreatedInFuture' : IDL.Record({ 'ledger_time' : IDL.Nat64 }),
    'TooOld' : IDL.Null,
    'InsufficientFunds' : IDL.Record({ 'balance' : IDL.Nat }),
  });
  const InterCanisterTransferResult = IDL.Variant({
    'ok' : BlockIndex,
    'err' : MinterError,
  });
  const Minter = IDL.Service({
    'inter_canister_transfer' : IDL.Func(
        [InterCanisterTransferArgs],
        [InterCanisterTransferResult],
        [],
      ),
    'mint_to_self' : IDL.Func(
        [IDL.Nat, IDL.Text],
        [InterCanisterTransferResult],
        [],
      ),
  });
  return Minter;
};
export const init = ({ IDL }) => { return []; };
