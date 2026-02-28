<script lang="ts">
  import { formatToken, formatSigFig } from "$lib/utils/format.utils";
  import Logo from "$lib/components/ui/Logo.svelte";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import type { UnifiedOrderBookResponse, UnifiedOrderBookRow } from "./orderbook.utils";

  interface Props {
    book: UnifiedOrderBookResponse;
    market: SpotMarket;
    overrideTokenLogo?: string;
    overrideTokenSymbol?: string;
    overrideTokenDecimals?: number;
    selectedTokenType?: "base" | "quote";
  }

  let {
    book,
    market,
    overrideTokenLogo,
    overrideTokenSymbol,
    overrideTokenDecimals,
    selectedTokenType = "base",
  }: Props = $props();

  // Derive base and quote for spot markets
  let base = $derived.by(() => {
    if (market.tokens?.[0]) {
      return entityStore.getToken(market.tokens[0].toString());
    }
    return undefined;
  });

  let quote = $derived.by(() => {
    if (market.tokens?.[1]) {
      return entityStore.getToken(market.tokens[1].toString());
    }
    return undefined;
  });

  // Get token symbol for size column header
  let sizeTokenSymbol = $derived.by(() => {
    if (overrideTokenSymbol !== undefined) {
      return overrideTokenSymbol;
    }
    return base?.displaySymbol ?? "";
  });

  // Get token decimals for proper formatting
  let sizeTokenDecimals = $derived.by(() => {
    if (overrideTokenDecimals !== undefined) {
      return overrideTokenDecimals;
    }
    return base?.decimals ?? 8;
  });

  // Price header label
  const priceLabel = "Price";

  // Format price from tick
  function formatPrice(row: UnifiedOrderBookRow): string {
    if (row.tick !== undefined) {
      const price = Math.pow(1.0001, row.tick);
      return formatSigFig(price, 4);
    }
    return "—";
  }

  // Format token amount
  function formatAmount(amount: bigint): string {
    return formatToken({
      value: amount,
      unitName: sizeTokenDecimals,
      short: true,
    });
  }

  // Calculate cumulative amounts for pyramid effect
  let cumulativeBids = $derived.by(() => {
    const result: { row: UnifiedOrderBookRow; cumulative: bigint }[] = [];
    let cumulative = 0n;
    // Bids: accumulate from best (top) down
    for (const row of book.long) {
      cumulative += row.amount;
      result.push({ row, cumulative });
    }
    return result;
  });

  let cumulativeAsks = $derived.by(() => {
    const result: { row: UnifiedOrderBookRow; cumulative: bigint }[] = [];
    let cumulative = 0n;
    // Asks: accumulate from best (top) down
    for (const row of book.short) {
      cumulative += row.amount;
      result.push({ row, cumulative });
    }
    return result;
  });

  // Calculate max cumulative for depth visualization
  let maxCumulative = $derived.by(() => {
    const maxBid = cumulativeBids.length > 0 ? cumulativeBids[cumulativeBids.length - 1].cumulative : 0n;
    const maxAsk = cumulativeAsks.length > 0 ? cumulativeAsks[cumulativeAsks.length - 1].cumulative : 0n;
    return maxBid > maxAsk ? maxBid : maxAsk;
  });

  // Calculate depth percentage for bar visualization (based on cumulative)
  function getDepthPercent(cumulative: bigint): number {
    if (maxCumulative === 0n) return 0;
    return Number((cumulative * 100n) / maxCumulative);
  }

</script>

<div class="orderbook-compact">
  <!-- Column Headers -->
  <div class="headers">
    <div class="header-left">
      <span class="header-text">{sizeTokenSymbol}</span>
      <span class="header-text">{priceLabel}</span>
    </div>
    <div class="header-right">
      <span class="header-text">{priceLabel}</span>
      <span class="header-text">{sizeTokenSymbol}</span>
    </div>
  </div>

  <!-- Order Book Rows -->
  <div class="book-content">
    <!-- Bids (Left Side) - Cumulative pyramid -->
    <div class="bids-column">
      {#each cumulativeBids as { row, cumulative } (row.usd_price)}
        <div class="row bid-row">
          <div class="depth-bar bid-bar" style="width: {getDepthPercent(cumulative)}%"></div>
          <span class="amount">{formatAmount(cumulative)}</span>
          <span class="price bid-price">{formatPrice(row)}</span>
        </div>
      {:else}
        <div class="empty-message">No bids</div>
      {/each}
    </div>

    <!-- Asks (Right Side) - Cumulative pyramid -->
    <div class="asks-column">
      {#each cumulativeAsks as { row, cumulative } (row.usd_price)}
        <div class="row ask-row">
          <div class="depth-bar ask-bar" style="width: {getDepthPercent(cumulative)}%"></div>
          <span class="price ask-price">{formatPrice(row)}</span>
          <span class="amount">{formatAmount(cumulative)}</span>
        </div>
      {:else}
        <div class="empty-message">No asks</div>
      {/each}
    </div>
  </div>
</div>

<style>
  .orderbook-compact {
    height: 100%;
    display: flex;
    flex-direction: column;
    font-family: var(--font-numeric);
    font-size: var(--font-size-orderbook);
  }

  /* Headers */
  .headers {
    display: flex;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border);
  }

  .header-left,
  .header-right {
    flex: 1;
    display: flex;
    justify-content: space-between;
    padding: 0.375rem 0.5rem;
  }

  .header-left {
    border-right: 1px solid var(--border);
  }

  .header-text {
    color: var(--muted-foreground);
    font-size: 0.6875rem;
    font-weight: 500;
  }

  /* Book Content - Side by Side */
  .book-content {
    flex: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
  }

  .bids-column,
  .asks-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .bids-column {
    border-right: 1px solid var(--border);
  }

  /* Rows */
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-orderbook) 0.75rem;
    margin: 2px 0;
    position: relative;
  }

  /* Depth Bars */
  .depth-bar {
    position: absolute;
    top: 0;
    bottom: 0;
    opacity: 0.15;
  }

  .bid-bar {
    right: 0;
    background-color: var(--color-bullish);
  }

  .ask-bar {
    left: 0;
    background-color: var(--color-bearish);
  }

  /* Text */
  .price,
  .amount {
    position: relative;
    z-index: 1;
  }

  .bid-price {
    color: var(--color-bullish);
    font-weight: 500;
  }

  .ask-price {
    color: var(--color-bearish);
    font-weight: 500;
  }

  .amount {
    color: var(--foreground);
  }

  .empty-message {
    padding: 1rem;
    text-align: center;
    color: var(--muted-foreground);
  }
</style>
