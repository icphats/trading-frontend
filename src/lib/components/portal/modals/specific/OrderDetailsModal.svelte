<script lang="ts">
  import type { OrderView, Side, QuoteResult } from "$lib/actors/services/spot.service";
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import Modal from "../Modal.svelte";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import { tickToPrice, priceToTick } from "$lib/domain/markets/utils";
  import { formatToken, formatSigFig } from "$lib/utils/format.utils";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { userPreferences } from "$lib/domain/user";

  interface Props {
    open: boolean;
    order: OrderView | null;
    spot: SpotMarket;
    onClose?: () => void;
    /** Called when user wants to execute at market — quote already fetched */
    onRequestExecute?: (order: OrderView, quote: QuoteResult) => void;
    /** Called when user wants to cancel the order */
    onRequestCancel?: (order: OrderView) => void;
    /** Called when user wants to edit the order */
    onRequestEdit?: (order: OrderView) => void;
  }

  let {
    open = $bindable(false),
    order,
    spot,
    onClose,
    onRequestExecute,
    onRequestCancel,
    onRequestEdit,
  }: Props = $props();

  let isQuoting = $state(false);

  // Derived order info
  const orderSide = $derived(order ? ('buy' in order.side ? 'Buy' : 'Sell') : '');
  const orderSideClass = $derived(order ? ('buy' in order.side ? 'buy' : 'sell') : '');

  const orderPrice = $derived.by(() => {
    if (!order) return '0';
    const price = tickToPrice(order.tick, spot.baseTokenDecimals, spot.quoteTokenDecimals);
    return formatSigFig(price, 5, { subscriptZeros: true });
  });

  const isBuy = $derived(order ? 'buy' in order.side : false);
  const inputDecimals = $derived(isBuy ? spot.quoteTokenDecimals : spot.baseTokenDecimals);

  const orderAmount = $derived.by(() => {
    if (!order) return '0';
    const amount = isBuy ? order.quote_amount : order.base_amount;
    return formatToken({ value: amount, unitName: inputDecimals, displayDecimals: 6, commas: true });
  });

  const remainingAmount = $derived.by(() => {
    if (!order) return '0';
    const total = isBuy ? order.quote_amount : order.base_amount;
    const filled = isBuy ? order.quote_filled : order.base_filled;
    return formatToken({ value: total - filled, unitName: inputDecimals, displayDecimals: 6, commas: true });
  });

  const filledAmount = $derived.by(() => {
    if (!order) return '0';
    const filled = isBuy ? order.quote_filled : order.base_filled;
    return formatToken({ value: filled, unitName: inputDecimals, displayDecimals: 6, commas: true });
  });

  const filledPercentage = $derived.by(() => {
    if (!order) return 0;
    if (isBuy) {
      if (order.quote_amount === 0n) return 0;
      return Number((order.quote_filled * 100n) / order.quote_amount);
    } else {
      if (order.base_amount === 0n) return 0;
      return Number((order.base_filled * 100n) / order.base_amount);
    }
  });

  const orderTimestamp = $derived.by(() => {
    if (!order) return '';
    const date = new Date(Number(order.timestamp));
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  });

  const orderIdDisplay = $derived(order ? order.order_id.toString() : '');

  // Token info for display
  const inputToken = $derived.by(() => {
    if (!spot.tokens?.[0] || !spot.tokens?.[1]) return undefined;
    return isBuy
      ? entityStore.getToken(spot.tokens[1].toString())
      : entityStore.getToken(spot.tokens[0].toString());
  });

  // Handlers
  function handleClose() {
    open = false;
    onClose?.();
  }

  function handleEditClick() {
    if (!order) return;
    open = false;
    onRequestEdit?.(order);
  }

  async function handleConvertClick() {
    if (!order) return;
    isQuoting = true;

    try {
      const sideVariant: Side = 'buy' in order.side ? { buy: null } : { sell: null };
      const remaining = isBuy
        ? order.quote_amount - order.quote_filled
        : order.base_amount - order.base_filled;
      const slippagePct = userPreferences.defaultSlippage / 100;
      const slippageMultiplier = isBuy ? 1 + slippagePct / 100 : 1 - slippagePct / 100;
      const slippagePrice = spot.spotPrice * slippageMultiplier;
      const slippageTick = priceToTick(slippagePrice, spot.baseTokenDecimals, spot.quoteTokenDecimals, spot.tickSpacing);

      const quote = await spot.quoteOrder(sideVariant, remaining, slippageTick);
      open = false;
      onRequestExecute?.(order, quote);
    } catch (err) {
      console.error('[OrderDetailsModal] Quote failed:', err);
    } finally {
      isQuoting = false;
    }
  }

  function handleCancelClick() {
    if (!order) return;
    open = false;
    onRequestCancel?.(order);
  }
