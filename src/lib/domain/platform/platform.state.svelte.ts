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

  /** Historical snapshot for % change computation */
  private changeSnapshot = $state<PlatformSnapshotView | null>(null);
  /** Whether we got a full 30d snapshot or fell back to oldest available */
  private changeSnapshotIs30d = $state(false);

  /** TVL change (basis points), computed from snapshot */
  tvlChange30d = $derived.by(() => {
    if (!this.stats || !this.changeSnapshot) return 0;
    const current = Number(this.stats.total_tvl_usd_e6);
    const past = Number(this.changeSnapshot.tvl_usd_e6);
    if (past === 0) return 0;
    return Math.round(((current - past) / past) * 10_000);
  });

  /** Label for the change period (e.g. "30d" or "7d") */
  tvlChangeLabel = $derived.by(() => {
    if (!this.changeSnapshot) return '';
    if (this.changeSnapshotIs30d) return '30d';
    // Compute actual days from snapshot timestamp
    const snapshotMs = Number(this.changeSnapshot.timestamp);
    const days = Math.round((Date.now() - snapshotMs) / (24 * 3600 * 1000));
    if (days < 1) return '<1d';
    return `${days}d`;
  });

  /** Volume over the change period (USD E6) */
  volume30d = $derived(this.changeSnapshot ? this.changeSnapshot.volume_usd_e6 : 0n);

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

  /** User counts */
  totalUsers = $derived(this.stats?.total_users ?? 0);
  totalUserMarketPairs = $derived(this.stats?.total_user_market_pairs ?? 0);

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

      // Fetch snapshot from ~30 days ago for % change
      if (!this.changeSnapshot) {
        const thirtyDaysMs = BigInt(30 * 24 * 3600 * 1000);
        const beforeTs = BigInt(Date.now()) - thirtyDaysMs;

        // Try fetching a 1h bar from ~30 days ago
        let snapshots = await this.fetchPlatformSnapshots(1n, 1n, beforeTs);
        let is30d = true;

        // Fallback for platforms younger than 30 days: fetch all hourly bars, take the oldest
        if (!snapshots?.data?.length && this.stats && this.stats.snapshot_count > 1n) {
          snapshots = await this.fetchPlatformSnapshots(1n, this.stats.snapshot_count);
          is30d = false;
        }

        if (snapshots?.data?.length) {
          // Use the first element (oldest bar, since results are oldest-first)
          this.changeSnapshot = snapshots.data[0];
          this.changeSnapshotIs30d = is30d;
        }
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
    limit: bigint = 168n,
    beforeTimestamp?: bigint
  ): Promise<PlatformSnapshotsResponse | null> {
    const cacheKey = `${intervalHours}:${limit}:${beforeTimestamp ?? 'latest'}`;
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

      const cursor: [] | [bigint] = beforeTimestamp !== undefined ? [beforeTimestamp] : [];
      const result = await actor.get_platform_snapshots(cursor, limit, intervalHours);

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
