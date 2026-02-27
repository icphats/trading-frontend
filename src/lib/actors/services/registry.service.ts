/**
 * Registry Type Barrel
 *
 * Type-only re-exports from Candid declarations.
 * Runtime logic lives in domain/orchestration/market-operations.ts.
 */

export type {
  _SERVICE as RegistryService,
  SpotMarketResult,
  SpotMarketMetadata,
  LedgerResult,
  CreateLedgerArgs,
  CreationFees,
  LedgerInitArgs,
  SpotInitArgs,
} from 'declarations/registry/registry.did';
