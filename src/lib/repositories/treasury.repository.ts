/**
 * Treasury Repository
 *
 * Data access layer for treasury canister data.
 * - Uses actor from centralized api.svelte.ts
 * - Implements L1 memory cache with TTL
 * - Transforms canister responses to DataPoint[] format
 *
 * Per 03-DataFlow.md:
 * - Repository handles fetch, cache, and transform
 * - Domain is unaware of caching strategy
 * - Actors are managed centrally, not by repositories
 */

import { api } from '$lib/actors/api.svelte';
import type {
  Snapshot,
  SnapshotView,
  SnapshotsResponse,
  RegisteredCanisterInfo,
} from 'declarations/treasury/treasury.did';
import { MemoryCache } from './cache';
import { cacheCleanupManager } from './shared/cleanup';
import type { Result } from './shared/result';
import type { TimeInterval } from '$lib/components/ui/charts/core/chart.constants';

// Re-export types for consumers
export type { Snapshot, SnapshotView, SnapshotsResponse, RegisteredCanisterInfo };

// ============================================
// Types
// ============================================

/**
 * DataPoint format expected by TimeSeriesChart
 */
export interface DataPoint {
  timestamp: number; // Unix seconds
  value: number;
}

/**
 * Metrics available for chart display.
 * Backend now returns per-day deltas (not cumulative).
 * Note: fees_usd_e6 is computed by summing 3 market-type fee fields.
 */
export type TreasuryMetric =
  | 'fees_icp'
  | 'fees_usd_e6'
  | 'cycles_out'
  | 'cycles_expense_usd_e6';

/**
 * Treasury statement - snapshot view data for financial display.
 * Stocks are point-in-time, flows are per-day deltas.
 * All USD fields use _e6 precision to match backend.
 */
export interface TreasuryStatement {
  timestamp: bigint;
  day_index: number;
  // Stocks
  icp_usd_rate_e12: bigint;
  icp_balance: bigint;
  cycles_balance: bigint;
  icp_fair_value_usd_e6: bigint;
  icp_cost_basis_usd_e6: bigint;
  cycles_cost_basis_usd_e6: bigint;
  unrealized_gain_loss_e6: bigint;
  // Flows (deltas)
  fees_icp: bigint;
  fees_usd_e6: bigint;
  cycles_out: bigint;
  cycles_expense_usd_e6: bigint;
  realized_gain_loss_e6: bigint;
  buyback_usd_e6: bigint;
  party_burned: bigint;
}

// ============================================
// Configuration
// ============================================

const CACHE_TTL_MS = 300_000; // 5 minutes

// ============================================
// Treasury Repository Class
// ============================================

export class TreasuryRepository {
  private cache = new MemoryCache<DataPoint[]>();
  private statementCache = new MemoryCache<TreasuryStatement>();

  // ============================================
  // Data Fetching
  // ============================================

