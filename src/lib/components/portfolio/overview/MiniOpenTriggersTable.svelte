<script lang="ts">
  import { formatUSD } from '$lib/utils/format.utils';
  import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
  import { userPortfolio } from '$lib/domain/user';
  import TokenPairLogo from '$lib/components/ui/TokenPairLogo.svelte';
  import { ticker } from '$lib/domain/orchestration/ticker-action';

  interface Props {
    isLoading?: boolean;
  }

  let { isLoading = false }: Props = $props();

  // Aggregate triggers from all markets with market context
  const triggersWithContext = $derived.by(() => {
    const result: Array<{
      trigger: typeof userPortfolio.allTriggers[0];
      spotCanisterId: string;
      baseSymbol: string;
      quoteSymbol: string;
      baseLogo?: string;
      quoteLogo?: string;
      baseDecimals: number;
      quoteDecimals: number;
      valueUsd: number;
    }> = [];

    for (const marketData of userPortfolio.spotMarkets) {
      // Market metadata may not be loaded yet on fresh page load - use fallbacks
      const market = entityStore.getMarket(marketData.spotCanisterId);
      const baseToken = market?.baseToken ? entityStore.getToken(market.baseToken) : null;
      const quoteToken = market?.quoteToken ? entityStore.getToken(market.quoteToken) : null;

      const baseDecimals = baseToken?.decimals ?? 8;
      const quoteDecimals = quoteToken?.decimals ?? 8;
      const basePriceUsd = baseToken?.priceUsd ?? 0n;
      const quotePriceUsd = quoteToken?.priceUsd ?? 0n;

      for (const trigger of marketData.triggers) {
        // Locked input: input_amount - for buy it's quote, for sell it's base
        const isBuy = 'buy' in trigger.side;
        const decimals = isBuy ? quoteDecimals : baseDecimals;
        const priceUsd = isBuy ? quotePriceUsd : basePriceUsd;

        const amountFloat = Number(trigger.input_amount) / (10 ** decimals);
        const priceFloat = Number(priceUsd) / 1e12;
        const valueUsd = amountFloat * priceFloat;

        result.push({
          trigger,
          spotCanisterId: marketData.spotCanisterId,
          baseSymbol: baseToken?.displaySymbol ?? 'TOKEN',
          quoteSymbol: quoteToken?.displaySymbol ?? 'QUOTE',
          baseLogo: baseToken?.logo ?? undefined,
          quoteLogo: quoteToken?.logo ?? undefined,
          baseDecimals,
          quoteDecimals,
          valueUsd,
        });
      }
    }

    // Sort by timestamp descending (newest first)
    return result.sort((a, b) => Number(b.trigger.timestamp - a.trigger.timestamp));
  });

  const topTriggers = $derived(triggersWithContext.slice(0, 5));
  const triggerCount = $derived(triggersWithContext.length);
  const totalTriggersValue = $derived(triggersWithContext.reduce((sum, t) => sum + t.valueUsd, 0));

</script>

<div class="mini-table">
  <div class="table-header">
    <h3 class="table-title">Open Triggers</h3>
    <span class="count">{triggerCount} triggers</span>
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
    {:else if topTriggers.length === 0}
      <div class="empty-state">
        <p>No active triggers</p>
      </div>
    {:else}
      {#each topTriggers as item}
        <div class="trigger-row" use:ticker={item.spotCanisterId}>
          <div class="trigger-info">
            <TokenPairLogo
              token0Logo={item.baseLogo}
              token1Logo={item.quoteLogo}
              token0Symbol={item.baseSymbol}
              token1Symbol={item.quoteSymbol}
              size="xxs"
            />
            <span class="trigger-pair">{item.baseSymbol}/{item.quoteSymbol}</span>
          </div>
          <span class="trigger-value">{formatUSD(item.valueUsd, 2)}</span>
        </div>
      {/each}
    {/if}
  </div>

  <div class="total-row">
    <span class="total-label">Total</span>
    <span class="total-value">{formatUSD(totalTriggersValue, 2)}</span>
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

  .trigger-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .trigger-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .trigger-pair {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground);
  }

  .trigger-value {
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
