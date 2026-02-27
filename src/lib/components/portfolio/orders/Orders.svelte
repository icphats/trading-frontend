<script lang="ts">
  import type { OrderView, Side, QuoteResult } from "$lib/actors/services/spot.service";
  import { tickToPrice, priceToTick, bigIntToString, bpsToPercent } from "$lib/domain/markets/utils";
  import { formatToken, formatSigFig, formatTimestamp } from "$lib/utils/format.utils";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { userPortfolio, userPreferences } from "$lib/domain/user";
  import { marketRegistry } from "$lib/domain/markets";

  import OrderDetailsModal from "$lib/components/portal/modals/specific/OrderDetailsModal.svelte";
  import EditOrderModal from "$lib/components/portal/modals/specific/EditOrderModal.svelte";
  import ConfirmationModal from "$lib/components/portal/modals/specific/ConfirmationModal.svelte";
  import { GridTable, GridHeader, GridRow, GridCell, gridPresets, SideBadge } from "$lib/components/ui/table";
  import { Logo } from "$lib/components/ui";

  import type { DropdownOption } from "$lib/components/ui/dropdown/types";
  import { ticker } from "$lib/domain/orchestration/ticker-action";
  import { pageHeader } from '$lib/components/portfolio/page-header.svelte';
  import { toastState } from "$lib/state/portal/toast.state.svelte";

  // Configure page header
  pageHeader.reset();
  pageHeader.mode = 'orders';
  pageHeader.sectionLabel = 'Orders Value';
  pageHeader.showValue = true;
  pageHeader.filterType = 'dropdown';
  pageHeader.dropdownAriaLabel = 'Filter by market';
  pageHeader.dropdownMultiSelect = true;
  pageHeader.dropdownValues = [];

  // Derive dropdown options from user's spot positions
  const dropdownOptions = $derived.by(() => {
    const options: DropdownOption<string>[] = [];
    for (const marketData of userPortfolio.spotMarkets) {
      const market = entityStore.getMarket(marketData.spotCanisterId);
      const baseToken = market?.baseToken ? entityStore.getToken(market.baseToken) : null;
      const quoteToken = market?.quoteToken ? entityStore.getToken(market.quoteToken) : null;
      options.push({
        value: marketData.spotCanisterId,
        label: `${baseToken?.displaySymbol ?? '?'}/${quoteToken?.displaySymbol ?? '?'}`,
      });
    }
    return options;
  });

  // Push dropdown options to page header
  $effect(() => {
    pageHeader.dropdownOptions = dropdownOptions;
    pageHeader.showDropdown = dropdownOptions.length > 0;
  });

  // Read filter values from page header (empty = show all)
  const filterCanisterIds = $derived(pageHeader.dropdownValues);

  // Aggregate orders from all spot markets with market context
  const allOrdersWithContext = $derived.by(() => {
    const result: Array<{
      order: OrderView;
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
      const market = entityStore.getMarket(marketData.spotCanisterId);
      const baseToken = market?.baseToken ? entityStore.getToken(market.baseToken) : null;
      const quoteToken = market?.quoteToken ? entityStore.getToken(market.quoteToken) : null;

      const baseDecimals = baseToken?.decimals ?? 8;
      const quoteDecimals = quoteToken?.decimals ?? 8;
      const basePriceUsd = baseToken?.priceUsd ?? 0n;
      const quotePriceUsd = quoteToken?.priceUsd ?? 0n;

      for (const order of marketData.orders) {
        const isBuy = 'buy' in order.side;
        const remainingAmount = isBuy ? order.quote_amount : order.base_amount;
        const decimals = isBuy ? quoteDecimals : baseDecimals;
        const priceUsd = isBuy ? quotePriceUsd : basePriceUsd;

        const amountFloat = Number(remainingAmount) / (10 ** decimals);
        const priceFloat = Number(priceUsd) / 1e12;
        const valueUsd = amountFloat * priceFloat;

        result.push({
          order,
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

    const sorted = result.sort((a, b) => Number(b.order.timestamp - a.order.timestamp));
    if (filterCanisterIds.length > 0) return sorted.filter(item => filterCanisterIds.includes(item.spotCanisterId));
    return sorted;
  });

  const orderCount = $derived(allOrdersWithContext.length);
  const totalValue = $derived(allOrdersWithContext.reduce((sum, o) => sum + o.valueUsd, 0));

  // 24h change for orders (locked token price changes)
  const change24h = $derived.by(() => {
    let total = 0;
    for (const item of allOrdersWithContext) {
      if (item.valueUsd === 0) continue;
      const isBuy = 'buy' in item.order.side;
      const tokenId = isBuy
        ? entityStore.getMarket(item.spotCanisterId)?.quoteToken
        : entityStore.getMarket(item.spotCanisterId)?.baseToken;
      const token = tokenId ? entityStore.getToken(tokenId) : null;
      if (!token || token.priceChange24h === 0) continue;
      const d = 1 + token.priceChange24h / 100;
      if (d > 0) total += item.valueUsd - item.valueUsd / d;
    }
    return total;
  });

  const change24hPercent = $derived.by(() => {
    if (totalValue <= 0 || change24h === 0) return 0;
    const prev = totalValue - change24h;
    return prev > 0 ? (change24h / prev) * 100 : 0;
  });

  // Push reactive values to page header
  $effect(() => {
    pageHeader.totalValue = totalValue;
    pageHeader.change24h = change24h;
    pageHeader.change24hPercent = change24hPercent;
    pageHeader.count = orderCount;
    pageHeader.countLabel = orderCount === 1 ? 'order' : 'orders';
  });

  // Modal state
  let detailsModalOpen = $state(false);
  let editModalOpen = $state(false);
  let cancelModalOpen = $state(false);
  let executeModalOpen = $state(false);
  let selectedOrder = $state<OrderView | null>(null);
  let selectedSpotCanisterId = $state<string | null>(null);

  const selectedSpot = $derived(
    selectedSpotCanisterId ? marketRegistry.getSpotMarket(selectedSpotCanisterId) : undefined
  );

  // Quote state for execute confirmation
  let cachedQuote = $state<QuoteResult | null>(null);
  let executingOrderId = $state<bigint | null>(null);

  function handleRowClick(order: OrderView, spotCanisterId: string) {
    selectedOrder = order;
    selectedSpotCanisterId = spotCanisterId;
    detailsModalOpen = true;
  }

  function handleEdit(e: MouseEvent, order: OrderView, spotCanisterId: string) {
    e.stopPropagation();
    selectedOrder = order;
    selectedSpotCanisterId = spotCanisterId;
    editModalOpen = true;
  }

  async function fetchQuote(order: OrderView, spot: import("$lib/domain/markets/state/spot-market.svelte").SpotMarket) {
    const isBuy = 'buy' in order.side;
    const sideVariant: Side = isBuy ? { buy: null } : { sell: null };
    const remaining = isBuy
      ? order.quote_amount - order.quote_filled
      : order.base_amount - order.base_filled;

    const slippagePct = userPreferences.defaultSlippage / 100;
    const slippageMultiplier = isBuy ? 1 + slippagePct / 100 : 1 - slippagePct / 100;
    const slippagePrice = spot.spotPrice * slippageMultiplier;
    const slippageTick = priceToTick(slippagePrice, spot.baseTokenDecimals, spot.quoteTokenDecimals, spot.tickSpacing);

    return await spot.quoteOrder(sideVariant, remaining, slippageTick);
  }

  async function handleExecute(e: MouseEvent, order: OrderView, spotCanisterId: string) {
    e.stopPropagation();
    const spot = marketRegistry.getSpotMarket(spotCanisterId);
    if (!spot) return;

    executingOrderId = order.order_id;
    selectedOrder = order;
    selectedSpotCanisterId = spotCanisterId;

    try {
      const quote = await fetchQuote(order, spot);

      if (userPreferences.skipOrderConfirmation) {
        await executeConvertToMarket(order, quote, spot);
      } else {
        cachedQuote = quote;
        executingOrderId = null;
        executeModalOpen = true;
      }
    } catch (err) {
      toastState.show({
        message: err instanceof Error ? err.message : 'Failed to get quote',
        variant: 'error',
      });
      executingOrderId = null;
    }
  }

  function buildCreateOrdersFromQuote(
    quote: QuoteResult,
    spot: import("$lib/domain/markets/state/spot-market.svelte").SpotMarket,
    orderId?: bigint,
  ) {
    const bookOrders = quote.book_order.length > 0
      ? [{ ...quote.book_order[0]!, immediate_or_cancel: true }]
      : [];
    const cancelIds = orderId !== undefined ? [orderId] : [];
    return spot.createOrders(cancelIds, bookOrders, quote.pool_swaps);
  }

  async function executeConvertToMarket(
    order: OrderView,
    quote: QuoteResult,
    spot: import("$lib/domain/markets/state/spot-market.svelte").SpotMarket
  ) {
    const isBuy = 'buy' in order.side;
    const market = entityStore.getMarket(spot.canister_id);
    const baseToken = market?.baseToken ? entityStore.getToken(market.baseToken) : null;

    try {
      await toastState.show({
        async: true,
        promise: buildCreateOrdersFromQuote(quote, spot, order.order_id),
        messages: {
          loading: `Converting order #${order.order_id} to market...`,
          success: () => `Order #${order.order_id} executed at market`,
          error: (err: unknown) => err instanceof Error ? err.message : 'Failed to execute order',
        },
        data: {
          type: 'order',
          side: isBuy ? 'Buy' : 'Sell',
          orderType: 'market',
          symbol: baseToken?.displaySymbol ?? 'TOKEN',
          logo: baseToken?.logo ?? undefined,
        },
        duration: 3000,
        toastPosition: 'bottom-right',
      });
    } finally {
      executingOrderId = null;
    }
  }

  async function handleConfirmExecute() {
    if (!selectedOrder || !cachedQuote || !selectedSpot) return;
    return await buildCreateOrdersFromQuote(cachedQuote, selectedSpot, selectedOrder.order_id);
  }

  function handleCancel(e: MouseEvent, order: OrderView, spotCanisterId: string) {
    e.stopPropagation();
    selectedOrder = order;
    selectedSpotCanisterId = spotCanisterId;

    if (userPreferences.skipOrderConfirmation) {
      const spot = marketRegistry.getSpotMarket(spotCanisterId);
      if (!spot) return;
      const market = entityStore.getMarket(spotCanisterId);
      const baseToken = market?.baseToken ? entityStore.getToken(market.baseToken) : null;

      toastState.show({
        async: true,
        promise: spot.cancelOrder(order.order_id),
        messages: {
          loading: `Cancelling order #${order.order_id}...`,
          success: () => `Order #${order.order_id} cancelled`,
          error: (err: unknown) => err instanceof Error ? err.message : 'Failed to cancel order',
        },
        data: {
          type: 'order',
          side: 'buy' in order.side ? 'Buy' : 'Sell',
          orderType: 'limit',
          symbol: baseToken?.displaySymbol ?? 'TOKEN',
          logo: baseToken?.logo ?? undefined,
        },
        duration: 3000,
        toastPosition: 'bottom-right',
      });
    } else {
      cancelModalOpen = true;
    }
  }

  // Rich confirmation detail for execute modal
  const convertOrderDetail = $derived.by(() => {
    if (!selectedOrder || !selectedSpot || !selectedSpotCanisterId) return undefined;

    const market = entityStore.getMarket(selectedSpotCanisterId);
    const bToken = market?.baseToken ? entityStore.getToken(market.baseToken) : null;
    const qToken = market?.quoteToken ? entityStore.getToken(market.quoteToken) : null;
    if (!bToken || !qToken) return undefined;

    const isBuy = 'buy' in selectedOrder.side;
    const inToken = isBuy ? qToken : bToken;
    const outToken = isBuy ? bToken : qToken;
    const remaining = isBuy
      ? selectedOrder.quote_amount - selectedOrder.quote_filled
      : selectedOrder.base_amount - selectedOrder.base_filled;

    const rows: Array<{ label: string; value: string; logo?: string }> = [
      { label: 'Spend', value: `${formatToken({ value: remaining, unitName: inToken.decimals, displayDecimals: 6, commas: true })} ${inToken.displaySymbol}` },
    ];

    if (cachedQuote) {
      const outputFormatted = bigIntToString(cachedQuote.output_amount, outToken.decimals);
      const impactPercent = bpsToPercent(cachedQuote.price_impact_bps);
      rows.push({ label: 'Receive', value: `~${outputFormatted} ${outToken.displaySymbol}` });
      rows.push({ label: 'Price impact', value: impactPercent < 0.01 ? '< 0.01%' : `${impactPercent.toFixed(2)}%` });
    }

    let routing = undefined;
    if (cachedQuote) {
      const filledFromVenues = cachedQuote.venue_breakdown.reduce((sum, v) => sum + Number(v.input_amount), 0);
      const fillPercent = remaining > 0n ? Math.min(100, (filledFromVenues / Number(remaining)) * 100) : 0;

      routing = {
        venues: cachedQuote.venue_breakdown
          .toSorted((a, b) => Number(b.input_amount) - Number(a.input_amount))
          .map(v => {
            const pct = Math.round((Number(v.input_amount) / Number(cachedQuote!.input_amount)) * 100);
            const isBook = 'book' in v.venue_id;
            return {
              type: isBook ? 'book' as const : 'pool' as const,
              label: isBook ? 'Book' : `Pool-${'pool' in v.venue_id ? v.venue_id.pool / 100 : '?'}`,
              percent: pct,
              inputAmount: bigIntToString(v.input_amount, inToken.decimals),
              outputAmount: bigIntToString(v.output_amount, outToken.decimals),
              feeAmount: bigIntToString(v.fee_amount, inToken.decimals),
            };
          }),
        fillPercent,
        totalFees: bigIntToString(cachedQuote.total_fees, inToken.decimals),
        inputSymbol: inToken.displaySymbol,
        inputLogo: inToken.logo ?? undefined,
        outputSymbol: outToken.displaySymbol,
        outputLogo: outToken.logo ?? undefined,
      };
    }

    return {
      side: (isBuy ? 'Buy' : 'Sell') as 'Buy' | 'Sell',
      baseSymbol: bToken.displaySymbol,
      baseLogo: bToken.logo ?? undefined,
      rows,
      routing,
    };
  });

  // Poll for fresh quotes while execute modal is open
  $effect(() => {
    if (!executeModalOpen || !selectedOrder || !selectedSpot) return;
    const order = selectedOrder;
    const spot = selectedSpot;

    const interval = setInterval(async () => {
      try {
        cachedQuote = await fetchQuote(order, spot);
      } catch (err) {
        console.error('[Orders] Quote refresh failed:', err);
      }
    }, 5_000);

    return () => clearInterval(interval);
  });

  async function handleConfirmCancel() {
    if (!selectedOrder || !selectedSpot) return;
    try {
      await selectedSpot.cancelOrder(selectedOrder.order_id);
    } catch (err) {
      throw err;
    }
  }

  function formatTickPrice(tick: number, baseDecimals: number = 8, quoteDecimals: number = 8): string {
    const price = tickToPrice(tick, baseDecimals, quoteDecimals);
    return formatSigFig(price, 5, { subscriptZeros: true });
  }

  function getFilledPercentage(order: OrderView): number {
    if ('buy' in order.side) {
      if (order.quote_amount === 0n) return 0;
      return Number((order.quote_filled * 100n) / order.quote_amount);
    } else {
      if (order.base_amount === 0n) return 0;
      return Number((order.base_filled * 100n) / order.base_amount);
    }
  }
</script>

<div class="orders-page">
  <GridTable columns={gridPresets.portfolioOrders} flex minWidth="900px">
    <GridHeader>
      <GridCell align="left">Date</GridCell>
      <GridCell align="left">ID</GridCell>
      <GridCell align="left">Market</GridCell>
      <GridCell align="center">Side</GridCell>
      <GridCell align="center">Price</GridCell>
      <GridCell align="center">Amount</GridCell>
      <GridCell align="center">Output</GridCell>
    </GridHeader>

    {#each allOrdersWithContext as item (item.order.order_id)}
      {@const order = item.order}
      {@const isBuy = 'buy' in order.side}
      {@const inputToken = isBuy ? { symbol: item.quoteSymbol, logo: item.quoteLogo, decimals: item.quoteDecimals } : { symbol: item.baseSymbol, logo: item.baseLogo, decimals: item.baseDecimals }}
      {@const outputToken = isBuy ? { symbol: item.baseSymbol, logo: item.baseLogo, decimals: item.baseDecimals } : { symbol: item.quoteSymbol, logo: item.quoteLogo, decimals: item.quoteDecimals }}
      {@const inputFilled = isBuy ? order.quote_filled : order.base_filled}
      {@const inputTotal = isBuy ? order.quote_amount : order.base_amount}
      {@const outputReceived = isBuy ? order.base_filled : order.quote_filled}
      <GridRow clickable onclick={() => handleRowClick(order, item.spotCanisterId)}>
        <GridCell align="left" compact>
          <span class="timestamp">{formatTimestamp(order.timestamp)}</span>
        </GridCell>
        <GridCell align="left" compact>
          <span class="entity-id">#{order.order_id.toString()}</span>
        </GridCell>
        <GridCell align="left" compact>
          <span class="market-pair" use:ticker={item.spotCanisterId}>{item.baseSymbol}/{item.quoteSymbol}</span>
        </GridCell>
        <GridCell align="center" compact>
          <SideBadge side={order.side} />
        </GridCell>
        <GridCell align="right" compact>
          {formatTickPrice(order.tick, item.baseDecimals, item.quoteDecimals)}
        </GridCell>
        <GridCell align="right" compact>
          <div class="amount-with-fill">
            <div class="amount-cell">
              <span>{formatToken({ value: inputFilled, unitName: inputToken.decimals, displayDecimals: 4, commas: true })}/{formatToken({ value: inputTotal, unitName: inputToken.decimals, displayDecimals: 4, commas: true })}</span>
              <Logo src={inputToken.logo} alt={inputToken.symbol} size="xxs" circle={true} />
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                style="width: {getFilledPercentage(order)}%"
              ></div>
            </div>
          </div>
        </GridCell>
        <GridCell align="right" compact>
          <div class="amount-cell">
            <span class="text-bullish">+{formatToken({ value: outputReceived, unitName: outputToken.decimals, displayDecimals: 4, commas: true })}</span>
            <Logo src={outputToken.logo} alt={outputToken.symbol} size="xxs" circle={true} />
          </div>
        </GridCell>
      </GridRow>
    {:else}
      <div class="empty-state">
        <p class="empty-text">No open orders</p>
      </div>
    {/each}
  </GridTable>
</div>

{#if selectedSpot}
  <OrderDetailsModal
    bind:open={detailsModalOpen}
    order={selectedOrder}
    spot={selectedSpot}
    onClose={() => {
      detailsModalOpen = false;
      selectedOrder = null;
    }}
  />

  <EditOrderModal
    bind:open={editModalOpen}
    order={selectedOrder}
    spot={selectedSpot}
    onClose={() => {
      editModalOpen = false;
      selectedOrder = null;
    }}
    onSuccess={() => {
      editModalOpen = false;
      selectedOrder = null;
    }}
  />

  {#if selectedOrder}
    <ConfirmationModal
      bind:open={executeModalOpen}
      title="Execute at Market"
      orderDetail={convertOrderDetail}
      confirmLabel="Execute Now"
      variant="primary"
      showSkipOption
      onSkipPreferenceChange={(skip) => userPreferences.setSkipOrderConfirmation(skip)}
      onConfirm={handleConfirmExecute}
      onClose={() => {
        executeModalOpen = false;
        cachedQuote = null;
        selectedOrder = null;
      }}
      toastMessages={{
        loading: `Converting order #${selectedOrder!.order_id} to market...`,
        success: () => `Order #${selectedOrder!.order_id} executed at market`,
        error: (err) => err instanceof Error ? err.message : 'Failed to execute order',
      }}
    />

    <ConfirmationModal
      bind:open={cancelModalOpen}
      title="Cancel Order"
      confirmLabel="Cancel Order"
      variant="danger"
      showSkipOption
      onSkipPreferenceChange={(skip) => userPreferences.setSkipOrderConfirmation(skip)}
      onConfirm={handleConfirmCancel}
      onClose={() => {
        cancelModalOpen = false;
        selectedOrder = null;
      }}
      toastMessages={{
        loading: `Cancelling order #${selectedOrder.order_id}...`,
        success: `Order #${selectedOrder.order_id} cancelled`,
        error: (err) => err instanceof Error ? err.message : 'Failed to cancel order',
      }}
    />
  {/if}
{/if}

<style>
  .orders-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
    flex: 1;
    min-height: 0;
  }

  .timestamp {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .entity-id {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    font-variant-numeric: tabular-nums;
  }

  .market-pair {
    font-size: var(--font-size-orderbook);
    font-weight: 500;
    white-space: nowrap;
  }

  .amount-cell {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.375rem;
  }

  .text-bullish {
    color: var(--color-bullish);
  }

  .amount-with-fill {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 3px;
    width: 100%;
  }

  .progress-bar {
    width: 100%;
    height: 3px;
    background: var(--muted);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--primary);
    transition: width 0.2s ease;
  }

  .empty-state {
    padding: 24px;
    text-align: center;
  }

  .empty-text {
    font-size: 0.8125rem;
    color: var(--muted-foreground);
  }

</style>
