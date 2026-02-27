<script lang="ts">
  import { formatUSD } from '$lib/utils/format.utils';
  import Logo from '$lib/components/ui/Logo.svelte';
  import { userPortfolio } from '$lib/domain/user';
  import { tokenTicker } from '$lib/domain/orchestration';
  import type { PortfolioToken } from '$lib/domain/user/user-portfolio.svelte';

  interface Props {
    tokens?: PortfolioToken[];
    isLoading?: boolean;
  }

  let { tokens = [], isLoading = false }: Props = $props();

  // Total value across ALL tokens (not just displayed), count of tokens with balance > 0
  const totalValue = $derived(userPortfolio.totalValue);
  const tokenCount = $derived(userPortfolio.activeTokenCount);
</script>

<div class="mini-table">
  <div class="table-header">
    <h3 class="table-title">Wallet Balance</h3>
    <span class="count">{tokenCount} tokens</span>
  </div>

  <div class="table-content">
    {#if isLoading}
      {#each Array(3) as _}
        <div class="skeleton-row">
          <div class="skeleton skeleton-icon"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-value"></div>
        </div>
      {/each}
    {:else if tokens.length === 0}
      <div class="empty-state">
        <p>No tokens yet</p>
      </div>
    {:else}
      {#each tokens.slice(0, 5) as token}
        <div class="token-row" use:tokenTicker={token.canisterId}>
          <div class="token-info">
            <Logo
              src={token.logo ?? undefined}
              alt={token.displaySymbol ?? token.symbol ?? 'Token'}
              size="xxs"
              circle={true}
            />
            <span class="token-symbol">{token.displaySymbol ?? token.symbol ?? 'Unknown'}</span>
          </div>
          <span class="token-value">{formatUSD(token.value, 2)}</span>
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

  .token-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .token-symbol {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground);
  }

  .token-value {
    font-size: 14px;
    font-family: var(--font-sans);
    font-weight: var(--font-weight-book);
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

  .skeleton-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .skeleton {
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-sm);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-icon {
    width: 28px;
    height: 28px;
    border-radius: 50%;
  }

  .skeleton-text {
    width: 60px;
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
