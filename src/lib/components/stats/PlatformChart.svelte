<script lang="ts">
  import TimeSeriesChart from '$lib/components/ui/charts/presets/TimeSeriesChart.svelte';
  import ChartToggle from '$lib/components/ui/charts/primitives/ChartToggle.svelte';

  import { formatVolumeRaw, formatCompact } from '$lib/components/ui/charts/core/chart.format';
  import { platformState } from '$lib/domain/platform';
  import type { PlatformSnapshotView } from '$lib/domain/platform';
  import type { TimeInterval } from '$lib/components/ui/charts/core/chart.constants';

  // ============================================
  // Types
  // ============================================

  type MetricType =
    | 'tvl'
    | 'volume'
    | 'transactions'
    | 'pool_reserve'
    | 'book_oi'
    | 'trigger_locked'
    | 'pool_fees'
    | 'book_fees'
    | 'orders'
    | 'triggers'
    | 'positions'
    | 'trading_balance'
    | 'users'
    | 'user_markets';

  type MetricFormat = 'usd' | 'count';

  interface MetricConfig {
    label: string;
    format: MetricFormat;
    extract: (point: PlatformSnapshotView) => number;
  }

  // ============================================
  // Configuration
  // ============================================

  const METRIC_CONFIG: Record<MetricType, MetricConfig> = {
    tvl:            { label: 'TVL',             format: 'usd',   extract: (p) => Number(p.tvl_usd_e6) / 1_000_000 },
    volume:         { label: 'Volume',          format: 'usd',   extract: (p) => Number(p.volume_usd_e6) / 1_000_000 },
    transactions:   { label: 'Txns',            format: 'count', extract: (p) => Number(p.transactions) },
    pool_reserve:   { label: 'Pool Reserves',   format: 'usd',   extract: (p) => Number(p.pool_reserve_usd_e6) / 1_000_000 },
    book_oi:        { label: 'Book OI',         format: 'usd',   extract: (p) => Number(p.book_open_interest_usd_e6) / 1_000_000 },
    trigger_locked: { label: 'Trigger Locked',  format: 'usd',   extract: (p) => Number(p.trigger_locked_usd_e6) / 1_000_000 },
    trading_balance:{ label: 'Trading Bal.',   format: 'usd',   extract: (p) => Number(p.tvl_usd_e6 - p.pool_reserve_usd_e6 - p.book_open_interest_usd_e6 - p.trigger_locked_usd_e6) / 1_000_000 },
    pool_fees:      { label: 'Pool Fees',       format: 'usd',   extract: (p) => Number(p.pool_fees_usd_e6) / 1_000_000 },
    book_fees:      { label: 'Book Fees',       format: 'usd',   extract: (p) => Number(p.book_fees_usd_e6) / 1_000_000 },
    orders:         { label: 'Orders',          format: 'count', extract: (p) => p.orders_live },
    triggers:       { label: 'Triggers',        format: 'count', extract: (p) => p.triggers_live },
    positions:      { label: 'LP Positions',    format: 'count', extract: (p) => p.total_positions },
    users:          { label: 'Users',           format: 'count', extract: (p) => p.total_users },
    user_markets:   { label: 'User×Markets',    format: 'count', extract: (p) => p.total_user_market_pairs },
  };

  // Map TimeSeriesChart intervals to interval_hours and limit
  const INTERVAL_CONFIG: Record<TimeInterval, { intervalHours: bigint; limit: bigint }> = {
    '1D': { intervalHours: 1n, limit: 24n },
    '1W': { intervalHours: 1n, limit: 168n },
    '1M': { intervalHours: 24n, limit: 30n },
    '1Y': { intervalHours: 168n, limit: 52n },
  };

  // ============================================
  // State
  // ============================================

  let selectedMetric = $state<MetricType>('tvl');

  // Store raw snapshot data points for tooltip lookups (fees by timestamp)
  let rawDataPoints = $state<PlatformSnapshotView[]>([]);

  // ============================================
  // Data Fetching
  // ============================================

  async function fetchData(interval: TimeInterval): Promise<{ timestamp: number; value: number }[]> {
    const config = INTERVAL_CONFIG[interval];

    const result = await platformState.fetchPlatformSnapshots(config.intervalHours, config.limit);

    if (!result || !result.data) {
      rawDataPoints = [];
      return [];
    }

    // Store raw data for tooltip lookups
    rawDataPoints = result.data;

    const metric = METRIC_CONFIG[selectedMetric];

    return result.data
      .map((point: PlatformSnapshotView) => ({
        timestamp: Math.floor(Number(point.timestamp) / 1000),
        value: metric.extract(point),
      }))
      .sort((a: { timestamp: number }, b: { timestamp: number }) => a.timestamp - b.timestamp);
  }

  // ============================================
  // Formatters
  // ============================================

  const currentFormat = $derived(METRIC_CONFIG[selectedMetric].format);

  function formatDisplayValue(value: number): string {
    if (currentFormat === 'count') return formatCompact(value);
    return formatVolumeRaw(value);
  }

  // Tooltip for volume bars: show fees on hover
  function getVolumeTooltip(timestamp: number): { label: string; value: string } | null {
    const point = rawDataPoints.find(
      (d) => Math.floor(Number(d.timestamp) / 1000) === timestamp
    );
    if (!point) return null;
    const fees = (Number(point.pool_fees_usd_e6) + Number(point.book_fees_usd_e6)) / 1_000_000;
    return { label: 'Fees', value: formatVolumeRaw(fees) };
  }

  // Derive a key from the metric to force re-render when metric changes
  const fetchKey = $derived(selectedMetric);
</script>

{#snippet metricControls()}
  <ChartToggle
    options={Object.entries(METRIC_CONFIG).map(([key, config]) => ({
      value: key,
      label: config.label,
    }))}
    bind:value={selectedMetric}
    ariaLabel="Metric type"
    maxInline={6}
    dropup
  />
{/snippet}

{#key fetchKey}
  <TimeSeriesChart
    {fetchData}
    valuePrefix={currentFormat === 'usd' ? '$' : ''}
    formatValue={formatDisplayValue}
    getTooltip={selectedMetric === 'volume' ? getVolumeTooltip : undefined}
    rightControls={metricControls}
  />
{/key}
