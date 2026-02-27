/**
 * Platform State Coordinator
 *
 * PURPOSE: Orchestrates fetching of platform-wide statistics from the indexer
 * and provides a reactive single source of truth for platform metrics.
 *
 * This is a COORDINATOR pattern per 03-DataFlow.md:
 * - Orchestrates fetching from indexerRepository
 * - Holds operational state (loading, errors, timestamps)
 * - Holds platform data state (stats, chart data)
 * - Components DERIVE from this state
 *
 * ## Data Flow
 *
 * ```
 * indexerRepository.getPlatformStats()
 *        │
 *        ▼
 * platformState.fetchStats()
 *        │
 *        ▼
 * platformState.stats ← SOURCE OF TRUTH
 *        │
 *        ├─────────────────┬─────────────────┐
 *        ▼                 ▼                 ▼
 *   Stats.svelte    ExploreStats.svelte   Other Components
 *   (landing)       (explore page)
 * ```
 */

import { indexerRepository } from '$lib/repositories/indexer.repository';
import type {
  FrozenPlatformStats,
  PlatformSnapshotsResponse,
  PlatformSnapshotView,
} from 'declarations/indexer/indexer.did';

// Re-export types for consumers
export type { FrozenPlatformStats, PlatformSnapshotsResponse, PlatformSnapshotView };

// ============================================
// Configuration
// ============================================

const STATS_POLL_INTERVAL = 60_000; // 1 minute
const CHART_CACHE_TTL = 300_000; // 5 minutes

// ============================================
// Platform State Coordinator
// ============================================

class PlatformStateCoordinator {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private chartCache = new Map<string, { data: PlatformSnapshotsResponse; fetchedAt: number }>();

  // ============================================
  // Reactive State
  // ============================================

  /** Platform statistics from indexer */
  stats = $state<FrozenPlatformStats | null>(null);

  /** Loading state for stats */
  isLoadingStats = $state(false);

  /** Loading state for chart */
  isLoadingChart = $state(false);

  /** Last successful fetch timestamp */
  lastFetched = $state<number | null>(null);

  /** Last error message */
  lastError = $state<string | null>(null);

  /** Whether auto-polling is active */
  isPolling = $state(false);

  // ============================================
  // Derived Convenience Getters
  // ============================================

  /** 24h trading volume (E6 precision) */
  volume24h = $derived(this.stats?.volume_24h_usd_e6 ?? 0n);

  /** Total value locked (E6 precision) */
  tvl = $derived(this.stats?.total_tvl_usd_e6 ?? 0n);

  /** 24h pool fees (E6 precision) - LP share */
  poolFees24h = $derived(this.stats?.pool_fees_24h_usd_e6 ?? 0n);

  /** 24h book fees (E6 precision) - protocol revenue */
  bookFees24h = $derived(this.stats?.book_fees_24h_usd_e6 ?? 0n);

  /** Total 24h fees (pool + book) */
  totalFees24h = $derived(this.poolFees24h + this.bookFees24h);

  /** Cumulative pool volume (E6 precision) */
  poolVolumeCumulative = $derived(this.stats?.pool_volume_cumulative_usd_e6 ?? 0n);

  /** Cumulative book volume (E6 precision) */
  bookVolumeCumulative = $derived(this.stats?.book_volume_cumulative_usd_e6 ?? 0n);

  /** Total cumulative volume (pool + book) */
  totalVolumeCumulative = $derived(this.poolVolumeCumulative + this.bookVolumeCumulative);

  /** 24h volume change percentage */
  volumeChange24h = $derived(this.stats?.volume_change_24h_bps ?? 0);

  /** 24h TVL change percentage */
  tvlChange24h = $derived(this.stats?.tvl_change_24h_bps ?? 0);

  /** Total transaction count */
  totalTransactions = $derived(this.stats?.total_transactions ?? 0n);

  /** Active pool count */
  activePools = $derived(this.stats?.active_pools ?? 0);

