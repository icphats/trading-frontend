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

  type MetricType = 'tvl' | 'volume' | 'transactions';

  // ============================================
  // Configuration
  // ============================================

  const METRIC_CONFIG: Record<MetricType, { label: string }> = {
    tvl: { label: 'TVL' },
    volume: { label: 'Volume' },
    transactions: { label: 'Txns' },
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

    return result.data
      .map((point: PlatformSnapshotView) => {
        let value: number;

        switch (selectedMetric) {
          case 'tvl':
            value = Number(point.tvl_usd_e6) / 1_000_000;
            break;
          case 'volume':
            value = Number(point.volume_usd_e6) / 1_000_000;
            break;
          case 'transactions':
            value = Number(point.transactions);
            break;
        }

        return {
          timestamp: Math.floor(Number(point.timestamp) / 1000), // Convert ms to seconds for chart
          value,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  // ============================================
  // Formatters
  // ============================================

  function formatDisplayValue(value: number): string {
    if (selectedMetric === 'transactions') {
      return formatCompact(value);
    }
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
  // Using the metric string directly as the key instead of an incrementing counter
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
  />
{/snippet}

{#key fetchKey}
  <TimeSeriesChart
    {fetchData}
    valuePrefix={selectedMetric === 'transactions' ? '' : '$'}
    formatValue={formatDisplayValue}
    getTooltip={selectedMetric === 'volume' ? getVolumeTooltip : undefined}
    rightControls={metricControls}
  />
{/key}
