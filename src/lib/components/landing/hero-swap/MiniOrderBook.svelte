<script lang="ts">
  import { formatSigFig, formatToken } from "$lib/utils/format.utils";
  import type { UnifiedOrderBookResponse, UnifiedOrderBookRow } from "$lib/components/trade/shared/orderbook.utils";
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import { pricingService } from "$lib/domain/tokens";
  import { getOrderBookTokenUsdPrice } from "$lib/domain/tokens/utils/usd-price";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { tickToPrice } from "$lib/domain/markets/utils";

  interface Props {
    book: UnifiedOrderBookResponse | null;
    market: SpotMarket | null;
    currentPrice?: number;
    isLoading?: boolean;
  }

  let { book, market, currentPrice, isLoading = false }: Props = $props();

  const LEVELS = 8;

  // Display in token1 (quote token) — matches SpotOrderBook default
  // Derive token1 for decimals (same pattern as SpotOrderBook)
  let token1 = $derived.by(() => {
    if (market?.tokens?.[1]) {
      return entityStore.getToken(market.tokens[1].toString());
    }
    return undefined;
  });

  let tokenDecimals = $derived(token1?.decimals ?? 8);
  let baseDecimals = $derived(market?.baseTokenDecimals ?? 8);
  let quoteDecimals = $derived(market?.quoteTokenDecimals ?? 8);

  // Remap row amounts to token1 (quote) — same as SpotOrderBook.getAmount(row, "token1")
  // This ensures both bids and asks use the same unit for amounts, depth, and USD calc
  let remappedBook = $derived.by(() => {
    if (!book) return null;
    return {
      long: book.long.slice(0, LEVELS).map((row) => ({
        ...row,
        amount: row.book_token1_amount ?? row.amount,
      })),
      short: book.short.slice(0, LEVELS).map((row) => ({
        ...row,
        amount: row.book_token1_amount ?? row.amount,
      })),
      referencePriceE12: book.referencePriceE12,
    };
  });

  // Calculate total liquidity for depth visualization (sum of both sides)
  let totalLiquidity = $derived.by(() => {
    if (!remappedBook) return 0n;
    const askTotal = remappedBook.short.reduce((sum, row) => sum + row.amount, 0n);
    const bidTotal = remappedBook.long.reduce((sum, row) => sum + row.amount, 0n);
    return askTotal + bidTotal;
  });

  // Get asks with cumulative amounts (reversed so lowest ask is at bottom near spread)
  let asks = $derived.by(() => {
    if (!remappedBook) return [];
    let cumulative = 0n;
    const withCumulative = remappedBook.short.map((row) => {
      cumulative += row.amount;
      return { ...row, cumulativeAmount: cumulative };
    });
    // Reverse after calculating cumulative so depth bars grow toward spread
    return withCumulative.reverse();
  });

  // Get bids with cumulative amounts
  let bids = $derived.by(() => {
    if (!remappedBook) return [];
    let cumulative = 0n;
    return remappedBook.long.map((row) => {
      cumulative += row.amount;
      return { ...row, cumulativeAmount: cumulative };
    });
  });

  // Calculate midpoint price for USD conversion
  let midpoint = $derived.by(() => {
    if (!remappedBook || remappedBook.referencePriceE12 === 0n) return 0;
    return Number(remappedBook.referencePriceE12) / 1e12;
  });

  // Get token1 (quote) USD price — matches SpotOrderBook's selectedTokenType="token1"
  let tokenUsdPrice = $derived.by(() => {
    // Read reactive ICP price FIRST (establishes dependency)
    const icpPrice = pricingService.icpUsdPrice;

    if (!midpoint || midpoint === 0 || !market) return 0n;

    const usdPrice = getOrderBookTokenUsdPrice(
      'token1',
      midpoint,
      market.activeQuoteToken,
      icpPrice
    );
    return usdPrice ?? 0n;
  });

  // Calculate depth percentage for a row (cumulative / total liquidity)
  function getDepthPercent(cumulativeAmount: bigint): number {
    if (totalLiquidity === 0n) return 0;
    return (Number(cumulativeAmount) / Number(totalLiquidity)) * 100;
  }

  // Format price from tick
  function formatPrice(row: UnifiedOrderBookRow): string {
    if (row.tick !== undefined) {
      const price = tickToPrice(row.tick, baseDecimals, quoteDecimals);
      return formatSigFig(price, 5, { subscriptZeros: true });
    }
    return "--";
  }

  // Format USD value for size (consistent with OrderSide.svelte)
  function formatUsd(amount: bigint): string {
    if (tokenUsdPrice === 0n) return "--";
    const value = tokenUsdPrice * amount;
    const totalDecimals = 12 + tokenDecimals;
    return `$${formatToken({ value, unitName: totalDecimals, displayDecimals: 2 })}`;
  }

  // Format spread/current price
  function formatSpreadPrice(price?: number): string {
    if (price === undefined || price === null) return "--";
    return formatSigFig(price, 5);
  }
</script>

