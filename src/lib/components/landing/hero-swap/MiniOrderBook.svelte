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

  // Display in quote token — matches SpotOrderBook default
  // Derive quote token for decimals (same pattern as SpotOrderBook)
  let quoteToken = $derived.by(() => {
    if (market?.tokens?.[1]) {
      return entityStore.getToken(market.tokens[1].toString());
    }
    return undefined;
  });

  let tokenDecimals = $derived(quoteToken?.decimals ?? 8);
  let baseDecimals = $derived(market?.baseTokenDecimals ?? 8);
  let quoteDecimals = $derived(market?.quoteTokenDecimals ?? 8);

  // Remap row amounts to quote — same as SpotOrderBook.getAmount(row, "quote")
  // This ensures both bids and asks use the same unit for amounts, depth, and USD calc
  let remappedBook = $derived.by(() => {
    if (!book) return null;
    return {
      long: book.long.slice(0, LEVELS).map((row) => ({
        ...row,
        amount: row.book_quote_amount ?? row.amount,
      })),
      short: book.short.slice(0, LEVELS).map((row) => ({
        ...row,
        amount: row.book_quote_amount ?? row.amount,
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

  // Get asks with cumulative amounts
  // Desktop (vertical): reversed so lowest ask is at bottom near spread
  // Mobile (horizontal): natural order, lowest ask at top
  let asks = $derived.by(() => {
    if (!remappedBook) return [];
    let cumulative = 0n;
    const withCumulative = remappedBook.short.map((row) => {
      cumulative += row.amount;
      return { ...row, cumulativeAmount: cumulative };
    });
    return withCumulative;
  });

  let asksReversed = $derived([...asks].reverse());

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

  // Get quote USD price — matches SpotOrderBook's selectedTokenType="quote"
  let tokenUsdPrice = $derived.by(() => {
    // Read reactive ICP price FIRST (establishes dependency)
    const icpPrice = pricingService.icpUsdPrice;

    if (!midpoint || midpoint === 0 || !market) return 0n;

    const usdPrice = getOrderBookTokenUsdPrice(
      'quote',
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
    <!-- Desktop: vertical (asks → spread → bids) -->
    <div class="desktop-book">
      <div class="asks">
        {#each asksReversed as row (row.usd_price)}
          <div class="order-row ask">
            <div class="depth-bar ask-bar" style="width: {getDepthPercent(row.cumulativeAmount)}%"></div>
            <span class="price">{formatPrice(row)}</span>
            <span class="usd">{formatUsd(row.amount)}</span>
          </div>
        {/each}
      </div>

      <div class="spread-row">
        <span class="spread-price">{formatSpreadPrice(currentPrice)}</span>
      </div>

      <div class="bids">
        {#each bids as row (row.usd_price)}
          <div class="order-row bid">
            <div class="depth-bar bid-bar" style="width: {getDepthPercent(row.cumulativeAmount)}%"></div>
            <span class="price">{formatPrice(row)}</span>
            <span class="usd">{formatUsd(row.amount)}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Mobile: side-by-side (bids left, asks right) -->
    <div class="mobile-book">
      <div class="bids">
        {#each bids as row (row.usd_price)}
          <div class="order-row bid">
            <div class="depth-bar bid-bar" style="width: {getDepthPercent(row.cumulativeAmount)}%"></div>
            <span class="price">{formatPrice(row)}</span>
            <span class="usd">{formatUsd(row.amount)}</span>
          </div>
        {/each}
      </div>

      <div class="asks">
        {#each asks as row (row.usd_price)}
          <div class="order-row ask">
            <div class="depth-bar ask-bar" style="width: {getDepthPercent(row.cumulativeAmount)}%"></div>
            <span class="price">{formatPrice(row)}</span>
            <span class="usd">{formatUsd(row.amount)}</span>
          </div>
        {/each}
      </div>
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

  /* Desktop: vertical layout */
  .desktop-book {
    display: flex;
    flex-direction: column;
  }

  .desktop-book .asks,
  .desktop-book .bids {
    display: flex;
    flex-direction: column;
    height: 160px;
  }

  .desktop-book .asks {
    justify-content: flex-end;
  }

  /* Desktop corner rounding */
  .desktop-book .asks .order-row:first-child {
    border-radius: 12px 12px 0 0;
  }

  .desktop-book .asks .order-row:first-child .depth-bar {
    border-radius: 12px 12px 0 0;
  }

  .desktop-book .bids .order-row:last-child {
    border-radius: 0 0 12px 12px;
  }

  .desktop-book .bids .order-row:last-child .depth-bar {
    border-radius: 0 0 12px 12px;
  }

  /* Mobile: side-by-side layout (hidden on desktop) */
  .mobile-book {
    display: none;
  }

  .mobile-book .asks,
  .mobile-book .bids {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  /* Mobile corner rounding */
  .mobile-book .bids .order-row:first-child {
    border-radius: 12px 0 0 0;
  }

  .mobile-book .bids .order-row:first-child .depth-bar {
    border-radius: 12px 0 0 0;
  }

  .mobile-book .bids .order-row:last-child {
    border-radius: 0 0 0 12px;
  }

  .mobile-book .bids .order-row:last-child .depth-bar {
    border-radius: 0 0 0 12px;
  }

  .mobile-book .asks .order-row:first-child {
    border-radius: 0 12px 0 0;
  }

  .mobile-book .asks .order-row:first-child .depth-bar {
    border-radius: 0 12px 0 0;
  }

  .mobile-book .asks .order-row:last-child {
    border-radius: 0 0 12px 0;
  }

  .mobile-book .asks .order-row:last-child .depth-bar {
    border-radius: 0 0 12px 0;
  }

  /* Shared row styles */
  .order-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2px 6px;
    position: relative;
    height: 20px;
    overflow: hidden;
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

  /* Skeleton */
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

  /* Mobile: swap to side-by-side */
  @media (max-width: 767px) {
    .mini-orderbook {
      height: 100%;
      font-size: clamp(9px, 2.5vw, 11px);
    }

    .desktop-book {
      display: none;
    }

    .mobile-book {
      display: flex;
      flex-direction: row;
      flex: 1;
    }

    .mobile-book .ask-bar {
      right: 0;
      left: auto;
    }

    .order-row {
      height: clamp(14px, 4vw, 20px);
      padding: 1px clamp(4px, 1.5vw, 6px);
    }

    .usd {
      font-size: clamp(8px, 2.2vw, 10px);
    }

    .loading-state {
      min-height: auto;
      flex-direction: row;
      flex: 1;
    }
  }
</style>
