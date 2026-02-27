/**
 * Platform Domain
 *
 * Exports platform-level state and utilities for platform-wide metrics,
 * statistics, and chart data sourced from the indexer.
 */

export {
  platformState,
  type FrozenPlatformStats,
  type PlatformSnapshotsResponse,
  type PlatformSnapshotView,
} from './platform.state.svelte';