<div class="mini-orderbook">
  {#if isLoading || !remappedBook}
    <div class="loading-state">
      {#each Array(13) as _, i}
        <div class="skeleton-row">
          <span class="skeleton-text skeleton-price"></span>
          <span class="skeleton-text skeleton-amount"></span>
        </div>
      {/each}
    </div>
  {:else}
    <!-- Asks (reversed so lowest ask is at bottom near spread) -->
    <div class="asks">
      {#each asks as row (row.usd_price)}
        <div class="order-row ask">
          <div class="depth-bar ask-bar" style="width: {getDepthPercent(row.cumulativeAmount)}%"></div>
          <span class="price">{formatPrice(row)}</span>
          <span class="usd">{formatUsd(row.amount)}</span>
        </div>
      {/each}
    </div>

    <!-- Spread -->
    <div class="spread-row">
      <span class="spread-price">{formatSpreadPrice(currentPrice)}</span>
    </div>

    <!-- Bids -->
    <div class="bids">
      {#each bids as row (row.usd_price)}
        <div class="order-row bid">
          <div class="depth-bar bid-bar" style="width: {getDepthPercent(row.cumulativeAmount)}%"></div>
          <span class="price">{formatPrice(row)}</span>
          <span class="usd">{formatUsd(row.amount)}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .mini-orderbook {
    width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    font-family: var(--font-mono);
    font-size: 11px;
    overflow: hidden;
    background: var(--background);
    box-sizing: border-box;
  }

  .asks,
  .bids {
    display: flex;
    flex-direction: column;
    height: 160px; /* 8 rows × 20px — fixed regardless of row count */
  }

  .asks {
    justify-content: flex-end; /* rows hug the spread */
  }

  .order-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2px 6px;
    position: relative;
    height: 20px;
    overflow: hidden;
  }

  /* Round the first ask row (top of orderbook) */
  .asks .order-row:first-child {
    border-radius: 12px 12px 0 0;
  }

  .asks .order-row:first-child .depth-bar {
    border-radius: 12px 12px 0 0;
  }

  /* Round the last bid row (bottom of orderbook) */
  .bids .order-row:last-child {
    border-radius: 0 0 12px 12px;
  }

  .bids .order-row:last-child .depth-bar {
    border-radius: 0 0 12px 12px;
  }

  .depth-bar {
    position: absolute;
    top: 0;
    bottom: 0;
    opacity: 0.15;
  }

  .ask-bar {
    left: 0;
    background: var(--color-bearish);
  }

  .bid-bar {
    left: 0;
    background: var(--color-bullish);
  }

  .price,
  .usd {
    position: relative;
    z-index: 1;
  }

  .ask .price {
    color: var(--color-bearish);
  }

  .bid .price {
    color: var(--color-bullish);
  }

  .usd {
    color: var(--muted-foreground);
    font-size: 10px;
  }

  .spread-row {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    padding: 4px 6px;
    border-top: 1px dashed var(--border);
    border-bottom: 1px dashed var(--border);
  }

  .spread-price {
    font-weight: 700;
    color: var(--foreground);
    font-size: 12px;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-height: 348px;
  }

  .skeleton-row {
    flex: 1;
    min-height: 4px;
    background: var(--field);
    border-radius: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 6px;
  }

  .skeleton-row:first-child {
    border-radius: 12px 12px 4px 4px;
  }

  .skeleton-row:last-child {
    border-radius: 4px 4px 12px 12px;
  }

  .skeleton-text {
    display: block;
    height: 8px;
    border-radius: 4px;
    background: var(--muted);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-price {
    width: 38px;
  }

  .skeleton-amount {
    width: 24px;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 0.7;
    }
  }

  /* Mobile horizontal layout */
  @media (max-width: 767px) {
    .mini-orderbook {
      flex-direction: row;
      height: 100%;
      font-size: clamp(9px, 2.5vw, 11px);
    }

    .asks,
    .bids {
      flex: 1;
      height: auto;
    }

    .order-row {
      height: clamp(14px, 4vw, 20px);
      padding: 1px clamp(4px, 1.5vw, 6px);
    }

    .usd {
      font-size: clamp(8px, 2.2vw, 10px);
    }

    .spread-price {
      font-size: clamp(10px, 2.8vw, 12px);
    }

    /* On mobile, round left side of asks, right side of bids */
    .asks .order-row:first-child {
      border-radius: 12px 0 0 0;
    }

    .asks .order-row:first-child .depth-bar {
      border-radius: 12px 0 0 0;
    }

    .asks .order-row:last-child {
      border-radius: 0 0 0 12px;
    }

    .asks .order-row:last-child .depth-bar {
      border-radius: 0 0 0 12px;
    }

    .bids .order-row:first-child {
      border-radius: 0 12px 0 0;
    }

    .bids .order-row:first-child .depth-bar {
      border-radius: 0 12px 0 0;
    }

    .bids .order-row:last-child {
      border-radius: 0 0 12px 0;
    }

    .bids .order-row:last-child .depth-bar {
      border-radius: 0 0 12px 0;
    }

    .spread-row {
      display: none;
    }

    .bids {
      flex-direction: column-reverse;
    }

    .loading-state {
      min-height: auto;
      flex-direction: row;
    }
  }
</style>
