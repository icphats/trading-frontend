<script lang="ts">
  import { formatUSD } from '$lib/utils/format.utils';
  import TokenPairLogo from '$lib/components/ui/TokenPairLogo.svelte';
  import { ticker } from '$lib/domain/orchestration/ticker-action';
  import type { PortfolioPool } from '$lib/domain/user/user-portfolio.svelte';

  interface Props {
    pools?: PortfolioPool[];
    isLoading?: boolean;
  }

  let { pools = [], isLoading = false }: Props = $props();

  const totalValue = $derived(pools.reduce((sum, p) => sum + p.valueUsd, 0));
  const poolCount = $derived(pools.length);

</script>

<div class="mini-table">
  <div class="table-header">
    <h3 class="table-title">Pool Positions</h3>
    <span class="count">{poolCount} positions</span>
  </div>

  <div class="table-content">
    {#if isLoading}
      {#each Array(3) as _}
        <div class="skeleton-row">
          <div class="skeleton-icons">
            <div class="skeleton skeleton-icon"></div>
            <div class="skeleton skeleton-icon overlap"></div>
          </div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-value"></div>
        </div>
      {/each}
    {:else if pools.length === 0}
      <div class="empty-state">
        <p>No positions yet</p>
      </div>
    {:else}
      {#each pools.slice(0, 5) as pool}
        <div class="pool-row" use:ticker={pool.canisterId}>
          <div class="pool-info">
            <TokenPairLogo
              baseLogo={pool.base.logo ?? undefined}
              quoteLogo={pool.quote.logo ?? undefined}
              baseSymbol={pool.base.displaySymbol}
              quoteSymbol={pool.quote.displaySymbol}
              size="xxs"
            />
            <span class="pool-pair">{pool.base.displaySymbol}/{pool.quote.displaySymbol}</span>
          </div>
          <span class="pool-value">{formatUSD(pool.valueUsd, 2)}</span>
        </div>
      {/each}
    {/if}
  </div>

  <div class="total-row">
    <span class="total-label">Total</span>
    <span class="total-value">{formatUSD(totalValue, 2)}</span>
  </div>
</div>

<style>
  .mini-table {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 16px;
    display: flex;
    flex-direction: column;
    height: 280px;
  }

  .table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    flex-shrink: 0;
  }

  .table-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--foreground);
    margin: 0;
  }

  .count {
    font-size: 13px;
    font-weight: 500;
    color: var(--muted-foreground);
  }

  .table-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    overflow: hidden;
  }

  .pool-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .pool-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .pool-pair {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground);
  }

  .pool-value {
    font-size: 14px;
    font-family: var(--font-sans);
    font-weight: var(--font-weight-book);
    color: var(--foreground);
  }

  .total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .total-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--muted-foreground);
  }

  .total-value {
    font-size: 14px;
    font-weight: 600;
    color: var(--foreground);
  }

  .empty-state {
    padding: 24px;
    text-align: center;
  }

  .empty-state p {
    font-size: 13px;
    color: var(--muted-foreground);
    margin: 0;
  }

  .skeleton-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .skeleton-icons {
    display: flex;
    align-items: center;
  }

  .skeleton {
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-sm);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
  }

  .skeleton-icon.overlap {
    margin-left: -8px;
  }

  .skeleton-text {
    width: 70px;
    height: 16px;
  }

  .skeleton-value {
    width: 50px;
    height: 16px;
    margin-left: auto;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
