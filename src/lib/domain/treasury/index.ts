/**
 * Treasury Domain
 *
 * Exports treasury state coordinator and types for treasury canister
 * treasury snapshots and metrics charting.
 *
 * Architecture per 03-DataFlow.md:
 * - treasuryState: Coordinator that triggers fetches and pushes to entityStore
 * - Data is stored in entityStore (single source of truth)
 * - Components derive from entityStore via $derived
 */

// Coordinator
export { treasuryState } from './treasury.state.svelte';

// Types
export type {
  TreasuryMetric,
  TreasuryDataPoint,
  TreasuryStatement,
} from './treasury.state.svelte';

// Re-export repository types for advanced use cases
export type { Snapshot, SnapshotsResponse, RegisteredCanisterInfo } from '$lib/repositories/treasury.repository';
