<script lang="ts">
  import type { TriggerView, Side } from "$lib/actors/services/spot.service";
  import { getTriggerLabel } from "$lib/utils/trigger.utils";
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import type { NormalizedToken } from "$lib/types/entity.types";
  import type { ToggleOption } from "$lib/components/ui/ToggleGroup.svelte";
  import Modal from "../Modal.svelte";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import ToggleGroup from "$lib/components/ui/ToggleGroup.svelte";
  import { TradePriceInput, TokenAmountInput } from "$lib/components/ui/inputs";
  import {
    tickToPrice,
    stringToBigInt,
    bigIntToString,
  } from "$lib/domain/markets/utils";
  import { formatSigFig } from "$lib/utils/format.utils";
  import { toastState } from "$lib/state/portal/toast.state.svelte";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { userPreferences } from "$lib/domain/user";

  interface Props {
    open: boolean;
    trigger: TriggerView | null;
    spot: SpotMarket;
    onClose?: () => void;
    onSuccess?: () => void;
  }

  let {
    open = $bindable(false),
    trigger,
    spot,
    onClose,
    onSuccess
  }: Props = $props();

  // ============================================
  // Form State
  // ============================================

  let triggerTick = $state<number | null>(null);
  let triggerOrderType = $state<"market" | "limit">("market");
  let limitTick = $state<number | null>(null);
  let localAmount = $state("");


  // Read-only side from trigger (side preserved from original trigger)
  const side = $derived<"Buy" | "Sell">(trigger ? ('buy' in trigger.side ? 'Buy' : 'Sell') : 'Buy');
  const sideClass = $derived(side.toLowerCase());

  // ============================================
  // Derived Market Data
  // ============================================

  let spotPrice = $derived(spot.spotPrice);
  let currentTick = $derived(spot.lastBookTick);
  let tickSpacing = $derived(spot.tickSpacing);

  // Token data from entityStore
  let base = $derived<NormalizedToken | undefined>(
    spot.tokens?.[0] ? entityStore.getToken(spot.tokens[0].toString()) : undefined
  );
  let quote = $derived<NormalizedToken | undefined>(
    spot.tokens?.[1] ? entityStore.getToken(spot.tokens[1].toString()) : undefined
  );

  // Trading balances (deposited in spot canister, available for orders)
  let baseBalance = $derived<bigint>(spot.availableBase);
  let quoteBalance = $derived<bigint>(spot.availableQuote);

  // ============================================
  // Toggle Options
  // ============================================

  const orderTypeOptions: ToggleOption<"market" | "limit">[] = [
    { value: "market", label: "Market", variant: "purple" },
    { value: "limit", label: "Limit", variant: "purple" },
  ];

  // ============================================
  // Initialize Form When Modal Opens
  // ============================================

  $effect(() => {
    if (open && trigger) {
      // Set trigger tick from trigger
      triggerTick = trigger.trigger_tick;

      // Set order type from immediate_or_cancel
      triggerOrderType = trigger.immediate_or_cancel ? 'market' : 'limit';

      // Set limit tick from trigger
      limitTick = trigger.limit_tick;

      // Set amount from trigger (input_amount: quote for BUY, base for SELL)
      const inputDecimals = 'buy' in trigger.side
        ? (quote?.decimals ?? 8)
        : (base?.decimals ?? 8);
      localAmount = bigIntToString(trigger.input_amount, inputDecimals);
    }
  });

  // Initialize/update limitTick when triggerTick is set and limitTick is null (for limit mode only)
  // For market mode, TradePriceInput handles initialization via initialSlippagePercent
  $effect(() => {
    if (triggerTick !== null && limitTick === null && triggerOrderType === "limit") {
      limitTick = triggerTick;
    }
  });

  // ============================================
  // Derived Display Values
  // ============================================

  const triggerPrice = $derived.by(() => {
    if (triggerTick === null) return null;
    return tickToPrice(triggerTick, spot.baseTokenDecimals, spot.quoteTokenDecimals);
  });

  const originalTriggerTypeLabel = $derived(trigger ? getTriggerLabel(trigger.side, trigger.trigger_type) : '');

  const originalTriggerSummary = $derived.by(() => {
    if (!trigger || !base || !quote) return '';
    const originalPrice = formatSigFig(tickToPrice(trigger.trigger_tick, spot.baseTokenDecimals, spot.quoteTokenDecimals));
    // input_amount: quote for BUY, base for SELL
    const inputToken = 'buy' in trigger.side ? quote : base;
    const originalAmount = bigIntToString(trigger.input_amount, inputToken.decimals);
    return `${originalTriggerTypeLabel} ${originalAmount} ${inputToken.displaySymbol} @ $${originalPrice}`;
  });

  const newTriggerSummary = $derived.by(() => {
    if (!base || !quote || triggerTick === null || !localAmount) return '';
    const newPrice = formatSigFig(tickToPrice(triggerTick, spot.baseTokenDecimals, spot.quoteTokenDecimals));
    const inputSymbol = side === 'Buy' ? quote.displaySymbol : base.displaySymbol;
    const orderType = triggerOrderType === 'market' ? 'Market' : 'Limit';
    return `${side} ${localAmount} ${inputSymbol} @ $${newPrice} (${orderType})`;
  });


  // ============================================
  // Handlers
  // ============================================

  function handleClose() {
    open = false;
    onClose?.();
  }

  function handleTriggerTickUpdate(newTick: number | null) {
    triggerTick = newTick;
  }

  function handleLimitTickUpdate(newTick: number | null) {
    limitTick = newTick;
  }

  function handleAmountChange(val: string) {
    localAmount = val;
  }

  function handleOrderTypeChange(type: "market" | "limit") {
    const previousType = triggerOrderType;
    triggerOrderType = type;
    // Reset limitTick when switching - {#key} remount handles re-initialization
    if (previousType !== type) {
      limitTick = null;
    }
  }

  async function handleSubmit() {
    if (!trigger || !base || !quote) return;

    // Validate inputs
    if (!localAmount || parseFloat(localAmount) <= 0) {
      toastState.show({
        message: 'Invalid amount',
        variant: 'error',
        duration: 3000
      });
      return;
    }
    if (triggerTick === null) {
      toastState.show({
        message: 'Invalid trigger price',
        variant: 'error',
        duration: 3000
      });
      return;
    }
    if (limitTick === null) {
      toastState.show({
        message: triggerOrderType === 'limit' ? 'Invalid limit price' : 'Invalid slippage price',
        variant: 'error',
        duration: 3000
      });
      return;
    }

    // Get input amount (side is immutable — read from trigger)
    const inputDecimals = side === 'Buy' ? quote.decimals : base.decimals;
    const amountBigInt = stringToBigInt(localAmount, inputDecimals);
    const baseSymbol = base.displaySymbol;
    const baseLogo = base.logo ?? undefined;

    // Close immediately — toast handles loading/success/error feedback
    open = false;

    try {
      // Atomic cancel + create via unified createTriggers
      const sideVariant: Side = side === 'Buy' ? { buy: null } : { sell: null };
      const createPromise = spot.createTriggers(
        [BigInt(trigger.trigger_id)],
        [{
          side: sideVariant,
          trigger_tick: triggerTick!,
          input_amount: amountBigInt,
          limit_tick: limitTick!,
          immediate_or_cancel: triggerOrderType === 'market',
          reference_tick: currentTick!,
        }]
      ).then(result => {
        const firstResult = result.results[0];
        const trigger_id = firstResult && 'ok' in firstResult.result
          ? firstResult.result.ok.trigger_id : 0n;
        return { trigger_id };
      });
      await toastState.show({
        async: true,
        promise: createPromise,
        messages: {
          loading: 'Updating trigger...',
          success: (result: any) => `Trigger #${result.trigger_id} updated`,
          error: (err: any) => err?.message || 'Failed to update trigger'
        },
        data: {
          type: 'order' as const,
          side,
          orderType: 'trigger' as const,
          symbol: baseSymbol,
          logo: baseLogo
        },
        duration: 3000
      });

      onSuccess?.();
    } catch (error) {
      console.error('[EditTriggerModal] Error:', error);
    }
  }

  // Validation
  const canSubmit = $derived(
    localAmount &&
    parseFloat(localAmount) > 0 &&
    triggerTick !== null &&
    limitTick !== null &&
    base &&
    quote
  );