</script>

<Modal bind:open onClose={handleClose} title="Order Details" size="sm" compactHeader={true}>
  {#snippet children()}
    {#if order}
      <div class="modal-body">
        <!-- Order Type Badge -->
        <div class="order-header">
          <span class="order-type {orderSideClass}">
            Limit {orderSide}
          </span>
          <span class="order-id">#{orderIdDisplay}</span>
        </div>

        <!-- Details Grid -->
        <div class="modal-panel">
          <div class="modal-detail-row">
            <span class="modal-detail-label">Price</span>
            <span class="modal-detail-value">{orderPrice}</span>
          </div>

          <div class="modal-detail-row">
            <span class="modal-detail-label">Total Amount</span>
            <span class="modal-detail-value">{orderAmount} {inputToken?.displaySymbol ?? ''}</span>
          </div>

          <div class="modal-detail-row">
            <span class="modal-detail-label">Remaining</span>
            <span class="modal-detail-value">{remainingAmount} {inputToken?.displaySymbol ?? ''}</span>
          </div>

          <div class="modal-detail-row">
            <span class="modal-detail-label">Filled</span>
            <span class="modal-detail-value">
              {filledAmount} {inputToken?.displaySymbol ?? ''}
              <span class="filled-pct">({filledPercentage.toFixed(1)}%)</span>
            </span>
          </div>

          <!-- Progress Bar -->
          <div class="progress-container">
            <div class="progress-bar">
              <div
                class="progress-fill"
                style="width: {filledPercentage}%"
              ></div>
            </div>
          </div>

          <div class="modal-detail-row">
            <span class="modal-detail-label">Created</span>
            <span class="modal-detail-value timestamp">{orderTimestamp}</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <div class="action-row">
            <ButtonV2
              variant="secondary"
              size="md"
              fullWidth
              onclick={handleEditClick}
            >
              Edit Order
            </ButtonV2>
            <ButtonV2
              variant="primary"
              size="md"
              fullWidth
              onclick={handleConvertClick}
              loading={isQuoting}
              disabled={isQuoting}
            >
              Execute at Market
            </ButtonV2>
          </div>
          <ButtonV2
            variant="danger"
            size="md"
            fullWidth
            onclick={handleCancelClick}
          >
            Cancel Order
          </ButtonV2>
        </div>
      </div>
    {:else}
      <div class="modal-empty">
        <p>No order selected</p>
      </div>
    {/if}
  {/snippet}
</Modal>

<style>
  /* Header specific to order details */
  .order-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .order-type {
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-sm);
  }

  .order-type.buy {
    background: oklch(from var(--color-bullish) l c h / 0.15);
    color: var(--color-bullish);
  }

  .order-type.sell {
    background: oklch(from var(--color-bearish) l c h / 0.15);
    color: var(--color-bearish);
  }

  .order-id {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }

  .filled-pct {
    color: var(--muted-foreground);
    margin-left: 0.25rem;
  }

  .timestamp {
    font-family: var(--font-sans);
    font-weight: 400;
  }

  /* Action Buttons */
  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .action-row {
    display: flex;
    gap: 0.5rem;
  }

  /* Progress Bar */
  .progress-container {
    padding-top: 0.25rem;
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: oklch(from var(--foreground) l c h / 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--primary);
    transition: width 0.2s ease;
  }
</style>
