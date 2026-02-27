import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type BlockIndex = bigint;
export interface InterCanisterTransferArgs {
  'canister_id' : Principal,
  'user_id' : Principal,
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
  'transfer_type' : TransferType,
}
export type InterCanisterTransferResult = { 'ok' : BlockIndex } |
  { 'err' : MinterError };
export interface Minter {
  /**
   * / Execute inter-canister transfer (mint or burn).
   * / Supports deduplication via created_at_time passthrough.
   */
  'inter_canister_transfer' : ActorMethod<
    [InterCanisterTransferArgs],
    InterCanisterTransferResult
  >,
  /**
   * / Mint tokens to a specified principal.
   */
  'mint_to_self' : ActorMethod<[bigint, string], InterCanisterTransferResult>,
}
export type MinterError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  { 'BadBurn' : { 'min_burn_amount' : bigint } } |
  { 'Duplicate' : { 'duplicate_of' : bigint } } |
  { 'BadFee' : { 'expected_fee' : bigint } } |
  { 'CreatedInFuture' : { 'ledger_time' : bigint } } |
  { 'TooOld' : null } |
  { 'InsufficientFunds' : { 'balance' : bigint } };
export type TransferType = { 'burn' : null } |
  { 'mint' : null };
/**
 * / Minter canister for inter-canister token transfers.
 * / Handles minting and burning operations for the party ledger.
 */
export interface _SERVICE extends Minter {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
