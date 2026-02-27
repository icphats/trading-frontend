<script lang="ts">
  import { onMount } from 'svelte';
  import { platformState } from '$lib/domain/platform';
  import { formatToken } from '$lib/utils/format.utils';
  import PlatformChart from '$lib/components/stats/PlatformChart.svelte';

  // Fetch platform stats on mount
  onMount(() => {
    platformState.fetchStats();
  });

  // Format helpers
  function formatE6(value: bigint): string {
    return '$' + formatToken({ value, unitName: 6, short: true });
  }

  function formatCount(value: bigint): string {
    const num = Number(value);
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toLocaleString();
  }

  function formatPercentBps(bps: bigint | number): string {
    const percent = Number(bps) / 100;
    const sign = percent >= 0 ? '+' : '';
    return sign + percent.toFixed(2) + '%';
  }
</script>

<div class="platform-stats">
  <!-- Key Metrics Grid -->
  <section class="metrics-section">
    <h2 class="section-title">Key Metrics</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-label">Total Value Locked</span>
        <span class="metric-value">
          {platformState.hasData ? formatE6(platformState.tvl) : '—'}
        </span>
        {#if platformState.hasData}
          <span class="metric-change" class:positive={Number(platformState.tvlChange24h) >= 0} class:negative={Number(platformState.tvlChange24h) < 0}>
            {formatPercentBps(platformState.tvlChange24h)} (24h)
          </span>
        {/if}
      </div>

      <div class="metric-card">
        <span class="metric-label">24h Volume</span>
        <span class="metric-value">
          {platformState.hasData ? formatE6(platformState.volume24h) : '—'}
        </span>
        {#if platformState.hasData}
          <span class="metric-change" class:positive={Number(platformState.volumeChange24h) >= 0} class:negative={Number(platformState.volumeChange24h) < 0}>
            {formatPercentBps(platformState.volumeChange24h)} (24h)
          </span>
        {/if}
      </div>

      <div class="metric-card">
        <span class="metric-label">All-Time Volume</span>
        <span class="metric-value">
          {platformState.hasData ? formatE6(platformState.totalVolumeCumulative) : '—'}
        </span>
        <span class="metric-sublabel">Pool + Order Book</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">24h Fees</span>
        <span class="metric-value">
          {platformState.hasData ? formatE6(platformState.totalFees24h) : '—'}
        </span>
        <span class="metric-sublabel">Pool + Book</span>
      </div>
    </div>
  </section>

  <!-- TVL Decomposition -->
  <section class="metrics-section">
    <h2 class="section-title">TVL Breakdown</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-label">Pool Reserves</span>
        <span class="metric-value">
          {platformState.hasData ? formatE6(platformState.poolReserve) : '—'}
        </span>
        <span class="metric-sublabel">Liquidity pools</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Book Open Interest</span>
        <span class="metric-value">
          {platformState.hasData ? formatE6(platformState.bookOpenInterest) : '—'}
        </span>
        <span class="metric-sublabel">Limit orders</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Trigger Locked</span>
        <span class="metric-value">
          {platformState.hasData ? formatE6(platformState.triggerLocked) : '—'}
        </span>
        <span class="metric-sublabel">Stop/take-profit</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Active Pools</span>
        <span class="metric-value">
          {platformState.hasData ? platformState.activePools : '—'}
        </span>
        <span class="metric-sublabel">{platformState.hasData ? platformState.activeMarkets : '—'} markets</span>
      </div>
    </div>
  </section>

  <!-- Fee Metrics -->
  <section class="metrics-section">
    <h2 class="section-title">Fee Revenue</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-label">24h Pool Fees</span>
        <span class="metric-value">
          {platformState.hasData ? formatE6(platformState.poolFees24h) : '—'}
        </span>
        <span class="metric-sublabel">LP earnings</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">24h Book Fees</span>
        <span class="metric-value">
          {platformState.hasData ? formatE6(platformState.bookFees24h) : '—'}
        </span>
        <span class="metric-sublabel">Protocol revenue</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Total 24h Fees</span>
        <span class="metric-value">
          {platformState.hasData ? formatE6(platformState.totalFees24h) : '—'}
        </span>
        <span class="metric-sublabel">Combined</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Total Transactions</span>
        <span class="metric-value">
          {platformState.hasData ? formatCount(platformState.totalTransactions) : '—'}
        </span>
        <span class="metric-sublabel">All-time trades</span>
      </div>
    </div>
  </section>

  <!-- Entity Counts -->
  <section class="metrics-section">
    <h2 class="section-title">Open Entities</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-label">Live Orders</span>
        <span class="metric-value">
          {platformState.hasData ? formatCount(BigInt(platformState.ordersLive)) : '—'}
        </span>
        <span class="metric-sublabel">Limit orders</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Live Triggers</span>
        <span class="metric-value">
          {platformState.hasData ? formatCount(BigInt(platformState.triggersLive)) : '—'}
        </span>
        <span class="metric-sublabel">Stop/take-profit</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">LP Positions</span>
        <span class="metric-value">
          {platformState.hasData ? formatCount(BigInt(platformState.totalPositions)) : '—'}
        </span>
        <span class="metric-sublabel">Across all pools</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Active Pools</span>
        <span class="metric-value">
          {platformState.hasData ? platformState.activePools : '—'}
        </span>
        <span class="metric-sublabel">{platformState.hasData ? platformState.activeMarkets : '—'} markets</span>
      </div>
    </div>
  </section>

  <!-- Charts Section -->
  <section class="charts-section">
    <h2 class="section-title">Historical Data</h2>
    <PlatformChart />
  </section>
</div>

<style>
  .platform-stats {
    width: 100%;
  }

  /* Sections */
  .metrics-section,
  .charts-section {
    margin-bottom: 48px;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--foreground);
    margin: 0 0 24px 0;
  }

  /* Metrics Grid */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  @media (max-width: 1024px) {
    .metrics-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 640px) {
    .metrics-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Metric Card */
  .metric-card {
    background-color: var(--muted);
    border-radius: 20px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 12px;
    min-height: 140px;
    background-image: radial-gradient(
      oklch(from var(--muted-foreground) l c h / 0.2) 0.5px,
      transparent 0
    );
    background-size: 12px 12px;
    background-position: -8.5px -8.5px;
  }

  .metric-label {
    font-size: 1rem;
    color: var(--muted-foreground);
    font-weight: 500;
    line-height: 1.4;
  }

  .metric-value {
    font-size: 2rem;
    font-weight: 500;
    color: var(--foreground);
    line-height: 1;
    font-variant-numeric: lining-nums tabular-nums;
  }

  .metric-change {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .metric-change.positive {
    color: var(--color-bullish);
  }

  .metric-change.negative {
    color: var(--color-bearish);
  }

  .metric-sublabel {
    font-size: 0.875rem;
    color: var(--muted-foreground);
    opacity: 0.8;
  }

  @media (max-width: 1024px) {
    .metric-card {
      min-height: 120px;
      padding: 20px;
    }

    .metric-label {
      font-size: 0.875rem;
    }

    .metric-value {
      font-size: 1.75rem;
    }
  }

  @media (max-width: 640px) {
    .metric-card {
      min-height: 100px;
      padding: 16px;
    }

    .metric-value {
      font-size: 1.5rem;
    }
  }

</style>
