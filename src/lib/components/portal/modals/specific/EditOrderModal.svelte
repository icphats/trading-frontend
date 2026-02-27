<script lang="ts">
  import type { OrderView } from "$lib/actors/services/spot.service";
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import type { NormalizedToken } from "$lib/types/entity.types";
  import Modal from "../Modal.svelte";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import { TradePriceInput, TokenAmountInput } from "$lib/components/ui/inputs";
  import { tickToPrice, stringToBigInt, bigIntToString } from "$lib/domain/markets/utils";
  import { formatSigFig } from "$lib/utils/format.utils";
  import { toastState } from "$lib/state/portal/toast.state.svelte";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";

  interface Props {
    open: boolean;
    order: OrderView | null;
    spot: SpotMarket;
    onClose?: () => void;
    onSuccess?: () => void;
  }

  let {
    open = $bindable(false),
    order,
    spot,
    onClose,
    onSuccess
  }: Props = $props();

  // ============================================
  // Form State
  // ============================================

  let limitTick = $state<number | null>(null);
  let localAmount = $state("");
  let localTotal = $state("");
  let lastEditedField = $state<'amount' | 'total'>('amount');


  // ============================================
  // Derived Market Data
  // ============================================

  let spotPrice = $derived(spot.spotPrice);
  let tickSpacing = $derived(spot.tickSpacing);

  // Token data from entityStore
  let token0 = $derived<NormalizedToken | undefined>(
    spot.tokens?.[0] ? entityStore.getToken(spot.tokens[0].toString()) : undefined
  );
  let token1 = $derived<NormalizedToken | undefined>(
    spot.tokens?.[1] ? entityStore.getToken(spot.tokens[1].toString()) : undefined
  );

  // Trading balances (deposited in spot canister, available for orders)
  let token0Balance = $derived<bigint>(spot.availableBase);
  let token1Balance = $derived<bigint>(spot.availableQuote);

  // Read-only side from order
  const orderSide = $derived(order ? ('buy' in order.side ? 'Buy' : 'Sell') : 'Buy');
  const orderSideClass = $derived(orderSide.toLowerCase());

  // ============================================
  // Initialize Form When Modal Opens
  // ============================================

  $effect(() => {
    if (open && order) {
      // Set tick from order
      limitTick = order.tick;

      const isBuy = 'buy' in order.side;

      if (isBuy && token1) {
        lastEditedField = 'total';
        const remaining = order.quote_amount - order.quote_filled;
        localTotal = bigIntToString(remaining, token1.decimals);
        // localAmount will be computed by the bidirectional effect
      } else if (token0) {
        lastEditedField = 'amount';
        const remaining = order.base_amount - order.base_filled;
        localAmount = bigIntToString(remaining, token0.decimals);
        // localTotal will be computed by the bidirectional effect
      }
    }
  });

  // ============================================
  // Bidirectional Amount/Total Calculation
  // ============================================

  // Calculate total from amount when amount changes
  $effect(() => {
    if (lastEditedField !== 'amount' || !token1) return;

    if (displayPrice !== null && displayPrice > 0 && localAmount && parseFloat(localAmount) > 0) {
      const total = parseFloat(localAmount) * displayPrice;
      localTotal = total.toFixed(token1.decimals).replace(/\.?0+$/, '');
    } else {
      localTotal = "";
    }
  });

  // ============================================
  // Derived Display Values
  // ============================================

  const displayPrice = $derived.by(() => {
    if (limitTick === null) return null;
    return tickToPrice(limitTick, spot.baseTokenDecimals, spot.quoteTokenDecimals);
  });

  const originalOrderSummary = $derived.by(() => {
    if (!order || !token0 || !token1) return '';
    const isBuy = 'buy' in order.side;
    const originalSide = isBuy ? 'Buy' : 'Sell';
    const originalPrice = formatSigFig(tickToPrice(order.tick, spot.baseTokenDecimals, spot.quoteTokenDecimals));
    const inputToken = isBuy ? token1 : token0;
    const total = isBuy ? order.quote_amount : order.base_amount;
    const filled = isBuy ? order.quote_filled : order.base_filled;
    const remaining = total - filled;
    const originalAmount = bigIntToString(remaining, inputToken.decimals);
    return `${originalSide} ${originalAmount} ${inputToken.displaySymbol} @ $${originalPrice}`;
  });

  const newOrderSummary = $derived.by(() => {
    if (!token0 || !token1 || limitTick === null) return '';
    const isBuy = order ? 'buy' in order.side : false;
    const newPrice = formatSigFig(tickToPrice(limitTick, spot.baseTokenDecimals, spot.quoteTokenDecimals));
    const inputToken = isBuy ? token1 : token0;
    const inputValue = isBuy ? localTotal : localAmount;
    if (!inputValue) return '';
    return `${orderSide} ${inputValue} ${inputToken.displaySymbol} @ $${newPrice}`;
  });

  // ============================================
  // Validation
  // ============================================

  const canSubmit = $derived.by(() => {
    if (limitTick === null || !token0 || !token1) return false;
    const isBuy = order ? 'buy' in order.side : false;
    const inputValue = isBuy ? localTotal : localAmount;
    return !!(inputValue && parseFloat(inputValue) > 0);
  });

  // ============================================
  // Handlers
  // ============================================

  function handleClose() {
    open = false;
    onClose?.();
  }

  function handleLimitTickUpdate(newTick: number) {
    limitTick = newTick;
  }

  function handleAmountChange(val: string) {
    lastEditedField = 'amount';
    localAmount = val;
  }

  function handleTotalChange(val: string) {
    if (!token0) return;
    lastEditedField = 'total';
    localTotal = val;

    if (displayPrice !== null && displayPrice > 0 && val && parseFloat(val) > 0) {
      const amount = parseFloat(val) / displayPrice;
      localAmount = amount.toFixed(token0.decimals).replace(/\.?0+$/, '');
    } else if (!val) {
      localAmount = "";
    }
  }

  async function handleSubmit() {
    if (!order || !token0 || !token1) return;

    const isBuy = 'buy' in order.side;
    const inputValue = isBuy ? localTotal : localAmount;
    const inputDecimals = isBuy ? token1.decimals : token0.decimals;

    if (!inputValue || parseFloat(inputValue) <= 0) {
      toastState.show({ message: 'Invalid amount', variant: 'error', duration: 3000 });
      return;
    }
    if (limitTick === null) {
      toastState.show({ message: 'Invalid price', variant: 'error', duration: 3000 });
      return;
    }

    const amountBigInt = stringToBigInt(inputValue, inputDecimals);
    const baseSymbol = token0.displaySymbol;
    const baseLogo = token0.logo ?? undefined;

    // Close immediately — toast handles loading/success/error feedback
    open = false;

    try {
      await toastState.show({
        async: true,
        promise: spot.updateOrder(order.order_id, limitTick!, amountBigInt),
        messages: {
          loading: 'Updating order...',
          success: (result: any) => result.wasReplaced
            ? `Order #${result.order_id} placed`
            : `Order #${result.order_id} updated`,
          error: (err: any) => err?.message || 'Failed to update order'
        },
        data: {
          type: 'order' as const,
          side: orderSide as 'Buy' | 'Sell',
          orderType: 'limit' as const,
          symbol: baseSymbol,
          logo: baseLogo
        },
        duration: 3000
      });
      onSuccess?.();
    } catch (error) {
      console.error('[EditOrderModal] Error:', error);
    }
  }
