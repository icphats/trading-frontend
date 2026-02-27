<script lang="ts">
  import Button from "$lib/components/ui/Button.svelte";
  import ToggleGroup from "$lib/components/ui/ToggleGroup.svelte";
  import { TradePriceInput, TokenAmountInput } from "$lib/components/ui/inputs";
  import QuoteResult from "$lib/components/trade/shared/QuoteResult.svelte";
  import ConfirmationModal from "$lib/components/portal/modals/specific/ConfirmationModal.svelte";
  import type { NormalizedToken } from "$lib/types/entity.types";
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import type { Side, QuoteResult as QuoteResultType } from "$lib/actors/services/spot.service";
  import {
    tickToPrice,
    alignTickToSpacing,
    stringToBigInt,
    bigIntToString,
    bpsToPercent,
  } from "$lib/domain/markets/utils";
  import { toastState } from "$lib/state/portal/toast.state.svelte";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { userPreferences } from "$lib/domain/user";

  // ============================================
  // Constants (per 05-TradingOperations.md canon)
  // ============================================

  const DEBOUNCE_MS = 500;                  // Input debounce delay
  const PRICE_DEVIATION_THRESHOLD = 0.01;   // 1% - warn user if price changed

  interface Props {
    spot: SpotMarket;
    side: "Buy" | "Sell";
    openDepositBase?: () => void;
    openDepositQuote?: () => void;
  }

  let { spot, side, openDepositBase, openDepositQuote }: Props = $props();

  // ============================================
  // Derived Market Data (from spot)
  // ============================================

  let spotPrice = $derived(spot.spotPrice);
  let currentTick = $derived(spot.lastTradeTick);
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

  // Best bid/ask from order book (if available)
  let bestBidTick = $derived<number | undefined>(
    spot.marketDepth?.book_bids?.[0]?.tick
  );
  let bestAskTick = $derived<number | undefined>(
    spot.marketDepth?.book_asks?.[0]?.tick
  );

  // ============================================
  // Form State (owned by this component)
  // ============================================

  let limitTick = $state<number | null>(null);
  let isSubmitting = $state(false);
  let timeInForce = $state<"GTC" | "IOC">("GTC");

  // UI State
  let showConfirmation = $state(false);

  // Local state for bidirectional amount/total calculation
  let localAmount = $state("");
  let localTotal = $state("");
  let lastEditedField = $state<'amount' | 'total'>('amount');

  // Quote state (for displaying estimated fill %)
  let quoteResult = $state<QuoteResultType | null>(null);
  let quoteReferenceTick = $state<number | null>(null);
  let requestGeneration = 0;
  let isCalculating = $state(false);
  let quoteError = $state<string | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ============================================
  // Initialization
  // ============================================

  let hasInitialized = $state(false);
  $effect(() => {
    if (!hasInitialized && limitTick === null && currentTick !== null) {
      hasInitialized = true;
      // Set initial limit tick based on side
      if (side === "Buy" && bestAskTick !== undefined) {
        limitTick = bestAskTick;
      } else if (side === "Sell" && bestBidTick !== undefined) {
        limitTick = bestBidTick;
      } else {
        // Fallback to current market tick if best bid/ask not available
        limitTick = alignTickToSpacing(currentTick, tickSpacing, false);
      }
    }
  });

  // ============================================
  // Side Change Handling
  // ============================================

  let previousSide = $state(side);
  $effect(() => {
    if (side !== previousSide) {
      previousSide = side;

      // Clear debounce timer
      if (debounceTimer) clearTimeout(debounceTimer);

      // Reset inputs when side changes
      localAmount = "";
      localTotal = "";
      quoteResult = null;
      quoteReferenceTick = null;
      quoteError = null;
      isCalculating = false;
      timeInForce = "GTC";

      // Set limit tick based on new side
      if (side === "Buy" && bestAskTick !== undefined) {
        limitTick = bestAskTick;
      } else if (side === "Sell" && bestBidTick !== undefined) {
        limitTick = bestBidTick;
      } else if (currentTick !== null) {
        limitTick = alignTickToSpacing(currentTick, tickSpacing, false);
      }
    }
  });

  // ============================================
  // Quote Calculation (for displaying estimated fill %)
  // ============================================

  function scheduleQuoteCalculation() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => calculateQuote(), DEBOUNCE_MS);
  }

  async function calculateQuote() {
    if (!token0 || !token1) return;

    // Validate inputs
    if (!localAmount || limitTick === null) {
      quoteResult = null;
      quoteError = null;
      return;
    }

    // Validate amount format - for limit orders, input is always base amount
    const inputDecimals = side === "Buy" ? token1.decimals : token0.decimals;
    const inputValue = side === "Buy" ? localTotal : localAmount;

    if (!inputValue || inputValue.trim() === "") {
      quoteResult = null;
      quoteError = null;
      return;
    }

    let amountBigInt: bigint;
    try {
      amountBigInt = stringToBigInt(inputValue, inputDecimals);
      if (amountBigInt <= 0n) {
        quoteResult = null;
        quoteError = null;
        return;
      }
    } catch {
      quoteResult = null;
      quoteError = null;
      return;
    }

    // Request sequencing
    const thisGeneration = ++requestGeneration;

    isCalculating = true;
    quoteError = null;

    try {
      const sideVariant: Side = side === "Buy" ? { buy: null } : { sell: null };

      // Debug: Log what we're sending vs what we get back
      console.log('[SpotLimitOrder Quote Debug]', {
        side,
        amountBigInt: amountBigInt.toString(),
        limitTick,
        limitPrice: limitTick !== null ? tickToPrice(limitTick, spot.baseTokenDecimals, spot.quoteTokenDecimals) : null,
      });

      const result = await spot.quoteOrder(sideVariant, amountBigInt, limitTick);

      console.log('[SpotLimitOrder Quote Result]', {
        effective_tick: result.effective_tick,
        effectivePrice: tickToPrice(result.effective_tick, spot.baseTokenDecimals, spot.quoteTokenDecimals),
        input_amount: result.input_amount.toString(),
        output_amount: result.output_amount.toString(),
        venue_breakdown: result.venue_breakdown.map(v => ({
          venue: v.venue_id,
          input: v.input_amount.toString(),
          output: v.output_amount.toString()
        }))
      });

      // Only update if this is still the latest request
      if (thisGeneration !== requestGeneration) return;

      quoteResult = result;
      quoteReferenceTick = currentTick;
    } catch (err) {
      if (thisGeneration !== requestGeneration) return;

      console.error("Quote calculation failed:", err);
      quoteError = err instanceof Error ? err.message : "Failed to get quote";
      quoteResult = null;
      quoteReferenceTick = null;
    } finally {
      if (thisGeneration === requestGeneration) {
        isCalculating = false;
      }
    }
  }

  // Watch for input changes and trigger quote recalculation
  $effect(() => {
    const _amount = localAmount;
    const _total = localTotal;
    const _side = side;
    const _limitTick = limitTick;
    const _currentTick = currentTick; // Watch tick changes to refresh quote

    const inputValue = _side === "Buy" ? _total : _amount;
    const hasValidInput = !!(inputValue && inputValue.trim() !== "" && _limitTick !== null);

    if (hasValidInput) {
      // Set calculating immediately to prevent stale fill % display during debounce
      isCalculating = true;
      scheduleQuoteCalculation();
    } else {
      quoteResult = null;
      quoteReferenceTick = null;
      quoteError = null;
      isCalculating = false;
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });

  // ============================================
  // Derived Values
  // ============================================

  // Derive display price from limitTick for calculations
  const displayPrice = $derived.by(() => {
    if (limitTick === null) return null;
    return tickToPrice(limitTick, spot.baseTokenDecimals, spot.quoteTokenDecimals);
  });

  // Calculate total from amount when amount changes (only when editing amount)
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
  // Input Handlers
  // ============================================

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
      // Limit to token0 decimals to prevent "too many decimals" error
      const limitedAmount = amount.toFixed(token0.decimals).replace(/\.?0+$/, '');
      localAmount = limitedAmount;
    } else if (!val) {
      localAmount = "";
    }
  }

  function handleLimitTickUpdate(newTick: number | null) {
    limitTick = newTick;
  }

  // ============================================
  // Helper Functions (per 05-TradingOperations.md canon)
  // ============================================

  /** Get input balance based on side (per canon 4.6) */
  function getInputBalance(): bigint {
    // For BUY: spending token1 (quote)
    // For SELL: spending token0 (base)
    return side === "Buy" ? token1Balance : token0Balance;
  }

  /** Validate amount and return bigint (per canon 4.5) */
  function validateAmountInput(): { valid: boolean; error?: string; asBigInt?: bigint } {
    if (!token0 || !token1) return { valid: false, error: "Market not loaded" };

    // For BUY: validate total (quote amount being spent)
    // For SELL: validate amount (base amount being sold)
    const inputValue = side === "Buy" ? localTotal : localAmount;
    const inputDecimals = side === "Buy" ? token1.decimals : token0.decimals;
    const inputLabel = side === "Buy" ? "total" : "amount";

    if (!inputValue || inputValue.trim() === "") {
      return { valid: false, error: `${inputLabel} is required` };
    }

    try {
      const asBigInt = stringToBigInt(inputValue, inputDecimals);

      if (asBigInt <= 0n) {
        return { valid: false, error: `${inputLabel} must be greater than zero` };
      }

      // Balance check (per canon 4.6)
      const inputBalance = getInputBalance();
      if (asBigInt > inputBalance) {
        return { valid: false, error: "Insufficient balance" };
      }

      return { valid: true, asBigInt };
    } catch (e) {
      return { valid: false, error: e instanceof Error ? e.message : "Invalid amount" };
    }
  }

  /** Validate base amount for display purposes */
  function validateBaseAmount(): { valid: boolean; error?: string; asBigInt?: bigint } {
    if (!token0) return { valid: false, error: "Market not loaded" };

    if (!localAmount || localAmount.trim() === "") {
      return { valid: false, error: "Amount is required" };
    }

    try {
      const asBigInt = stringToBigInt(localAmount, token0.decimals);

      if (asBigInt <= 0n) {
        return { valid: false, error: "Amount must be greater than zero" };
      }

      return { valid: true, asBigInt };
    } catch (e) {
      return { valid: false, error: e instanceof Error ? e.message : "Invalid amount" };
    }
  }

  // ============================================
  // Form Submission
  // ============================================

  function handleSubmitClick() {
    if (!token0 || !token1) return;

    // Pre-flight check 1: Validate limit tick
    if (limitTick === null) {
      toastState.show({ message: "Invalid price", variant: "error" });
      return;
    }

    // Pre-flight check 2: Validate base amount (for display and order creation)
    const baseValidation = validateBaseAmount();
    if (!baseValidation.valid) {
      toastState.show({ message: baseValidation.error ?? "Invalid amount", variant: "error" });
      return;
    }

    // Pre-flight check 3: Validate input amount and balance (per canon 4.5, 4.6)
    const validation = validateAmountInput();
    if (!validation.valid || !validation.asBigInt) {
      toastState.show({ message: validation.error ?? "Invalid amount", variant: "error" });
      return;
    }

    if (userPreferences.skipOrderConfirmation) {
      // Skip confirmation — execute directly with async toast
      executeLimitOrderWithToast();
    } else {
      showConfirmation = true;
    }
  }

  async function executeLimitOrder() {
    if (!token0 || !token1) throw new Error("Market not loaded");
    if (limitTick === null) throw new Error("Invalid price");

    const validation = validateAmountInput();
    if (!validation.valid || !validation.asBigInt) throw new Error(validation.error ?? "Invalid amount");

    // Convert side
    const sideVariant: Side = side === "Buy" ? { buy: null } : { sell: null };

    // Step 1: Get quote to obtain pool_swaps + book_order
    const quote = await spot.quoteOrder(sideVariant, validation.asBigInt, limitTick);

    // Step 2: Build specs — override IOC based on time-in-force selection
    const isIOC = timeInForce === "IOC";
    const bookOrders = quote.book_order.length > 0
      ? [{ ...quote.book_order[0]!, immediate_or_cancel: isIOC }]
      : [];
    const poolSwaps = quote.pool_swaps;

    // Step 3: Create order via unified endpoint
    const result = await spot.createOrders([], bookOrders, poolSwaps);

    // Extract order_id from first order result for toast
    const firstOrder = result.order_results[0];
    const order_id = firstOrder && 'ok' in firstOrder.result
      ? firstOrder.result.ok.order_id
      : 0n;

    // Reset form on success only (per canon anti-pattern: don't clear on failure)
    localAmount = "";
    localTotal = "";

    return { order_id };
  }

  async function executeLimitOrderWithToast() {
    const baseSymbol = token0?.displaySymbol ?? '';
    isSubmitting = true;
    try {
      await toastState.show({
        async: true,
        promise: executeLimitOrder(),
        messages: {
          loading: `Placing ${side.toLowerCase()} limit order...`,
          success: (result) => `Order #${result.order_id} placed`,
          error: (err: any) => err?.message || 'Failed to place order'
        },
        data: {
          type: 'order',
          side,
          orderType: 'limit',
          symbol: baseSymbol,
          logo: token0?.logo ?? undefined
        },
        duration: 3000,
        toastPosition: 'bottom-right'
      });
    } catch (error) {
      // Error already shown in toast
      console.error('[SpotLimitOrder] Error:', error);
    } finally {
      isSubmitting = false;
    }
  }

  // Confirmation modal detail
  function buildVenueRouting(quote: QuoteResultType, requestedAmount: bigint) {
    if (!token0 || !token1) return undefined;
    const inputDecimals = side === "Buy" ? token1.decimals : token0.decimals;
    const outputDecimals = side === "Buy" ? token0.decimals : token1.decimals;
    const inputToken = side === "Buy" ? token1 : token0;
    const outputToken = side === "Buy" ? token0 : token1;

    const filledFromVenues = quote.venue_breakdown.reduce(
      (sum, v) => sum + Number(v.input_amount), 0
    );
    const fillPercent = requestedAmount > 0n
      ? Math.min(100, (filledFromVenues / Number(requestedAmount)) * 100)
      : 0;

    return {
      venues: quote.venue_breakdown
        .toSorted((a, b) => Number(b.input_amount) - Number(a.input_amount))
        .map(v => {
          const pct = Math.round((Number(v.input_amount) / Number(quote.input_amount)) * 100);
          const isBook = 'book' in v.venue_id;
          return {
            type: isBook ? 'book' as const : 'pool' as const,
            label: isBook ? 'Book' : `Pool-${'pool' in v.venue_id ? v.venue_id.pool / 100 : '?'}`,
            percent: pct,
            inputAmount: bigIntToString(v.input_amount, inputDecimals),
            outputAmount: bigIntToString(v.output_amount, outputDecimals),
            feeAmount: bigIntToString(v.fee_amount, inputDecimals),
          };
        }),
      fillPercent,
      totalFees: bigIntToString(quote.total_fees, inputDecimals),
      inputSymbol: inputToken.displaySymbol,
      inputLogo: inputToken.logo ?? undefined,
      outputSymbol: outputToken.displaySymbol,
      outputLogo: outputToken.logo ?? undefined,
    };
  }

  let confirmationDetail = $derived.by(() => {
    if (!token0 || !token1) return undefined;
    const priceStr = displayPrice !== null ? displayPrice.toFixed(8) : "";
    const rows = [
      { label: "Amount", value: `${localAmount} ${token0.displaySymbol}` },
      { label: "Price", value: `${priceStr} ${token1.displaySymbol}` }
    ];
    if (timeInForce === "IOC") {
      rows.push({ label: "Time in Force", value: "IOC" });
    }
    if (quoteResult) {
      const impactPct = bpsToPercent(quoteResult.price_impact_bps);
      rows.push({ label: "Price impact", value: impactPct < 0.01 ? '< 0.01%' : `${impactPct.toFixed(2)}%` });
    }
    return {
      side,
      baseSymbol: token0.displaySymbol,
      baseLogo: token0.logo ?? undefined,
      rows,
      routing: quoteResult ? buildVenueRouting(quoteResult, (() => {
        try {
          const inputDecimals = side === "Buy" ? token1!.decimals : token0!.decimals;
          const inputValue = side === "Buy" ? localTotal : localAmount;
          return inputValue ? stringToBigInt(inputValue, inputDecimals) : 0n;
        } catch { return 0n; }
      })()) : undefined,
    };
  });