  /** Active market count */
  activeMarkets = $derived(this.stats?.active_markets ?? 0);

  /** Snapshot count (for chart data availability) */
  snapshotCount = $derived(this.stats?.snapshot_count ?? 0n);

  /** TVL venue decomposition (E6 precision) */
  poolReserve = $derived(this.stats?.pool_reserve_usd_e6 ?? 0n);
  bookOpenInterest = $derived(this.stats?.book_open_interest_usd_e6 ?? 0n);
  triggerLocked = $derived(this.stats?.trigger_locked_usd_e6 ?? 0n);

  /** Entity counts */
  ordersLive = $derived(this.stats?.orders_live ?? 0);
  triggersLive = $derived(this.stats?.triggers_live ?? 0);
  totalPositions = $derived(this.stats?.total_positions ?? 0);

  /** Whether we have data */
  hasData = $derived(this.stats !== null);

  // ============================================
  // Fetch Methods
  // ============================================

  /**
   * Fetch platform statistics from indexer
   * Updates stats state on success
   */
  async fetchStats(skipCache = false): Promise<void> {
    if (this.isLoadingStats) return;

    this.isLoadingStats = true;
    this.lastError = null;

    try {
      const result = await indexerRepository.getPlatformStats(!skipCache);

      if ('ok' in result) {
        this.stats = result.ok;
        this.lastFetched = Date.now();
      } else {
        this.lastError = result.err;
        console.error('[PlatformState] Failed to fetch stats:', result.err);
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      console.error('[PlatformState] Failed to fetch stats:', error);
    } finally {
      this.isLoadingStats = false;
    }
  }

  /**
   * Fetch platform snapshots at a given interval
   * Returns cached data if available and not stale
   */
  async fetchPlatformSnapshots(
    intervalHours: bigint = 1n,
    limit: bigint = 168n
  ): Promise<PlatformSnapshotsResponse | null> {
    const cacheKey = `${intervalHours}:${limit}`;
    const cached = this.chartCache.get(cacheKey);

    // Return cached if fresh
    if (cached && Date.now() - cached.fetchedAt < CHART_CACHE_TTL) {
      return cached.data;
    }

    this.isLoadingChart = true;

    try {
      const actor = await this.getActor();
      if (!actor) {
        console.error('[PlatformState] No indexer actor available');
        return null;
      }

      const result = await actor.get_platform_snapshots([], limit, intervalHours);

      // Cache the result
      this.chartCache.set(cacheKey, {
        data: result,
        fetchedAt: Date.now(),
      });

      return result;
    } catch (error) {
      console.error('[PlatformState] Failed to fetch platform snapshots:', error);
      return null;
    } finally {
      this.isLoadingChart = false;
    }
  }

  // ============================================
  // Polling
  // ============================================

  /**
   * Start automatic polling for stats
   */
  startPolling(): void {
    if (this.isPolling) return;

    this.isPolling = true;

    // Immediate fetch
    this.fetchStats(true);

    // Set up interval
    this.pollTimer = setInterval(() => {
      this.fetchStats(true);
    }, STATS_POLL_INTERVAL);
  }

  /**
   * Stop automatic polling
   */
  stopPolling(): void {
    if (!this.isPolling) return;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.isPolling = false;
  }

  // ============================================
  // Cache Management
  // ============================================

  /**
   * Clear chart cache
   */
  clearChartCache(): void {
    this.chartCache.clear();
  }

  /**
   * Invalidate and refetch
   */
  async refresh(): Promise<void> {
    this.chartCache.clear();
    await this.fetchStats(true);
  }

  // ============================================
  // Private Helpers
  // ============================================

  private async getActor() {
    // Access the indexer actor via the repository's internal method
    // This maintains the pattern where repositories own actor access
    const { api } = await import('$lib/actors/api.svelte');
    return api.indexer;
  }
}

// ============================================
// Singleton Export
// ============================================

export const platformState = new PlatformStateCoordinator();

// Development helper
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).platformState = platformState;
}
