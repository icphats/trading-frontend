/**
 * Treasury Type Barrel
 *
 * Type-only re-exports from Candid declarations.
 * All runtime logic lives in repositories (treasury.repository.ts).
 */

export type {
  _SERVICE as TreasuryCanisterService,
  // Core result types
  ApiError,
  ApiResult,
  ApiResult_1 as VoidApiResult,
  // Canister management types
  CanisterRole,
  CanisterState,
  RegisteredCanisterInfo,
  RegisteredCanistersResponse,
  // Conversion types
  ConversionResult,
  ConversionSuccess,
  // Buyback types
  RetryBurnResult,
  RetryBurnSuccess,
  // Config types
  ErrorCategory,
  FrozenControl,
  UpgradeArgs,
  // Snapshot types
  Snapshot,
  SnapshotView,
  SnapshotsResponse,
  // Cycles transfer types
  TransferCyclesResult,
} from 'declarations/treasury/treasury.did';
