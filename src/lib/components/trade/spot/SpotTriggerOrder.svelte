<script lang="ts">
  import Button from "$lib/components/ui/Button.svelte";
  import { TradePriceInput, TokenAmountInput } from "$lib/components/ui/inputs";
  import ToggleGroup from "$lib/components/ui/ToggleGroup.svelte";
  import ConfirmationModal from "$lib/components/portal/modals/specific/ConfirmationModal.svelte";
  import type { ToggleOption } from "$lib/components/ui/ToggleGroup.svelte";
  import type { NormalizedToken } from "$lib/types/entity.types";
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import type { Side } from "$lib/actors/services/spot.service";
  import {
    tickToPrice,
    stringToBigInt,
    alignTickToSpacing,
  } from "$lib/domain/markets/utils";
  import { formatSigFig } from "$lib/utils/format.utils";
  import { toastState } from "$lib/state/portal/toast.state.svelte";
  import { userPreferences } from "$lib/domain/user";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";

  interface Props {
    spot: SpotMarket;
    openDepositBase?: () => void;
    openDepositQuote?: () => void;
  }

  let { spot, openDepositBase, openDepositQuote }: Props = $props();

  // ============================================
  // Derived Market Data (from spot)
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

  // Best bid from order book (if available)
  let bestBidTick = $derived<number | undefined>(
    spot.marketDepth?.book_bids?.[0]?.tick
  );

  // ============================================
  // Form State (owned by this component)
  // ============================================

  let showConfirmation = $state(false);
  let side = $state<"Buy" | "Sell">("Buy");
  let triggerTick = $state<number | null>(null);
  let triggerOrderType = $state<"market" | "limit">("market");
  let limitTick = $state<number | null>(null);
  let amount = $state("");
  let isSubmitting = $state(false);

  // ============================================
  // Initialization & Reactive Updates
  // ============================================

  // Initialize trigger tick on first load
  let hasInitializedTrigger = $state(false);
  $effect(() => {
    if (!hasInitializedTrigger && triggerTick === null && currentTick !== null && currentTick !== 0) {
      hasInitializedTrigger = true;
      triggerTick = alignTickToSpacing(currentTick, tickSpacing, false);
    }
  });

  // Initialize/update limitTick when triggerTick is set and limitTick is null (for limit mode only)
  // For market mode, TradePriceInput handles initialization via initialSlippagePercent
  $effect(() => {
    if (triggerTick !== null && limitTick === null && triggerOrderType === "limit") {
      limitTick = calculateLimitTick(triggerTick, triggerOrderType);
    }
  });

  // Helper to calculate appropriate limitTick based on context
  function calculateLimitTick(
    baseTick: number,
    orderType: "market" | "limit"
  ): number | null {
    if (orderType === "limit") {
      // For limit orders, start at the trigger price
      return baseTick;
    } else {
      // For market orders, return null to let TradePriceInput auto-initialize
      // with initialSlippagePercent using proper directional rounding
      return null;
    }
  }

  // ============================================
  // Derived Values
  // ============================================

  const triggerPrice = $derived.by(() => {
    if (triggerTick === null) return null;
    return tickToPrice(triggerTick, spot.baseTokenDecimals, spot.quoteTokenDecimals);
  });

  const limitPrice = $derived.by(() => {
    if (limitTick === null) return null;
    return tickToPrice(limitTick, spot.baseTokenDecimals, spot.quoteTokenDecimals);
  });

  // ============================================
  // Toggle Options
  // ============================================

  const sideOptions: ToggleOption<"Buy" | "Sell">[] = [
    { value: "Buy", label: "Buy", variant: "green" },
    { value: "Sell", label: "Sell", variant: "red" },
  ];

  const orderTypeOptions: ToggleOption<"market" | "limit">[] = [
    { value: "market", label: "Market", variant: "purple" },
    { value: "limit", label: "Limit", variant: "purple" },
  ];

  // ============================================
  // Input Handlers
  // ============================================

  function handleSideChange(newSide: "Buy" | "Sell") {
    const previousSide = side;
    side = newSide;

    // When in slippage mode (market), reset limitTick to null
    // so TradePriceInput can re-initialize with correct directional rounding
    if (triggerOrderType === "market" && previousSide !== newSide) {
      limitTick = null;
    }
  }

  function handleOrderTypeChange(type: "market" | "limit") {
    const previousType = triggerOrderType;
    triggerOrderType = type;

    // Reset limitTick when switching order types
    // - limit mode: will be set to triggerTick by effect
    // - market mode: will be auto-initialized by TradePriceInput with initialSlippagePercent
    if (previousType !== type) {
      limitTick = null;
    }
  }

  function handleTriggerTickUpdate(newTick: number | null) {
    triggerTick = newTick;
  }

  function handleLimitTickUpdate(newTick: number | null) {
    limitTick = newTick;
  }

  // ============================================
  // Form Submission
  // ============================================

  function handleSubmitClick() {
    if (!base || !quote) return;

    // Validate inputs
    if (!amount || parseFloat(amount) <= 0) {
      toastState.show({ message: "Invalid amount", variant: "error", duration: 3000 });
      return;
    }
    if (triggerTick === null) {
      toastState.show({ message: "Invalid trigger price", variant: "error", duration: 3000 });
      return;
    }
    if (limitTick === null) {
      toastState.show({
        message: triggerOrderType === "limit" ? "Invalid limit price" : "Invalid slippage price",
        variant: "error",
        duration: 3000,
      });
      return;
    }

    if (userPreferences.skipOrderConfirmation) {
      executeTriggerOrderWithToast();
    } else {
      showConfirmation = true;
    }
  }

  async function executeTriggerOrder() {
    if (!base || !quote) throw new Error("Market not loaded");
    if (triggerTick === null || limitTick === null) throw new Error("Invalid trigger price");

    const inputDecimals = side === "Buy" ? quote.decimals : base.decimals;
    const amountBigInt = stringToBigInt(amount, inputDecimals);
    const sideVariant: Side = side === "Buy" ? { buy: null } : { sell: null };

    const result = await spot.createTriggers([], [{
      side: sideVariant,
      trigger_tick: triggerTick,
      input_amount: amountBigInt,
      limit_tick: limitTick,
      immediate_or_cancel: triggerOrderType === "market",
      reference_tick: currentTick!,
    }]);

    // Reset form on success
    amount = "";

    const firstResult = result.results[0];
    const trigger_id = firstResult && 'ok' in firstResult.result
      ? firstResult.result.ok.trigger_id : 0n;
    return { trigger_id };
  }

  async function executeTriggerOrderWithToast() {
    const baseSymbol = base?.displaySymbol ?? '';
    isSubmitting = true;
    try {
      await toastState.show({
        async: true,
        promise: executeTriggerOrder(),
        messages: {
          loading: `Creating ${side.toLowerCase()} trigger...`,
          success: (result) => `Trigger #${result.trigger_id} created`,
          error: (err: any) => err?.message || "Failed to place trigger order",
        },
        data: {
          type: 'order',
          side,
          orderType: 'trigger',
          symbol: baseSymbol,
          logo: base?.logo ?? undefined
        },
        duration: 3000,
        toastPosition: "bottom-right",
      });
    } catch (error) {
      console.error("[SpotTriggerOrder] Error:", error);
    } finally {
      isSubmitting = false;
    }
  }

  // Confirmation modal detail
  // Direction derived from trigger tick vs current tick
  const triggerDirection = $derived.by((): 'above' | 'below' => {
    if (triggerTick === null || currentTick === null || currentTick === 0) return 'above';
    return triggerTick >= currentTick ? 'above' : 'below';
  });

  let confirmationDetail = $derived.by(() => {
    if (!base || !quote) return undefined;
    const triggerPriceStr = triggerPrice !== null ? formatSigFig(triggerPrice) : "";
    const inputToken = side === "Buy" ? quote : base;
    const directionVerb = triggerDirection === 'above' ? 'rises above' : 'falls below';
    return {
      side,
      baseSymbol: base.displaySymbol,
      baseLogo: base.logo ?? undefined,
      condition: { text: `When price ${directionVerb} $${triggerPriceStr}`, direction: triggerDirection },
      rows: [
        { label: "Amount", value: amount, logo: inputToken.logo ?? undefined },
        { label: "Execution", value: triggerOrderType === "market" ? "Market" : "Limit" }
      ]
    };
  });
