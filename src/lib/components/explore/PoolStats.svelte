<script lang="ts">
  import Logo from '$lib/components/ui/Logo.svelte';

  interface PoolBalance {
    symbol: string;
    logo?: string;
    amount: number;
    valueUsd: number;
  }

  interface Props {
    tvl?: number | null;
    volume24h?: number | null;
    fees24h?: number | null;
    token0Balance?: PoolBalance | null;
    token1Balance?: PoolBalance | null;
    isLoading?: boolean;
  }

  let {
    tvl = null,
    volume24h = null,
    fees24h = null,
    token0Balance = null,
    token1Balance = null,
    isLoading = false
  }: Props = $props();

  // Calculate balance percentages for the visual bar
  const totalValueUsd = $derived(
    (token0Balance?.valueUsd ?? 0) + (token1Balance?.valueUsd ?? 0)
  );
  const token0Percent = $derived(
    totalValueUsd > 0 ? ((token0Balance?.valueUsd ?? 0) / totalValueUsd) * 100 : 50
  );
  const token1Percent = $derived(100 - token0Percent);

  // Format helpers
  function formatLargeNumber(num: number | null | undefined): string {
    if (num === null || num === undefined) return '—';
    if (num === 0) return '$0';
    if (num >= 1_000_000_000) {
      return `$${(num / 1_000_000_000).toFixed(2)}B`;
    } else if (num >= 1_000_000) {
      return `$${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `$${(num / 1_000).toFixed(2)}K`;
    }
    return `$${num.toFixed(2)}`;
  }

  function formatTokenAmount(num: number | null | undefined): string {
    if (num === null || num === undefined) return '—';
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(2)}K`;
    }
    return num.toFixed(2);
  }
</script>

<div class="pool-stats">
  <h2 class="stats-title">Stats</h2>

  {#if isLoading}
    <div class="stats-skeleton">
      {#each Array(4) as _}
        <div class="skeleton-item">
          <div class="skeleton-label"></div>
          <div class="skeleton-value"></div>
        </div>
      {/each}
    </div>
  {:else}
    <!-- Pool Balances Section (if available) -->
    {#if token0Balance && token1Balance}
      <div class="balances-section">
        <span class="stat-label">Pool Balances</span>
        <div class="balances-row">
          <div class="balance-item">
            <Logo src={token0Balance.logo} alt={token0Balance.symbol} size="xxs" />
            <span class="balance-amount">{formatTokenAmount(token0Balance.amount)}</span>
            <span class="balance-symbol">{token0Balance.symbol}</span>
          </div>
          <div class="balance-item">
            <Logo src={token1Balance.logo} alt={token1Balance.symbol} size="xxs" />
            <span class="balance-amount">{formatTokenAmount(token1Balance.amount)}</span>
            <span class="balance-symbol">{token1Balance.symbol}</span>
          </div>
        </div>
        <!-- Balance Bar -->
        <div class="balance-bar">
          <div
            class="balance-bar-segment token0"
            style="width: {token0Percent}%"
          ></div>
          <div
            class="balance-bar-segment token1"
            style="width: {token1Percent}%"
          ></div>
        </div>
      </div>
    {/if}

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-item">
        <span class="stat-label">TVL</span>
        <span class="stat-value">{formatLargeNumber(tvl)}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">24H Volume</span>
        <span class="stat-value">{formatLargeNumber(volume24h)}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">24H Fees</span>
        <span class="stat-value">{formatLargeNumber(fees24h)}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .pool-stats {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 20px;
    border-radius: 20px;
    background: var(--muted);
  }

  .stats-title {
    font-family: 'Basel', sans-serif;
    font-size: 22px;
    line-height: 28px;
    font-weight: 500;
    color: var(--foreground);
    margin: 0;
  }

  /* Balances Section */
  .balances-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }

  .balances-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }

  .balance-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .balance-amount {
    font-family: 'Basel', sans-serif;
    font-size: 20px;
    line-height: 28px;
    font-weight: 485;
    color: var(--foreground);
  }

  .balance-symbol {
    font-family: 'Basel', sans-serif;
    font-size: 20px;
    line-height: 28px;
    font-weight: 485;
    color: var(--muted-foreground);
  }

  /* Balance Bar */
  .balance-bar {
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
  }

  .balance-bar-segment {
    height: 100%;
    transition: width 300ms ease-out;
  }

  .balance-bar-segment.token0 {
    background: var(--primary);
    border-top-left-radius: 4px;
    border-bottom-left-radius: 4px;
  }

  .balance-bar-segment.token1 {
    background: var(--muted-foreground);
    border-top-right-radius: 4px;
    border-bottom-right-radius: 4px;
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .stat-label {
    font-family: 'Basel', sans-serif;
    font-size: 15px;
    line-height: 19.5px;
    font-weight: 485;
    color: var(--muted-foreground);
  }

  .stat-value {
    font-family: 'Basel', sans-serif;
    font-size: 36px;
    line-height: 44px;
    font-weight: 485;
    color: var(--foreground);
  }

  /* Loading skeleton */
  .stats-skeleton {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
  }

  .skeleton-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .skeleton-label {
    width: 80px;
    height: 20px;
    border-radius: 6px;
    background: var(--muted);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-value {
    width: 120px;
    height: 36px;
    border-radius: 8px;
    background: var(--muted);
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .pool-stats {
      padding: 16px;
      gap: 20px;
    }

    .stats-grid {
      gap: 16px;
    }

    .stat-value {
      font-size: 28px;
      line-height: 36px;
    }

    .balances-row {
      flex-direction: column;
      gap: 12px;
    }
  }
</style>
