<script lang="ts">
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import { formatToken, formatSigFig, formatTimeAgo } from "$lib/utils/format.utils";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { app } from "$lib/state/app.state.svelte";
  import { Logo, Spinner } from "$lib/components/ui";
  import { GridTable, GridHeader, GridRow, GridCell, gridPresets, SideBadge } from "$lib/components/ui/table";

  // Receive typed SpotMarket instance as prop
  let { spot }: { spot: SpotMarket } = $props();

  // Get token metadata from registry
  const base = $derived(spot.tokens ? entityStore.getToken(spot.tokens[0].toString()) : null);
  const quote = $derived(spot.tokens && spot.tokens[1] ? entityStore.getToken(spot.tokens[1].toString()) : null);

  // Infinite scroll state - now uses backend pagination
  let sentinelEl: HTMLDivElement | null = $state(null);
  let observer: IntersectionObserver | null = null;

  // Convert SvelteMap to sorted array (newest first by tx_id)
  let transactions = $derived.by(() => {
    const txArray = Array.from(spot.txs.values());
    // Sort by ID descending (newest first - higher tx_id = newer)
    return txArray.sort((a, b) => Number(b.id - a.id));
  });

  // Set up IntersectionObserver for infinite scroll with backend pagination
  $effect(() => {
    if (!sentinelEl) return;

    observer?.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && spot.txHasMore && !spot.txLoading) {
          // Load more from backend
          spot.loadMoreTransactions();
        }
      },
      { rootMargin: '100px' }
    );
    observer.observe(sentinelEl);

    return () => {
      observer?.disconnect();
    };
  });

  // Format price_e12 to display string (E12 = 12 decimal places)
  function formatPriceE12(priceE12: bigint): string {
    const price = Number(priceE12) / 1e12;
    return formatSigFig(price, 5, { subscriptZeros: true });
  }

  // Format USD value (already pre-computed from backend, 6 decimals / E6)
  function formatUsdValue(usdValue: bigint): string {
    return (Number(usdValue) / 1e6).toFixed(2);
  }
</script>

<GridTable columns={gridPresets.transactions}>
  <GridHeader>
    <GridCell>Time</GridCell>
    <GridCell align="center">Side</GridCell>
    <GridCell align="center">Price</GridCell>
    <GridCell align="center">{base?.displaySymbol ?? "Base"}</GridCell>
    <GridCell align="center">{quote?.displaySymbol ?? "Quote"}</GridCell>
    <GridCell align="center">USD</GridCell>
  </GridHeader>

  {#each transactions as tx (tx.id)}
    {@const isBuy = tx.side === 'buy' || (typeof tx.side === 'object' && 'buy' in tx.side)}
    <GridRow>
      <GridCell compact>
        <span class="timestamp">{formatTimeAgo(tx.timestamp, app.now)}</span>
      </GridCell>
      <GridCell align="center" compact>
        <SideBadge side={tx.side} />
      </GridCell>
      <GridCell align="right" compact>
        {formatPriceE12(tx.price_e12)}
      </GridCell>
      <GridCell align="right" compact>
        <div class="amount-cell">
          <span class={isBuy ? "text-bullish" : "text-bearish"}>
            {isBuy ? "+" : "-"}
            {formatToken({
              value: tx.base_amount,
              unitName: base?.decimals ?? 8,
              displayDecimals: 6,
              commas: true,
            })}
          </span>
          {#if base}
            <Logo src={base.logo ?? undefined} alt={base.symbol} size="xxs" circle={true} />
          {/if}
        </div>
      </GridCell>
      <GridCell align="right" compact>
        <div class="amount-cell">
          <span class="text-muted">
            {formatToken({
              value: tx.quote_amount,
              unitName: quote?.decimals ?? 8,
              displayDecimals: 6,
              commas: true,
            })}
          </span>
          {#if quote}
            <Logo src={quote.logo ?? undefined} alt={quote.symbol} size="xxs" circle={true} />
          {/if}
        </div>
      </GridCell>
      <GridCell align="right" compact>
        ${formatUsdValue(tx.usd_value)}
      </GridCell>
    </GridRow>
  {:else}
    <div class="empty-state">
      <p class="empty-text">No transactions yet</p>
    </div>
  {/each}

  <!-- Infinite scroll sentinel -->
  {#if spot.txHasMore}
    <div bind:this={sentinelEl} class="scroll-sentinel">
      {#if spot.txLoading}
        <div class="loading-more">
          <Spinner size="sm" />
        </div>
      {/if}
    </div>
  {/if}
</GridTable>

<style>
  /* Amount cell with logo - right-aligned content */
  .amount-cell {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.375rem;
  }

  /* Color utilities */
  .text-bullish {
    color: var(--color-bullish);
  }

  .text-bearish {
    color: var(--color-bearish);
  }

  .text-muted {
    color: var(--muted-foreground);
  }

  /* Muted timestamp */
  .timestamp {
    color: var(--muted-foreground);
  }

  /* Infinite scroll */
  .scroll-sentinel {
    height: 1px;
    width: 100%;
  }

  .loading-more {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    color: var(--muted-foreground);
    font-size: 12px;
  }

  /* Empty state */
  .empty-state {
    padding: 24px;
    text-align: center;
  }

  .empty-text {
    font-size: 0.8125rem;
    color: var(--muted-foreground);
  }
</style>