</script>

{#if !base || !quote}
  <div class="p-4">
    <p class="text-muted-foreground text-sm">Loading market data...</p>
  </div>
{:else}
  <div class="p-4">
    <form class="space-y-3" onsubmit={(e) => e.preventDefault()}>
      <!-- Buy/Sell Selector -->
      <div class="mb-3">
        <ToggleGroup
          options={sideOptions}
          value={side}
          onValueChange={(value) => handleSideChange(value as "Buy" | "Sell")}
          size="md"
          fullWidth
          disabled={isSubmitting}
          ariaLabel="Select order side"
        />
      </div>

      <!-- Trigger Price Input -->
      <TradePriceInput
        label="Trigger Price"
        tick={triggerTick}
        currentPrice={spotPrice}
        baseDecimals={base.decimals}
        quoteDecimals={quote.decimals}
        {tickSpacing}
        disabled={isSubmitting}
        onTickChange={handleTriggerTickUpdate}
      />

      <!-- Order Type Selector (Market vs Limit) -->
      <div class="mb-3">
        <ToggleGroup
          options={orderTypeOptions}
          value={triggerOrderType}
          onValueChange={(value) => handleOrderTypeChange(value as "market" | "limit")}
          size="md"
          fullWidth
          disabled={isSubmitting}
          ariaLabel="Select order type"
        />
      </div>

      <!-- Limit/Slippage Price Input with Quick Adjust -->
      <!-- Key forces re-mount when order type or side changes to reset initialization -->
      {#key `${triggerOrderType}-${side}`}
        <TradePriceInput
          label={triggerOrderType === "limit" ? "Limit Price" : "Max Slippage"}
          tick={limitTick}
          currentPrice={triggerPrice ?? spotPrice}
          baseDecimals={base.decimals}
          quoteDecimals={quote.decimals}
          {tickSpacing}
          disabled={isSubmitting}
          onTickChange={handleLimitTickUpdate}
          allowNegativeSlippage={triggerOrderType === "limit"}
          {side}
          initialDisplayMode={triggerOrderType === "limit" ? "price" : "percentage"}
          initialSlippagePercent={triggerOrderType === "market" ? userPreferences.defaultSlippage / 100 : undefined}
        />
      {/key}

      <!-- Amount Input -->
      <TokenAmountInput
        label={`Amount (${side === "Buy" ? quote.displaySymbol : base.displaySymbol})`}
        token={side === "Buy" ? quote : base}
        balance={side === "Buy" ? quoteBalance : baseBalance}
        value={amount}
        onValueChange={(val) => amount = val}
        disabled={isSubmitting}
        size="sm"
        showBalance
        onDepositClick={side === "Buy" ? openDepositQuote : openDepositBase}
      />

      <!-- Action Button -->
      <div class="flex gap-2">
        <Button
          type="button"
          variant={side === "Buy" ? "green" : "red"}
          size="md"
          fullWidth
          disabled={isSubmitting || !amount || parseFloat(amount) <= 0 || triggerTick === null || limitTick === null}
          onclick={handleSubmitClick}
        >
          {isSubmitting ? "Submitting..." : `Place ${side} Trigger`}
        </Button>
      </div>
    </form>

    <!-- Confirmation Modal (gated by userPreferences.skipOrderConfirmation) -->
    <ConfirmationModal
      bind:open={showConfirmation}
      title="Confirm Trigger"
      orderDetail={confirmationDetail}
      confirmLabel={`Place ${side} Trigger`}
      variant="primary"
      showSkipOption
      onSkipPreferenceChange={(skip) => userPreferences.setSkipOrderConfirmation(skip)}
      onConfirm={executeTriggerOrder}
      toastMessages={{
        loading: `Creating ${side.toLowerCase()} trigger...`,
        success: (result) => `Trigger #${result.trigger_id} created`,
        error: (err) => err instanceof Error ? err.message : "Failed to place trigger order"
      }}
    />
  </div>
{/if}