</script>

<Modal bind:open onClose={handleClose} title="Edit Trigger" size="md" compactHeader={true}>
  {#snippet children()}
    {#if trigger && base && quote}
      <div class="modal-body">
        <!-- Side Display (read-only — backend doesn't support side changes) -->
        <div class="side-display">
          <span class="side-badge {sideClass}">
            {originalTriggerTypeLabel}
          </span>
        </div>

        <!-- Trigger Price Input -->
        <div class="modal-form-section">
          <TradePriceInput
            label="Trigger Price"
            tick={triggerTick}
            currentPrice={spotPrice}
            baseDecimals={base.decimals}
            quoteDecimals={quote.decimals}
            {tickSpacing}

            onTickChange={handleTriggerTickUpdate}
          />
        </div>

        <!-- Order Type Selector -->
        <div class="modal-form-section">
          <label class="modal-form-label">When Triggered</label>
          <ToggleGroup
            options={orderTypeOptions}
            value={triggerOrderType}
            onValueChange={(value) => handleOrderTypeChange(value as "market" | "limit")}
            size="md"
            fullWidth
            ariaLabel="Select order type"
          />
        </div>

        <!-- Limit/Slippage Price Input with Quick Adjust -->
        <div class="modal-form-section">
          {#key triggerOrderType}
            <TradePriceInput
              label={triggerOrderType === "limit" ? "Limit Price" : "Max Slippage"}
              tick={limitTick}
              currentPrice={triggerPrice ?? spotPrice}
              baseDecimals={base.decimals}
              quoteDecimals={quote.decimals}
              {tickSpacing}
  
              onTickChange={handleLimitTickUpdate}
              allowNegativeSlippage={triggerOrderType === "limit"}
              {side}
              initialDisplayMode={triggerOrderType === "limit" ? "price" : "percentage"}
              initialSlippagePercent={triggerOrderType === "market" ? userPreferences.defaultSlippage / 100 : undefined}
            />
          {/key}
        </div>

        <!-- Amount Input -->
        <div class="modal-form-section">
          <TokenAmountInput
            label={`Amount (${side === "Buy" ? quote.displaySymbol : base.displaySymbol})`}
            token={side === "Buy" ? quote : base}
            balance={side === "Buy" ? quoteBalance : baseBalance}
            value={localAmount}
            onValueChange={handleAmountChange}

            size="sm"
          />
        </div>

        <!-- Trigger Comparison -->
        <div class="modal-panel comparison-section">
          <div class="comparison-row">
            <span class="comparison-label">Current Trigger:</span>
            <span class="comparison-value original">{originalTriggerSummary}</span>
          </div>
          <div class="comparison-arrow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M19 12l-7 7-7-7"/>
            </svg>
          </div>
          <div class="comparison-row">
            <span class="comparison-label">New Trigger:</span>
            <span class="comparison-value new {sideClass}">{newTriggerSummary || '—'}</span>
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
            Update Trigger
          </ButtonV2>
        </div>
      </div>
    {:else}
      <div class="modal-empty">
        <p>Loading trigger data...</p>
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
