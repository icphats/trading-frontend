<script lang="ts">
  import { formatUSD, formatPercent } from '$lib/utils/format.utils';
  import { userPortfolio } from '$lib/domain/user';
  import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';

  interface Props {
    isLoading?: boolean;
  }

  let { isLoading = false }: Props = $props();

  // Calculate totals for each category
  const tokensValue = $derived(userPortfolio.totalValue);
  const poolsValue = $derived(userPortfolio.portfolioPoolsTotalValue);

  // Orders: sum of all order values (remaining input in USD)
  const ordersValue = $derived.by(() => {
    let total = 0;
    for (const market of userPortfolio.spotMarkets) {
      const marketData = entityStore.getMarket(market.spotCanisterId);
      if (!marketData) continue;

      const baseToken = marketData.baseToken ? entityStore.getToken(marketData.baseToken) : null;
      const quoteToken = marketData.quoteToken ? entityStore.getToken(marketData.quoteToken) : null;

      for (const order of market.orders) {
        const isBuy = 'buy' in order.side;
        const token = isBuy ? quoteToken : baseToken;
        const amount = isBuy ? order.quote_amount : order.base_amount;

        if (token) {
          const amountFloat = Number(amount) / (10 ** token.decimals);
          const priceFloat = Number(token.priceUsd ?? 0n) / 1e12;
          total += amountFloat * priceFloat;
        }
      }
    }
    return total;
  });

  // Triggers: sum of all trigger values (locked input in USD)
  const triggersValue = $derived.by(() => {
    let total = 0;
    for (const market of userPortfolio.spotMarkets) {
      const marketData = entityStore.getMarket(market.spotCanisterId);
      if (!marketData) continue;

      const baseToken = marketData.baseToken ? entityStore.getToken(marketData.baseToken) : null;
      const quoteToken = marketData.quoteToken ? entityStore.getToken(marketData.quoteToken) : null;

      for (const trigger of market.triggers) {
        const isBuy = 'buy' in trigger.side;
        const token = isBuy ? quoteToken : baseToken;

        if (token) {
          const amountFloat = Number(trigger.input_amount) / (10 ** token.decimals);
          const priceFloat = Number(token.priceUsd ?? 0n) / 1e12;
          total += amountFloat * priceFloat;
        }
      }
    }
    return total;
  });

  const totalValue = $derived(tokensValue + poolsValue + ordersValue + triggersValue);

  // Helper: given a current USD value and the token's 24h % change, return the dollar change
  function dollarChangeFromPercent(currentUsd: number, changePercent: number): number {
    if (!Number.isFinite(currentUsd) || currentUsd === 0 || changePercent === 0) return 0;
    const divisor = 1 + changePercent / 100;
    if (divisor <= 0) return 0;
    return currentUsd - currentUsd / divisor;
  }

  // Calculate 24h change across ALL portfolio categories
  const change24h = $derived.by(() => {
    let totalChange = 0;

    // 1) Wallet token holdings
    for (const token of userPortfolio.allTokens) {
      const entityToken = entityStore.getToken(token.canisterId);
      if (!entityToken) continue;
      totalChange += dollarChangeFromPercent(token.value, entityToken.priceChange24h);
    }

    // 2) Pool positions — each pool has two tokens contributing to its value
    for (const pool of userPortfolio.portfolioPools) {
      const market = entityStore.getMarket(pool.canisterId);
      const base = market?.baseToken ? entityStore.getToken(market.baseToken) : null;
      const quote = market?.quoteToken ? entityStore.getToken(market.quoteToken) : null;
      // Approximate: split pool value 50/50 and apply each token's change
      const halfValue = pool.valueUsd / 2;
      if (base) totalChange += dollarChangeFromPercent(halfValue, base.priceChange24h);
      if (quote) totalChange += dollarChangeFromPercent(halfValue, quote.priceChange24h);
    }

    // 3) Open orders — locked tokens affected by their price change
    for (const market of userPortfolio.spotMarkets) {
      const marketData = entityStore.getMarket(market.spotCanisterId);
      if (!marketData) continue;
      const baseToken = marketData.baseToken ? entityStore.getToken(marketData.baseToken) : null;
      const quoteToken = marketData.quoteToken ? entityStore.getToken(marketData.quoteToken) : null;

      for (const order of market.orders) {
        const isBuy = 'buy' in order.side;
        const token = isBuy ? quoteToken : baseToken;
        if (!token) continue;
        const amount = isBuy ? order.quote_amount : order.base_amount;
        const usdValue = (Number(amount) / (10 ** token.decimals)) * (Number(token.priceUsd ?? 0n) / 1e12);
        totalChange += dollarChangeFromPercent(usdValue, token.priceChange24h);
      }

      // 4) Triggers — locked input tokens
      for (const trigger of market.triggers) {
        const isBuy = 'buy' in trigger.side;
        const token = isBuy ? quoteToken : baseToken;
        if (!token) continue;
        const usdValue = (Number(trigger.input_amount) / (10 ** token.decimals)) * (Number(token.priceUsd ?? 0n) / 1e12);
        totalChange += dollarChangeFromPercent(usdValue, token.priceChange24h);
      }
    }

    return totalChange;
  });

  const change24hPercent = $derived.by(() => {
    if (totalValue <= 0 || change24h === 0 || !Number.isFinite(change24h)) return 0;
    const previousTotal = totalValue - change24h;
    if (previousTotal <= 0) return 0;
    return (change24h / previousTotal) * 100;
  });

  const isPositiveChange = $derived(change24h >= 0);
</script>

<div class="composition">
  {#if isLoading}
    <div class="skeleton-layout">
      <div class="skeleton-label"></div>
      <div class="skeleton-total"></div>
      <div class="skeleton-change"></div>
    </div>
  {:else}
    <div class="layout">
      <span class="label">Portfolio Value</span>
      <span class="total">{formatUSD(totalValue, 2)}</span>
      <span class="change" class:positive={isPositiveChange} class:negative={!isPositiveChange}>
        {isPositiveChange ? '+' : ''}{formatUSD(change24h, 2)} ({formatPercent(change24hPercent)}) today
      </span>
    </div>
  {/if}
</div>

<style>
  .composition {
    padding: 24px 0;
  }

  .layout {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .label {
    font-size: 14px;
    color: var(--muted-foreground);
  }

  .total {
    font-size: 36px;
    font-weight: 500;
    color: var(--foreground);
    line-height: 1.1;
  }

  .change {
    font-size: 14px;
    color: var(--muted-foreground);
  }

  .change.positive {
    color: var(--color-bullish);
  }

  .change.negative {
    color: var(--color-bearish);
  }

  /* Skeleton styles */
  .skeleton-layout {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .skeleton-label {
    height: 16px;
    width: 100px;
    border-radius: var(--radius-sm);
    background: var(--muted);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-total {
    height: 40px;
    width: 180px;
    border-radius: var(--radius-sm);
    background: var(--muted);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-change {
    height: 20px;
    width: 140px;
    border-radius: var(--radius-sm);
    background: var(--muted);
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
