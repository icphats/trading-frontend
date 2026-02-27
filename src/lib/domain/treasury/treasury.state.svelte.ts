/**
 * Treasury State Coordinator
 *
 * PURPOSE: Orchestrates fetching treasury snapshots and pushing to entityStore.
 * This is a COORDINATOR per 03-DataFlow.md - it triggers fetches and manages
 * operational state, but does NOT hold entity data.
 *
 * ## Data Flow
 *
 * ```
 * treasury canister
 *        |
 *        v
 * treasuryRepository.fetchSnapshots() (fetch, cache, transform)
 *        |
 *        v
 * entityStore.upsertTreasurySnapshots() (single source of truth)
 *        |
 *        v
 * TreasuryChart ($derived from entityStore)
 * ```
 *
 * ## Coordinator Responsibilities
 * - Trigger data fetches via repository
 * - Push fetched data to entityStore
 * - Manage operational state (isLoading, lastError)
 * - NOT own entity data (that's in entityStore)
 */

import {
  treasuryRepository,
  type TreasuryMetric,
  type TreasuryStatement,
} from '$lib/repositories/treasury.repository';
import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
import type { TimeInterval } from '$lib/components/ui/charts/core/chart.constants';

// Re-export types for consumers
export type { TreasuryMetric, TreasuryStatement };
export type { TreasuryDataPoint } from '$lib/domain/orchestration/entity-store.svelte';

// ============================================
// Treasury State Coordinator
// ============================================

class TreasuryStateCoordinator {
  // ============================================
  // Operational State (Coordinator owns this)
  // ============================================

  /** Loading state - operational, not entity data */
  isLoading = $state(false);

  /** Last error - operational, not entity data */
  lastError = $state<string | null>(null);

  /** Treasury statement - coordinator owns this (not in entityStore) */
  statement = $state<TreasuryStatement | null>(null);

  /** Statement loading state */
  isStatementLoading = $state(false);

  // ============================================
  // Data Fetching (Coordinator triggers these)
  // ============================================

  /**
   * Fetch treasury snapshots and push to entityStore.
   * Returns the data points for immediate use if needed.
   *
   * @param interval - Time interval ('1D', '1W', '1M', '1Y')
   * @param metric - Which metric to extract
   */
  async fetchSnapshots(
    interval: TimeInterval,
    metric: TreasuryMetric = 'fees_icp'
  ): Promise<void> {
    this.isLoading = true;
    this.lastError = null;

    try {
      // Fetch via repository (handles caching internally)
      const result = await treasuryRepository.fetchSnapshots(interval, metric);

      if ('err' in result) {
        this.lastError = result.err;
        return;
      }

      // PUSH to entityStore (single source of truth)
      entityStore.upsertTreasurySnapshots(interval, metric, result.ok);
    } catch (error) {
      console.error('[TreasuryCoordinator] Failed to fetch snapshots:', error);
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      this.isLoading = false;
    }
  }


  /**
   * Fetch treasury statement - financial statement view with labels joined.
   * Used for displaying financial tables.
   *
   * @param dayIndex - Optional day index. null = current/latest snapshot.
   */
  async fetchStatement(dayIndex?: number): Promise<void> {
    this.isStatementLoading = true;
    this.lastError = null;

    try {
      const result = await treasuryRepository.fetchStatement(dayIndex);

      if ('err' in result) {
        this.lastError = result.err;
        return;
      }

      this.statement = result.ok;
    } catch (error) {
      console.error('[TreasuryCoordinator] Failed to fetch statement:', error);
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      this.isStatementLoading = false;
    }
  }

  // ============================================
  // Cache Management (Delegated to repository)
  // ============================================

  /**
   * Clear all caches (repository cache + entityStore)
   */
  clearCache(): void {
    treasuryRepository.clearCache();
    entityStore.clearTreasurySnapshots();
  }

  /**
   * Invalidate cache for specific interval/metric and refetch
   */
  async invalidateAndRefetch(interval: TimeInterval, metric: TreasuryMetric): Promise<void> {
    treasuryRepository.invalidateCache(interval, metric);
    await this.fetchSnapshots(interval, metric);
  }
}

// ============================================
// Singleton Export
// ============================================

export const treasuryState = new TreasuryStateCoordinator();

// Development helper
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).treasuryState = treasuryState;
}
