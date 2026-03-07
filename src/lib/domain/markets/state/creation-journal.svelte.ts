/**
 * Creation Journal State Management
 *
 * Polls the registry's get_creations() endpoint for live creation progress.
 * Singleton state — startPolling() begins interval-based fetches, stopPolling() clears.
 */

import { api } from '$lib/actors/api.svelte';
import type {
  FrozenCreationEntry,
  CreationPhase,
} from 'declarations/registry/registry.did';

export type { FrozenCreationEntry, CreationPhase };

/**
 * Returns a human-readable label for a creation phase.
 */
export function phaseLabel(phase: CreationPhase): string {
  if ('querying_metadata' in phase) return 'Querying token metadata...';
  if ('creating_canister' in phase) return 'Creating canister...';
  if ('installing_wasm' in phase) return 'Installing code...';
  if ('notifying_indexer' in phase) return 'Notifying indexer...';
  if ('completed' in phase) return 'Completed';
  if ('failed' in phase) return 'Failed';
  return 'Unknown';
}

/**
 * Returns a numeric index (0-5) for progress bar ordering.
 */
export function phaseIndex(phase: CreationPhase): number {
  if ('querying_metadata' in phase) return 0;
  if ('creating_canister' in phase) return 1;
  if ('installing_wasm' in phase) return 2;
  if ('notifying_indexer' in phase) return 3;
  if ('completed' in phase) return 4;
  if ('failed' in phase) return 5;
  return -1;
}

class CreationJournalState {
  entries: FrozenCreationEntry[] = $state([]);
  isPolling: boolean = $state(false);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  /** Timestamp (ms) captured when polling starts — filters out older entries. */
  private pollStartedAt: number = 0;

  /** The most recent entry by `updated_at`. */
  latestEntry: FrozenCreationEntry | undefined = $derived(
    this.entries.length === 0
      ? undefined
      : this.entries.reduce((latest, entry) =>
          entry.updated_at > latest.updated_at ? entry : latest
        )
  );

  /** The entry that is neither completed nor failed, if any. */
  activeEntry: FrozenCreationEntry | undefined = $derived(
    this.entries.find(
      (entry) => !('completed' in entry.phase) && !('failed' in entry.phase)
    )
  );

  /**
   * Single fetch from the registry. Used internally by startPolling
   * and available for manual refresh.
   */
  async poll(): Promise<void> {
    if (!api.registry) return;

    try {
      const result = await api.registry.get_creations();
      // Only show entries that started after polling began — avoids stale flash
      this.entries = result.filter(
        (e) => Number(e.started_at) >= this.pollStartedAt
      );
    } catch (err) {
      console.error('[CreationJournal] Poll failed:', err);
    }
  }

  /**
   * Start polling get_creations at the given interval.
   */
  startPolling(intervalMs: number = 2000): void {
    if (this.intervalId !== null) return;

    this.pollStartedAt = Date.now();
    this.isPolling = true;
    this.poll();

    this.intervalId = setInterval(() => {
      this.poll();
    }, intervalMs);
  }

  /**
   * Stop polling and clear the interval.
   */
  stopPolling(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isPolling = false;
  }

  /**
   * Clear all state and stop polling.
   */
  reset(): void {
    this.stopPolling();
    this.entries = [];
    this.pollStartedAt = 0;
  }
}

export const creationJournal = new CreationJournalState();
