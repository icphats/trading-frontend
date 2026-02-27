/**
 * Oracle Type Barrel
 *
 * Type-only re-exports from Candid declarations.
 * All runtime logic lives in repositories (oracle.repository.ts).
 */

export type {
  _SERVICE as OracleService,
  CachedPrice,
  PriceArchiveResponse,
} from 'declarations/oracle/oracle.did';
