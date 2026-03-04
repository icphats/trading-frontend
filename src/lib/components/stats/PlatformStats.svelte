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

  // All-time cumulative fees
  const totalFeesCumulative = $derived(
    (platformState.stats?.pool_fees_cumulative_usd_e6 ?? 0n) + (platformState.stats?.book_fees_cumulative_usd_e6 ?? 0n)
  );

  // Trading balance = TVL - pool reserves - book OI - trigger locked
  const tradingBalance = $derived(
    BigInt(platformState.tvl) - BigInt(platformState.poolReserve) - BigInt(platformState.bookOpenInterest) - BigInt(platformState.triggerLocked)
  );
</script>

<div class="platform-stats">
  <!-- Overview -->
  <section class="metrics-section">
    <h2 class="section-title">Overview</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-label">Total Value Locked</span>
        <span class="metric-value">{platformState.hasData ? formatE6(platformState.tvl) : '—'}</span>
        {#if platformState.hasData && platformState.tvlChange30d !== 0}
          <span class="metric-change" class:positive={platformState.tvlChange30d >= 0} class:negative={platformState.tvlChange30d < 0}>
            {formatPercentBps(platformState.tvlChange30d)} ({platformState.tvlChangeLabel})
          </span>
        {/if}
      </div>

      <div class="metric-card">
        <span class="metric-label">24h Volume</span>
        <span class="metric-value">{platformState.hasData ? formatE6(platformState.volume24h) : '—'}</span>
        <span class="metric-sublabel">Trading activity</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">24h Fees</span>
        <span class="metric-value">{platformState.hasData ? formatE6(platformState.totalFees24h) : '—'}</span>
        <span class="metric-sublabel">Pool + Book</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Users</span>
        <span class="metric-value">{platformState.hasData ? formatCount(BigInt(platformState.totalUsers)) : '—'}</span>
        <span class="metric-sublabel">Active wallets</span>
      </div>
    </div>
  </section>

  <!-- TVL Breakdown -->
  <section class="metrics-section">
    <h2 class="section-title">TVL Breakdown</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-label">Pool Reserves</span>
        <span class="metric-value">{platformState.hasData ? formatE6(platformState.poolReserve) : '—'}</span>
        <span class="metric-sublabel">Liquidity pools</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Book Open Interest</span>
        <span class="metric-value">{platformState.hasData ? formatE6(platformState.bookOpenInterest) : '—'}</span>
        <span class="metric-sublabel">Limit orders</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Trigger Locked</span>
        <span class="metric-value">{platformState.hasData ? formatE6(platformState.triggerLocked) : '—'}</span>
        <span class="metric-sublabel">Stop/take-profit</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Trading Balances</span>
        <span class="metric-value">{platformState.hasData ? formatE6(tradingBalance) : '—'}</span>
        <span class="metric-sublabel">Idle user funds</span>
      </div>
    </div>
  </section>

  <!-- Activity -->
  <section class="metrics-section">
    <h2 class="section-title">Activity</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-label">All-Time Volume</span>
        <span class="metric-value">{platformState.hasData ? formatE6(platformState.totalVolumeCumulative) : '—'}</span>
        <span class="metric-sublabel">Pool + Book</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">All-Time Fees</span>
        <span class="metric-value">{platformState.hasData ? formatE6(totalFeesCumulative) : '—'}</span>
        <span class="metric-sublabel">Pool + Book</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Total Transactions</span>
        <span class="metric-value">{platformState.hasData ? formatCount(platformState.totalTransactions) : '—'}</span>
        <span class="metric-sublabel">All-time</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">User × Markets</span>
        <span class="metric-value">{platformState.hasData ? formatCount(BigInt(platformState.totalUserMarketPairs)) : '—'}</span>
        <span class="metric-sublabel">Total market memberships</span>
      </div>
    </div>
  </section>

  <!-- Live Entities -->
  <section class="metrics-section">
    <h2 class="section-title">Live Entities</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-label">Markets</span>
        <span class="metric-value">{platformState.hasData ? platformState.activeMarkets : '—'}</span>
        <span class="metric-sublabel">Active</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Pools</span>
        <span class="metric-value">{platformState.hasData ? platformState.activePools : '—'}</span>
        <span class="metric-sublabel">Active</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Orders</span>
        <span class="metric-value">{platformState.hasData ? formatCount(BigInt(platformState.ordersLive)) : '—'}</span>
        <span class="metric-sublabel">Limit orders</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Triggers</span>
        <span class="metric-value">{platformState.hasData ? formatCount(BigInt(platformState.triggersLive)) : '—'}</span>
        <span class="metric-sublabel">Stop/take-profit</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">LP Positions</span>
        <span class="metric-value">{platformState.hasData ? formatCount(BigInt(platformState.totalPositions)) : '—'}</span>
        <span class="metric-sublabel">Across all pools</span>
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