  /**
   * Fetch treasury snapshots for a given time interval.
   * Returns data transformed to DataPoint[] format for TimeSeriesChart.
   *
   * Implements cache transparency - callers don't know if data came from cache.
   *
   * @param interval - Time interval ('1D', '1W', '1M', '1Y')
   * @param metric - Which metric to extract
   */
  async fetchSnapshots(
    interval: TimeInterval,
    metric: TreasuryMetric = 'fees_icp'
  ): Promise<Result<DataPoint[]>> {
    const cacheKey = `${interval}:${metric}`;

    // Check cache first (cache transparency)
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ok: cached };
    }

    // Get actor from centralized api (initialized in api.initPublic)
    const actor = api.treasury;
    if (!actor) {
      return { err: 'treasury not initialized - call api.initPublic() first' };
    }

    try {
      // Determine limit based on interval
      const limit = this.getLimitForInterval(interval);

      // Fetch snapshots
      const response: SnapshotsResponse = await actor.get_snapshots(
        [], // before_timestamp: null = from latest
        BigInt(limit),
      );

      // Transform to DataPoint[]
      const dataPoints = this.transformSnapshots(response.data, metric);

      // Cache the result
      this.cache.set(cacheKey, dataPoints, CACHE_TTL_MS);

      return { ok: dataPoints };
    } catch (error) {
      console.error('[TreasuryRepository] Failed to fetch snapshots:', error);
      return { err: error instanceof Error ? error.message : 'Unknown error' };
    }
  }


  /**
   * Fetch treasury statement - current state or historical snapshot.
   * Used for displaying financial tables in frontend.
   *
   * @param dayIndex - Optional day index. null = current live state
   */
  async fetchStatement(dayIndex?: number): Promise<Result<TreasuryStatement>> {
    const cacheKey = dayIndex !== undefined ? `statement:day:${dayIndex}` : 'statement:current';

    // Check cache first
    const cached = this.statementCache.get(cacheKey);
    if (cached) {
      return { ok: cached };
    }

    const actor = api.treasury;
    if (!actor) {
      return { err: 'treasury not initialized - call api.initPublic() first' };
    }

    try {
      const dayIndexOpt: [] | [number] = dayIndex !== undefined ? [dayIndex] : [];

      const snapshotOpt = await actor.get_snapshot(dayIndexOpt);

      // Handle nullable return (snapshot might not exist)
      if (snapshotOpt.length === 0) {
        return { err: dayIndex !== undefined
          ? `Snapshot for day index ${dayIndex} not found`
          : 'No snapshot data available'
        };
      }

      const snapshot = snapshotOpt[0];

      // get_snapshot returns raw Snapshot (cumulative). Map to statement format.
      // These are cumulative totals from the raw snapshot — not deltas.
      const fees_usd_e6 =
        snapshot.fees_from_ckusdc_markets_usd_e6 +
        snapshot.fees_from_ckusdt_markets_usd_e6 +
        snapshot.fees_from_icp_markets_usd_e6;

      const statement: TreasuryStatement = {
        timestamp: snapshot.timestamp,
        day_index: snapshot.day_index,
        // Stocks
        icp_usd_rate_e12: snapshot.icp_usd_rate_e12,
        icp_balance: snapshot.icp_balance,
        cycles_balance: snapshot.cycles_balance,
        icp_fair_value_usd_e6: snapshot.icp_fair_value_usd_e6,
        icp_cost_basis_usd_e6: snapshot.icp_cost_basis_usd_e6,
        cycles_cost_basis_usd_e6: snapshot.cycles_cost_basis_usd_e6,
        unrealized_gain_loss_e6: snapshot.unrealized_gain_loss_e6,
        // Flows (cumulative totals from raw snapshot — not per-day deltas)
        fees_icp: snapshot.cumulative_fees_icp,
        fees_usd_e6,
        cycles_out: snapshot.cumulative_cycles_out,
        cycles_expense_usd_e6: snapshot.cumulative_cycles_expense_usd_e6,
        realized_gain_loss_e6: snapshot.cumulative_realized_gain_loss_e6,
        buyback_usd_e6: snapshot.cumulative_buyback_usd_e6,
        party_burned: snapshot.cumulative_party_burned,
      };

      // Cache for 1 minute (statement changes less frequently)
      this.statementCache.set(cacheKey, statement, 60_000);

      return { ok: statement };
    } catch (error) {
      console.error('[TreasuryRepository] Failed to fetch statement:', error);
      return { err: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ============================================
  // Private Helpers
  // ============================================


  /**
   * Get appropriate limit based on interval (nat32 = number)
   */
  private getLimitForInterval(interval: TimeInterval): number {
    switch (interval) {
      case '1D': return 24;
      case '1W': return 7;
      case '1M': return 30;
      case '1Y': return 365;
      default: return 500;
    }
  }

  // ============================================
  // Data Transformation
  // ============================================

  /**
   * Transform SnapshotView[] to DataPoint[].
   * For fees_usd_e6, sums the three market-type fee fields.
   */
  private transformSnapshots(
    snapshots: SnapshotView[],
    metric: TreasuryMetric
  ): DataPoint[] {
    return snapshots
      .map((snapshot) => ({
        // Convert ms to seconds for chart library
        timestamp: Math.floor(Number(snapshot.timestamp) / 1000),
        // Extract the requested metric as a number
        value: this.extractMetric(snapshot, metric),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Extract a metric value from a snapshot view.
   * Handles the aggregate fees USD case by summing three fields.
   */
  private extractMetric(snapshot: SnapshotView, metric: TreasuryMetric): number {
    switch (metric) {
      case 'fees_icp':
        return Number(snapshot.fees_icp);
      case 'fees_usd_e6':
        return Number(
          snapshot.fees_from_ckusdc_markets_usd_e6 +
          snapshot.fees_from_ckusdt_markets_usd_e6 +
          snapshot.fees_from_icp_markets_usd_e6
        );
      case 'cycles_out':
        return Number(snapshot.cycles_out);
      case 'cycles_expense_usd_e6':
        return Number(snapshot.cycles_expense_usd_e6);
    }
  }

  // ============================================
  // Cache Management
  // ============================================

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.statementCache.clear();
  }

  /**
   * Invalidate cache for specific interval/metric combination
   */
  invalidateCache(interval: TimeInterval, metric: TreasuryMetric): void {
    this.cache.invalidate(`${interval}:${metric}`);
  }

  /**
   * Prune expired cache entries
   */
  pruneExpiredCaches(): void {
    this.cache.prune();
    this.statementCache.prune();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}

// ============================================
// Singleton Export
// ============================================

export const treasuryRepository = new TreasuryRepository();

// Register with centralized cleanup manager
cacheCleanupManager.register(() => treasuryRepository.pruneExpiredCaches());