</script>

<Modal bind:open onClose={handleClose} title="Edit Order" size="sm" compactHeader={true}>
  {#snippet children()}
    {#if order && token0 && token1}
      <div class="modal-body">
        <!-- Side Display (read-only) -->
        <div class="side-display">
          <span class="side-badge {orderSideClass}">
            Limit {orderSide}
          </span>
        </div>

        <!-- Price Input -->
        <div class="modal-form-section">
          <TradePriceInput
            label="Limit Price"
            tick={limitTick}
            currentPrice={spotPrice}
            token0Decimals={token0.decimals}
            token1Decimals={token1.decimals}
            {tickSpacing}

            onTickChange={handleLimitTickUpdate}
          />
        </div>

        <!-- Amount Input (token0 - base) -->
        <div class="modal-form-section">
          <TokenAmountInput
            label={`Amount (${token0.displaySymbol})`}
            token={token0}
            balance={token0Balance}
            value={localAmount}
            onValueChange={handleAmountChange}

            size="sm"
          />
        </div>

        <!-- Total Input (token1 - quote) -->
        <div class="modal-form-section">
          <TokenAmountInput
            label={`Total (${token1.displaySymbol})`}
            token={token1}
            balance={token1Balance}
            value={localTotal}
            onValueChange={handleTotalChange}

            showPresets={false}
            size="sm"
          />
        </div>

        <!-- Order Comparison -->
        <div class="modal-panel comparison-section">
          <div class="comparison-row">
            <span class="comparison-label">Current Order:</span>
            <span class="comparison-value original">{originalOrderSummary}</span>
          </div>
          <div class="comparison-arrow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M19 12l-7 7-7-7"/>
            </svg>
          </div>
          <div class="comparison-row">
            <span class="comparison-label">New Order:</span>
            <span class="comparison-value new {orderSideClass}">{newOrderSummary || '\u2014'}</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="modal-actions">
          <ButtonV2
            variant="secondary"
            size="md"
            fullWidth
            onclick={handleClose}
          >
            Back
          </ButtonV2>
          <ButtonV2
            variant="primary"
            size="md"
            fullWidth
            onclick={handleSubmit}
            disabled={!canSubmit}
          >
            Update Order
          </ButtonV2>
        </div>
      </div>
    {:else}
      <div class="modal-empty">
        <p>Loading order data...</p>
      </div>
    {/if}
  {/snippet}
</Modal>

<style>
  /* Side Display */
  .side-display {
    display: flex;
    align-items: center;
  }

  .side-badge {
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-sm);
  }

  .side-badge.buy {
    background: oklch(from var(--color-bullish) l c h / 0.15);
    color: var(--color-bullish);
  }

  .side-badge.sell {
    background: oklch(from var(--color-bearish) l c h / 0.15);
    color: var(--color-bearish);
  }

  /* Comparison Section */
  .comparison-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .comparison-label {
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }

  .comparison-value {
    font-size: 0.75rem;
    font-family: var(--font-mono);
    color: var(--foreground);
  }

  .comparison-value.original {
    color: var(--muted-foreground);
    text-decoration: line-through;
  }

  .comparison-value.new.buy {
    color: var(--color-bullish);
  }

  .comparison-value.new.sell {
    color: var(--color-bearish);
  }

  .comparison-arrow {
    display: flex;
    justify-content: center;
    color: var(--muted-foreground);
  }
</style>