</script>

{#if !token0 || !token1}
  <div class="p-4">
    <p class="text-muted-foreground text-sm">Loading market data...</p>
  </div>
{:else}
  <div class="p-4">
    <form class="space-y-3" onsubmit={(e) => e.preventDefault()}>
      <!-- Price Input -->
      <TradePriceInput
        label="Limit Price"
        tick={limitTick}
        currentPrice={spotPrice}
        token0Decimals={token0.decimals}
        token1Decimals={token1.decimals}
        {tickSpacing}
        disabled={isSubmitting}
        onTickChange={handleLimitTickUpdate}
      />

      <!-- Amount Input (token0 - base) -->
      <TokenAmountInput
        label={`Amount (${token0.displaySymbol})`}
        token={token0}
        balance={token0Balance}
        value={localAmount}
        onValueChange={handleAmountChange}
        disabled={isSubmitting}
        size="sm"
        showBalance
        onDepositClick={side === "Sell" ? openDepositBase : undefined}
      />

      <!-- Total Input (token1 - quote) -->
      <TokenAmountInput
        label={`Total (${token1.displaySymbol})`}
        token={token1}
        balance={token1Balance}
        value={localTotal}
        onValueChange={handleTotalChange}
        disabled={isSubmitting}
        showPresets={false}
        size="sm"
        showBalance
        onDepositClick={side === "Buy" ? openDepositQuote : undefined}
      />

      <!-- Quote Information (shows estimated fill %) -->
      <QuoteResult
        {isCalculating}
        {quoteError}
        quote={quoteResult}
        token0Symbol={token0.displaySymbol}
        token1Symbol={token1.displaySymbol}
        token0Decimals={token0.decimals}
        token1Decimals={token1.decimals}
        token0Logo={token0.logo ?? undefined}
        token1Logo={token1.logo ?? undefined}
        {side}
        referenceTick={quoteReferenceTick}
        currentTick={currentTick ?? undefined}
        inputAmount={(() => {
          if (!token0 || !token1) return undefined;
          const inputDecimals = side === "Buy" ? token1.decimals : token0.decimals;
          const inputValue = side === "Buy" ? localTotal : localAmount;
          if (!inputValue || inputValue.trim() === "") return undefined;
          try {
            return stringToBigInt(inputValue, inputDecimals);
          } catch {
            return undefined;
          }
        })()}
      />

      <!-- Time-in-Force Toggle -->
      <div class="flex items-center justify-between">
        <span class="text-xs text-muted-foreground">Time in Force</span>
        <ToggleGroup
          options={[
            { value: 'GTC', label: 'GTC', variant: 'purple' },
            { value: 'IOC', label: 'IOC', variant: 'purple' },
          ]}
          value={timeInForce}
          onValueChange={(val) => timeInForce = val as "GTC" | "IOC"}
          size="sm"
          disabled={isSubmitting}
          ariaLabel="Time in force"
        />
      </div>

      <!-- Action Button (per canon 7.1 - all conditions required) -->
      <Button
        type="button"
        variant={side === "Buy" ? "green" : "red"}
        size="lg"
        fullWidth
        class="mt-1"
        disabled={
          isSubmitting ||
          limitTick === null ||
          !localAmount ||
          localAmount.trim() === "" ||
          (side === "Buy" && (!localTotal || localTotal.trim() === ""))
        }
        onclick={handleSubmitClick}
      >
        {isSubmitting ? "Submitting..." : `${side} ${token0.displaySymbol}`}
      </Button>
    </form>

    <!-- Confirmation Modal (gated by userPreferences.skipOrderConfirmation) -->
    <ConfirmationModal
      bind:open={showConfirmation}
      title="Confirm Limit Order"
      orderDetail={confirmationDetail}
      confirmLabel={`${side} ${token0.displaySymbol}`}
      variant="primary"
      showSkipOption
      onSkipPreferenceChange={(skip) => userPreferences.setSkipOrderConfirmation(skip)}
      onConfirm={executeLimitOrder}
      toastMessages={{
        loading: `Placing ${side.toLowerCase()} limit order...`,
        success: (result) => `Order #${result.order_id} placed`,
        error: (err) => err instanceof Error ? err.message : "Failed to place order"
      }}
    />
  </div>
{/if}

