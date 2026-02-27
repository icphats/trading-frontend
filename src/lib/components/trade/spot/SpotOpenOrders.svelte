<script lang="ts">
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import type { OrderView, Side, QuoteResult } from "$lib/actors/services/spot.service";
  import { tickToPrice, priceToTick, bigIntToString, bpsToPercent } from "$lib/domain/markets/utils";
  import { formatToken, formatSigFig, formatTimestamp } from "$lib/utils/format.utils";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { userPreferences } from "$lib/domain/user";
  import OrderDetailsModal from "$lib/components/portal/modals/specific/OrderDetailsModal.svelte";
  import EditOrderModal from "$lib/components/portal/modals/specific/EditOrderModal.svelte";
  import ConfirmationModal from "$lib/components/portal/modals/specific/ConfirmationModal.svelte";
  import { GridTable, GridHeader, GridRow, GridCell, gridPresets, SideBadge } from "$lib/components/ui/table";
  import { Logo } from "$lib/components/ui";
  import Button from "$lib/components/ui/Button.svelte";
  import { toastState } from "$lib/state/portal/toast.state.svelte";

  let { spot }: { spot: SpotMarket } = $props();

  // Derive token info from the current market
  const market = $derived(entityStore.getMarket(spot.canister_id));
  const baseToken = $derived(market?.baseToken ? entityStore.getToken(market.baseToken) : null);
  const quoteToken = $derived(market?.quoteToken ? entityStore.getToken(market.quoteToken) : null);
  const baseDecimals = $derived(baseToken?.decimals ?? 8);
  const quoteDecimals = $derived(quoteToken?.decimals ?? 8);
  const baseSymbol = $derived(baseToken?.displaySymbol ?? 'TOKEN');
  const quoteSymbol = $derived(quoteToken?.displaySymbol ?? 'QUOTE');
  const baseLogo = $derived(baseToken?.logo ?? undefined);
  const quoteLogo = $derived(quoteToken?.logo ?? undefined);

  // Orders for this market only, sorted newest first
  const orders = $derived(
    [...spot.userOrders].sort((a, b) => Number(b.timestamp - a.timestamp))
  );

  // ============================================
  // Modal State
  // ============================================

  let detailsModalOpen = $state(false);
  let editModalOpen = $state(false);
  let executeModalOpen = $state(false);
  let cancelModalOpen = $state(false);
  let selectedOrder = $state<OrderView | null>(null);
  let cachedQuote = $state<QuoteResult | null>(null);
  let executingOrderId = $state<bigint | null>(null);
  let cancellingOrderId = $state<bigint | null>(null);

  /** Tracks whether the sub-modal was opened from OrderDetailsModal (Back returns to details) */
  let enteredFromDetails = $state(false);

  // ============================================
  // Shared Quote Logic
  // ============================================

  async function fetchQuote(order: OrderView) {
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

  // ============================================
  // Rich Confirmation Details
  // ============================================

  const convertOrderDetail = $derived.by(() => {
    if (!selectedOrder || !baseToken || !quoteToken) return undefined;

    const isBuy = 'buy' in selectedOrder.side;
    const inToken = isBuy ? quoteToken : baseToken;
    const outToken = isBuy ? baseToken : quoteToken;
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
      baseSymbol: baseToken.displaySymbol,
      baseLogo: baseToken.logo ?? undefined,
      rows,
      routing,
    };
  });

  const cancelOrderDetail = $derived.by(() => {
    if (!selectedOrder || !baseToken || !quoteToken) return undefined;
    const isBuy = 'buy' in selectedOrder.side;
    const inputTkn = isBuy ? quoteToken : baseToken;
    const inputDec = isBuy ? quoteDecimals : baseDecimals;
    const total = isBuy ? selectedOrder.quote_amount : selectedOrder.base_amount;
    const filled = isBuy ? selectedOrder.quote_filled : selectedOrder.base_filled;
    const remaining = total - filled;
    const filledPct = total === 0n ? 0 : Number((filled * 100n) / total);
    const price = tickToPrice(selectedOrder.tick, baseDecimals, quoteDecimals);

    return {
      side: (isBuy ? 'Buy' : 'Sell') as 'Buy' | 'Sell',
      baseSymbol: baseSymbol,
      baseLogo,
      rows: [
        { label: 'Price', value: formatSigFig(price, 5, { subscriptZeros: true }) },
        { label: 'Remaining', value: `${formatToken({ value: remaining, unitName: inputDec, displayDecimals: 6, commas: true })} ${inputTkn.displaySymbol}` },
        { label: 'Filled', value: `${formatToken({ value: filled, unitName: inputDec, displayDecimals: 6, commas: true })} (${filledPct.toFixed(1)}%)` },
      ]
    };
  });

  // ============================================
  // Poll for fresh quotes while execute modal is open
  // ============================================

  $effect(() => {
    if (!executeModalOpen || !selectedOrder) return;
    const order = selectedOrder;

    const interval = setInterval(async () => {
      try {
        cachedQuote = await fetchQuote(order);
      } catch (err) {
        console.error('[SpotOpenOrders] Quote refresh failed:', err);
      }
    }, 5_000);

    return () => clearInterval(interval);
  });

  // ============================================
  // Row Click → Details Modal
  // ============================================

  function handleRowClick(order: OrderView) {
    selectedOrder = order;
    detailsModalOpen = true;
  }

  // ============================================
  // Inline Button Handlers (skip details modal)
  // ============================================

  async function handleExecute(e: MouseEvent, order: OrderView) {
    e.stopPropagation();
    executingOrderId = order.order_id;

    try {
      const quote = await fetchQuote(order);
      await executeConvertToMarket(order, quote);
    } catch (err) {
      toastState.show({
        message: err instanceof Error ? err.message : 'Failed to get quote',
        variant: 'error',
      });
      executingOrderId = null;
    }
  }

  async function handleCancel(e: MouseEvent, order: OrderView) {
    e.stopPropagation();
    cancellingOrderId = order.order_id;
    try {
      await executeCancelOrder(order);
    } finally {
      cancellingOrderId = null;
    }
  }

  // ============================================
  // OrderDetailsModal Callbacks (from details → sub-modal)
  // ============================================

  function handleDetailsExecute(order: OrderView, quote: QuoteResult) {
    enteredFromDetails = true;
    selectedOrder = order;
    cachedQuote = quote;
    executeModalOpen = true;
  }

  function handleDetailsCancel(order: OrderView) {
    enteredFromDetails = true;
    selectedOrder = order;
    cancelModalOpen = true;
  }

  function handleDetailsEdit(order: OrderView) {
    enteredFromDetails = true;
    selectedOrder = order;
    editModalOpen = true;
  }

  // ============================================
  // Sub-Modal Navigation
  // ============================================

  function handleSubModalBack() {
    editModalOpen = false;
    executeModalOpen = false;
    cancelModalOpen = false;
    cachedQuote = null;

    if (enteredFromDetails) {
      detailsModalOpen = true;
    } else {
      selectedOrder = null;
    }
  }

  function handleSubModalSuccess() {
    editModalOpen = false;
    executeModalOpen = false;
    cancelModalOpen = false;
    detailsModalOpen = false;
    cachedQuote = null;
    selectedOrder = null;
  }

  function handleEditSuccess() {
    editModalOpen = false;
    detailsModalOpen = false;
    selectedOrder = null;
  }

  // ============================================
  // Direct Execution (skip confirmation)
  // ============================================

  function buildCreateOrdersFromQuote(quote: QuoteResult, orderId?: bigint) {
    const bookOrders = quote.book_order.length > 0
      ? [{ ...quote.book_order[0]!, immediate_or_cancel: true }]
      : [];
    const cancelIds = orderId !== undefined ? [orderId] : [];
    return spot.createOrders(cancelIds, bookOrders, quote.pool_swaps);
  }

  async function executeConvertToMarket(order: OrderView, quote: QuoteResult) {
    const isBuy = 'buy' in order.side;
    try {
      await toastState.show({
        async: true,
        promise: buildCreateOrdersFromQuote(quote, order.order_id),
        messages: {
          loading: `Converting order #${order.order_id} to market...`,
          success: () => `Order #${order.order_id} executed at market`,
          error: (err: unknown) => err instanceof Error ? err.message : 'Failed to execute order',
        },
        data: {
          type: 'order',
          side: isBuy ? 'Buy' : 'Sell',
          orderType: 'market',
          symbol: baseSymbol,
          logo: baseLogo,
        },
        duration: 3000,
        toastPosition: 'bottom-right',
      });
    } finally {
      executingOrderId = null;
    }
  }

  async function executeCancelOrder(order: OrderView) {
    await toastState.show({
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
        symbol: baseSymbol,
        logo: baseLogo,
      },
      duration: 3000,
      toastPosition: 'bottom-right',
    });
  }

  // ============================================
  // Confirmation Handlers
  // ============================================

  async function handleConfirmExecute() {
    if (!selectedOrder || !cachedQuote) return;
    return await buildCreateOrdersFromQuote(cachedQuote, selectedOrder.order_id);
  }

  async function handleConfirmCancel() {
    if (!selectedOrder) return;
    try {
      await spot.cancelOrder(selectedOrder.order_id);
    } catch (err) {
      throw err;
    }
  }

  // ============================================
  // Helpers
  // ============================================

  function formatTickPrice(tick: number): string {
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

<GridTable columns={gridPresets.openOrders}>
  <GridHeader>
    <GridCell align="left">Date</GridCell>
    <GridCell align="left">ID</GridCell>
    <GridCell align="center">Side</GridCell>
    <GridCell align="center">Price</GridCell>
    <GridCell align="center">Amount</GridCell>
    <GridCell align="center">Output</GridCell>
    <GridCell align="center">Actions</GridCell>
  </GridHeader>

  {#each orders as order (order.order_id)}
    {@const isBuy = 'buy' in order.side}
    {@const inputToken = isBuy ? { symbol: quoteSymbol, logo: quoteLogo, decimals: quoteDecimals } : { symbol: baseSymbol, logo: baseLogo, decimals: baseDecimals }}
    {@const outputToken = isBuy ? { symbol: baseSymbol, logo: baseLogo, decimals: baseDecimals } : { symbol: quoteSymbol, logo: quoteLogo, decimals: quoteDecimals }}
    {@const inputFilled = isBuy ? order.quote_filled : order.base_filled}
    {@const inputTotal = isBuy ? order.quote_amount : order.base_amount}
    {@const outputReceived = isBuy ? order.base_filled : order.quote_filled}
    <GridRow clickable onclick={() => handleRowClick(order)}>
      <GridCell align="left" compact>
        <span class="timestamp">{formatTimestamp(order.timestamp)}</span>
      </GridCell>
      <GridCell align="left" compact>
        <span class="entity-id">#{order.order_id.toString()}</span>
      </GridCell>
      <GridCell align="center" compact>
        <SideBadge side={order.side} />
      </GridCell>
      <GridCell align="right" compact>
        {formatTickPrice(order.tick)}
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
      <GridCell align="center" compact>
        <div class="actions-cell">
          <Button size="sm" variant="blue" loading={executingOrderId === order.order_id} onclick={(e) => handleExecute(e, order)}>Execute</Button>
          <Button size="sm" variant="red" loading={cancellingOrderId === order.order_id} onclick={(e) => handleCancel(e, order)}>Cancel</Button>
        </div>
      </GridCell>
    </GridRow>
  {:else}
    <div class="empty-state">
      <p class="empty-text">No open orders</p>
    </div>
  {/each}
</GridTable>

<!-- Details Modal (display only — actions delegate back here) -->
<OrderDetailsModal
  bind:open={detailsModalOpen}
  order={selectedOrder}
  {spot}
  onClose={() => {
    detailsModalOpen = false;
    selectedOrder = null;
  }}
  onRequestExecute={handleDetailsExecute}
  onRequestCancel={handleDetailsCancel}
  onRequestEdit={handleDetailsEdit}
/>

<!-- Edit Order Modal -->
<EditOrderModal
  bind:open={editModalOpen}
  order={selectedOrder}
  {spot}
  onClose={handleSubModalBack}
  onSuccess={handleEditSuccess}
/>

<!-- Execute & Cancel Confirmation Modals (shared by both inline + details paths) -->
{#if selectedOrder}
  <ConfirmationModal
    bind:open={executeModalOpen}
    title="Execute at Market"
    orderDetail={convertOrderDetail}
    confirmLabel="Execute Now"
    cancelLabel="Back"
    variant="primary"
    showSkipOption
    onSkipPreferenceChange={(skip) => userPreferences.setSkipOrderConfirmation(skip)}
    onConfirm={handleConfirmExecute}
    onClose={handleSubModalBack}
    onSuccess={handleSubModalSuccess}
    toastMessages={{
      loading: `Converting order #${selectedOrder!.order_id} to market...`,
      success: () => `Order #${selectedOrder!.order_id} executed at market`,
      error: (err) => err instanceof Error ? err.message : 'Failed to execute order',
    }}
  />

  <ConfirmationModal
    bind:open={cancelModalOpen}
    title="Cancel Order"
    orderDetail={cancelOrderDetail}
    confirmLabel="Cancel Order"
    cancelLabel="Back"
    variant="danger"
    showSkipOption
    onSkipPreferenceChange={(skip) => userPreferences.setSkipOrderConfirmation(skip)}
    onConfirm={handleConfirmCancel}
    onClose={handleSubModalBack}
    onSuccess={handleSubModalSuccess}
    toastMessages={{
      loading: `Cancelling order #${selectedOrder.order_id}...`,
      success: `Order #${selectedOrder.order_id} cancelled`,
      error: (err) => err instanceof Error ? err.message : 'Failed to cancel order',
    }}
  />
{/if}

<style>
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

  .amount-cell {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.375rem;
  }

  .text-bullish {
    color: var(--color-bullish);
  }

  .empty-state {
    padding: 24px;
    text-align: center;
  }

  .empty-text {
    font-size: 0.8125rem;
    color: var(--muted-foreground);
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

  .actions-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
</style>
