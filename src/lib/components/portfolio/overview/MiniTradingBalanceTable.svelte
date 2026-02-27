<script lang="ts">
  import { formatUSD } from '$lib/utils/format.utils';
  import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
  import { userPortfolio } from '$lib/domain/user';
  import Logo from '$lib/components/ui/Logo.svelte';
  import { tokenTicker } from '$lib/domain/orchestration';

  interface Props {
    isLoading?: boolean;
  }

  let { isLoading = false }: Props = $props();

  // Aggregate available balances across all spot markets, grouped by token
  const aggregatedBalances = $derived.by(() => {
    const balanceMap = new Map<string, {
      canisterId: string;
      symbol: string;
      logo?: string;
      decimals: number;
      priceUsd: bigint;
      balance: bigint;
    }>();

    for (const marketData of userPortfolio.spotMarkets) {
      // Market metadata may not be loaded yet on fresh page load
      // Skip if missing - will re-render reactively when market loads
      const market = entityStore.getMarket(marketData.spotCanisterId);
      if (!market) continue;

      // Add base token available balance
      if (market.baseToken && marketData.available.base > 0n) {
        const baseToken = entityStore.getToken(market.baseToken);
        const existing = balanceMap.get(market.baseToken);
        if (existing) {
          existing.balance += marketData.available.base;
        } else {
          balanceMap.set(market.baseToken, {
            canisterId: market.baseToken,
            symbol: baseToken?.displaySymbol ?? 'TOKEN',
            logo: baseToken?.logo ?? undefined,
            decimals: baseToken?.decimals ?? 8,
            priceUsd: baseToken?.priceUsd ?? 0n,
            balance: marketData.available.base,
          });
        }
      }

      // Add quote token available balance
      if (market.quoteToken && marketData.available.quote > 0n) {
        const quoteToken = entityStore.getToken(market.quoteToken);
        const existing = balanceMap.get(market.quoteToken);
        if (existing) {
          existing.balance += marketData.available.quote;
        } else {
          balanceMap.set(market.quoteToken, {
            canisterId: market.quoteToken,
            symbol: quoteToken?.displaySymbol ?? 'QUOTE',
            logo: quoteToken?.logo ?? undefined,
            decimals: quoteToken?.decimals ?? 8,
            priceUsd: quoteToken?.priceUsd ?? 0n,
            balance: marketData.available.quote,
          });
        }
      }
    }

    // Convert to array with USD values and sort by value
    return Array.from(balanceMap.values())
      .map(item => {
        const balanceFloat = Number(item.balance) / (10 ** item.decimals);
        const priceFloat = Number(item.priceUsd) / 1e12;
        const valueUsd = balanceFloat * priceFloat;
        return { ...item, valueUsd };
      })
      .sort((a, b) => b.valueUsd - a.valueUsd);
  });

  const topBalances = $derived(aggregatedBalances.slice(0, 5));
  const balanceCount = $derived(aggregatedBalances.length);

  // Total value of all spot market balances
  const totalSpotValue = $derived(
    aggregatedBalances.reduce((sum, b) => sum + b.valueUsd, 0)
  );

</script>

<div class="mini-table">
  <div class="table-header">
    <h3 class="table-title">Trading Balance</h3>
    <span class="count">{balanceCount} tokens</span>
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
    {:else if topBalances.length === 0}
      <div class="empty-state">
        <p>No spot balances</p>
      </div>
    {:else}
      {#each topBalances as item}
        <div class="balance-row" use:tokenTicker={item.canisterId}>
          <div class="balance-info">
            <Logo
              src={item.logo}
              alt={item.symbol}
              size="xxs"
              circle={true}
            />
            <span class="balance-symbol">{item.symbol}</span>
          </div>
          <span class="balance-value">{formatUSD(item.valueUsd, 2)}</span>
        </div>
      {/each}
    {/if}
  </div>

  <div class="total-row">
    <span class="total-label">Total</span>
    <span class="total-value">{formatUSD(totalSpotValue, 2)}</span>
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

  .balance-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .balance-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .balance-symbol {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground);
  }

  .balance-value {
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
