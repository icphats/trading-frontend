<script lang="ts">
  import Button from "$lib/components/ui/Button.svelte";
  import { TradePriceInput, TokenAmountInput } from "$lib/components/ui/inputs";
  import QuoteResult from "$lib/components/trade/shared/QuoteResult.svelte";
  import ConfirmationModal from "$lib/components/portal/modals/specific/ConfirmationModal.svelte";
  import type { NormalizedToken } from "$lib/types/entity.types";
  import type { QuoteResult as QuoteResultType, Side } from "$lib/actors/services/spot.service";
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import {
    stringToBigInt,
    bigIntToString,
    bpsToPercent,
  } from "$lib/domain/markets/utils";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { userPreferences } from "$lib/domain/user";
  import { toastState } from "$lib/state/portal/toast.state.svelte";

  // ============================================
  // Constants (per 05-TradingOperations.md canon)
  // ============================================

  const QUOTE_TTL_MS = 15_000;              // 15 seconds - quote freshness window
  const QUOTE_REFRESH_MS = 7_500;           // TTL/2 - proactive refresh threshold
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

  // ============================================
  // Form State (owned by this component)
  // ============================================

  let amount = $state("");
  let isSubmitting = $state(false);

  // UI State
  let showConfirmation = $state(false);

  // Limit tick state for slippage protection
  let limitTick = $state<number | null>(null);

  // Quote state (per 05-TradingOperations.md canon)
  let quoteResult = $state<QuoteResultType | null>(null);
  let quoteTimestamp = $state(0);           // When quote was received (Date.now())
  let requestGeneration = 0;                 // Monotonic counter for request sequencing
  let isCalculating = $state(false);
  let quoteError = $state<string | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ============================================
  // Side Change Handling
  // ============================================

  let previousSide = $state(side);
  $effect(() => {
    if (side !== previousSide) {
      previousSide = side;

      // Clear debounce timer
      if (debounceTimer) clearTimeout(debounceTimer);

      // Reset ALL quote-related state atomically (per canon 6.4)
      amount = "";
      quoteResult = null;
      quoteTimestamp = 0;
      quoteReferenceTick = null;
      quoteError = null;
      isCalculating = false;
      limitTick = null; // Reset to trigger re-initialization in TradePriceInput
    }
  });

  // ============================================
  // Quote Calculation
  // ============================================

  function scheduleQuoteCalculation() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => calculateQuote(), DEBOUNCE_MS);
  }

  async function calculateQuote() {
    if (!token0 || !token1) return;

    // Validate inputs using stringToBigInt (per canon 4.5)
    if (!amount || limitTick === null) {
      quoteResult = null;
      quoteTimestamp = 0;
      quoteError = null;
      return;
    }

    // Validate amount format
    const inputDecimals = side === "Buy" ? token1.decimals : token0.decimals;
    let amountBigInt: bigint;
    try {
      amountBigInt = stringToBigInt(amount, inputDecimals);
      if (amountBigInt <= 0n) {
        quoteResult = null;
        quoteTimestamp = 0;
        quoteError = null;
        return;
      }
    } catch {
      quoteResult = null;
      quoteTimestamp = 0;
      quoteError = null;
      return;
    }

    // Request sequencing - increment generation (per canon 4.4)
    const thisGeneration = ++requestGeneration;

    isCalculating = true;
    quoteError = null;

    try {
      // Convert side
      const sideVariant: Side = side === "Buy" ? { buy: null } : { sell: null };

      // Call market.quoteOrder (which uses repository internally)
      const result = await spot.quoteOrder(sideVariant, amountBigInt, limitTick);

      // Only update if this is still the latest request (per canon 4.4)
      if (thisGeneration !== requestGeneration) return;

      quoteResult = result;
      quoteTimestamp = Date.now();
      quoteReferenceTick = currentTick;
    } catch (err) {
      // Only update if this is still the latest request
      if (thisGeneration !== requestGeneration) return;

      console.error("Quote calculation failed:", err);
      quoteError = err instanceof Error ? err.message : "Failed to get quote";
      quoteResult = null;
      quoteTimestamp = 0;
      quoteReferenceTick = null;
    } finally {
      // Only update if this is still the latest request
      if (thisGeneration === requestGeneration) {
        isCalculating = false;
      }
    }
  }

  // Track the tick at which the current quote was calculated
  let quoteReferenceTick = $state<number | null>(null);

  // Watch for input changes and trigger quote recalculation
  $effect(() => {
    // Track dependencies explicitly
    const _amount = amount;
    const _side = side;
    const _limitTick = limitTick;
    const _currentTick = currentTick; // Watch tick changes to refresh quote

    // Check if we have valid input to trigger quote
    const hasValidInput = !!(_amount && _amount.trim() !== "" && _limitTick !== null);

    if (hasValidInput) {
      // Set calculating immediately to prevent stale fill % display during debounce
      isCalculating = true;
      scheduleQuoteCalculation();
    } else {
      quoteResult = null;
      quoteTimestamp = 0;
      quoteError = null;
      quoteReferenceTick = null;
      isCalculating = false;
    }

    // Cleanup: clear debounce timer on unmount or re-run (per canon 7.3)
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });

  // ============================================
  // Derived Display Values
  // ============================================

  let amountOutFormatted = $derived.by(() => {
    if (!quoteResult || !token0 || !token1) return "0";
    const outputDecimals = side === "Buy" ? token0.decimals : token1.decimals;
    return bigIntToString(quoteResult.output_amount, outputDecimals);
  });

  // ============================================
  // Limit Price Management
  // ============================================

  // TradePriceInput handles initialization via initialSlippagePercent prop
  function handleLimitTickChange(newTick: number) {
    limitTick = newTick;
  }

  // ============================================
  // Helper Functions (per 05-TradingOperations.md canon)
  // ============================================

  /** Check if quote is within TTL (per canon 4.1) */
  function isQuoteFresh(): boolean {
    return quoteTimestamp > 0 && (Date.now() - quoteTimestamp) < QUOTE_TTL_MS;
  }

  /** Check if quote needs proactive refresh (per canon 7.2) */
  function needsProactiveRefresh(): boolean {
    return quoteTimestamp > 0 && (Date.now() - quoteTimestamp) > QUOTE_REFRESH_MS;
  }

  /** Check price deviation after re-quote (per canon 5.3) */
  function checkPriceDeviation(oldOutput: bigint, newOutput: bigint): { changed: boolean; percent: number } {
    if (oldOutput === 0n) return { changed: false, percent: 0 };
    const percent = Math.abs(Number(newOutput - oldOutput)) / Number(oldOutput);
    return { changed: percent > PRICE_DEVIATION_THRESHOLD, percent };
  }

  /** Get input balance based on side (per canon 4.6) */
  function getInputBalance(): bigint {
    return side === "Buy" ? token1Balance : token0Balance;
  }

  /** Validate amount and return bigint (per canon 4.5) */
  function validateAmountInput(): { valid: boolean; error?: string; asBigInt?: bigint } {
    if (!token0 || !token1) return { valid: false, error: "Market not loaded" };
    if (!amount || amount.trim() === "") return { valid: false, error: "Amount is required" };

    const inputDecimals = side === "Buy" ? token1.decimals : token0.decimals;

    try {
      const asBigInt = stringToBigInt(amount, inputDecimals);

      if (asBigInt <= 0n) {
        return { valid: false, error: "Amount must be greater than zero" };
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

  // ============================================
  // Form Submission
  // ============================================

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (quoteError) return;
    if (!quoteResult) return; // Per canon 4.3 - quote must exist

    if (userPreferences.skipOrderConfirmation) {
      // Skip confirmation modal — execute directly with async toast
      await executeWithToast();
    } else {
      showConfirmation = true;
    }
  }

  async function executeWithToast() {
    const baseSymbol = token0?.displaySymbol ?? '';
    try {
      await toastState.show({
        async: true,
        promise: handleSubmitMarketOrder(),
        messages: {
          loading: `${side === 'Buy' ? 'Buying' : 'Selling'} ${baseSymbol}...`,
          success: (result) => `Order #${result.order_id} filled`,
          error: (err: unknown) => err instanceof Error ? err.message : "Failed to execute market order"
        },
        data: {
          type: 'order',
          side,
          orderType: 'market',
          symbol: baseSymbol,
          logo: token0?.logo ?? undefined
        },
        duration: 3000,
        toastPosition: 'bottom-right'
      });
    } catch {
      // Error already shown by toast
    }
  }

  async function handleSubmitMarketOrder() {
    if (!token0 || !token1) throw new Error("Market not loaded");

    // Pre-flight check 1: Quote exists (per canon 4.3)
    if (!quoteResult) {
      throw new Error("No quote available. Please try again.");
    }

    // Pre-flight check 2: Validate amount and balance (per canon 4.5, 4.6)
    const validation = validateAmountInput();
    if (!validation.valid || !validation.asBigInt) {
      throw new Error(validation.error ?? "Invalid amount");
    }

    // Pre-flight check 3: Quote freshness with auto-refresh (per canon 4.1)
    if (!isQuoteFresh()) {
      const oldOutput = quoteResult.output_amount;

      // Re-quote before proceeding
      await calculateQuote();

      if (!quoteResult) {
        throw new Error("Failed to refresh quote. Please try again.");
      }

      // Check price deviation (per canon 5.3)
      const { changed, percent } = checkPriceDeviation(oldOutput, quoteResult.output_amount);
      if (changed) {
        toastState.show({ message: `Price changed by ${(percent * 100).toFixed(1)}%`, variant: "warning" });
        // User can still proceed - they see the updated quote
      }
    }

    try {
      isSubmitting = true;

      // Build specs from quote for unified create_orders endpoint
      const bookOrders = quoteResult.book_order.length > 0
        ? [{ ...quoteResult.book_order[0]!, immediate_or_cancel: true }]
        : [];
      const poolSwaps = quoteResult.pool_swaps;

      // Execute via unified create_orders (market = IOC book order + pool swaps)
      const result = await spot.createOrders([], bookOrders, poolSwaps);

      // Extract order_id from first order result for toast
      const firstOrder = result.order_results[0];
      const order_id = firstOrder && 'ok' in firstOrder.result
        ? firstOrder.result.ok.order_id
        : 0n;

      // Reset form on success only (per canon anti-pattern: don't clear on failure)
      amount = "";
      quoteResult = null;
      quoteTimestamp = 0;

      return { order_id };
    } catch (error) {
      console.error("SpotMarketOrder: Error submitting market order:", error);
      throw error; // Let ConfirmationModal handle the toast
    } finally {
      isSubmitting = false;
    }
  }

  // ============================================
  // Confirmation Message
  // ============================================

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
    const inputAmt = parseFloat(amount) || 0;
    const rows = side === "Buy"
      ? [
          { label: "Spend", value: `${inputAmt} ${token1.displaySymbol}` },
          { label: "Receive", value: `~${amountOutFormatted} ${token0.displaySymbol}` }
        ]
      : [
          { label: "Sell", value: `${inputAmt} ${token0.displaySymbol}` },
          { label: "Receive", value: `~${amountOutFormatted} ${token1.displaySymbol}` }
        ];
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
          return stringToBigInt(amount, inputDecimals);
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
    <form onsubmit={handleSubmit} class="space-y-3">
      <!-- Market Price Display -->
      <TradePriceInput
        label="Market Price"
        tick={currentTick}
        token0Decimals={token0.decimals}
        token1Decimals={token1.decimals}
        readonly
        suffix="{token1.displaySymbol}/{token0.displaySymbol}"
      />

      <!-- Amount Input (token1 for buy, token0 for sell) -->
      <TokenAmountInput
        label={side === "Buy" ? `Amount to Spend` : `Amount to Sell`}
        token={side === "Buy" ? token1 : token0}
        balance={side === "Buy" ? token1Balance : token0Balance}
        value={amount}
        onValueChange={(val) => amount = val}
        disabled={isSubmitting}
        loading={isCalculating}
        error={quoteError ?? undefined}
        size="sm"
        showBalance
        onDepositClick={side === "Buy" ? openDepositQuote : openDepositBase}
      />

      <!-- Output Display (token0 for buy, token1 for sell) -->
      <TokenAmountInput
        label="You'll Receive"
        token={side === "Buy" ? token0 : token1}
        value={amountOutFormatted}
        loading={isCalculating}
        readonly
        showPresets={false}
        size="sm"
      />

      <!-- Limit Price with Quick Adjust (Slippage Protection) -->
      <!-- Key forces re-mount when side changes to reset initialization -->
      {#key side}
        <TradePriceInput
          label="Max Slippage"
          tick={limitTick}
          currentPrice={spotPrice}
          token0Decimals={token0.decimals}
          token1Decimals={token1.decimals}
          {tickSpacing}
          disabled={isSubmitting}
          onTickChange={handleLimitTickChange}
          allowNegativeSlippage={false}
          {side}
          initialDisplayMode="percentage"
          initialSlippagePercent={userPreferences.defaultSlippage / 100}
        />
      {/key}

      <!-- Quote Information -->
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
          if (!amount || !token0 || !token1) return undefined;
          try {
            const inputDecimals = side === "Buy" ? token1.decimals : token0.decimals;
            return stringToBigInt(amount, inputDecimals);
          } catch {
            return undefined;
          }
        })()}
      />

      <!-- Action Button (per canon 7.1 - all conditions required) -->
      <div class="flex gap-2">
        <Button
          type="submit"
          variant={side === "Buy" ? "green" : "red"}
          size="md"
          fullWidth
          disabled={
            isSubmitting ||
            isCalculating ||
            !amount ||
            amount.trim() === "" ||
            quoteResult === null ||
            !!quoteError
          }
        >
          {isSubmitting ? "Submitting..." : `${side} ${token0.displaySymbol}`}
        </Button>
      </div>
    </form>

    <!-- Confirmation Modal -->
    <ConfirmationModal
      bind:open={showConfirmation}
      title="Confirm Market Order"
      orderDetail={confirmationDetail}
      confirmLabel={`${side} ${token0.displaySymbol}`}
      variant="primary"
      showSkipOption
      onSkipPreferenceChange={(skip) => userPreferences.setSkipOrderConfirmation(skip)}
      onConfirm={() => handleSubmitMarketOrder()}
      toastMessages={{
        loading: `${side === 'Buy' ? 'Buying' : 'Selling'} ${token0.displaySymbol}...`,
        success: (result) => `Order #${result.order_id} filled`,
        error: (err) => err instanceof Error ? err.message : "Failed to execute market order"
      }}
    />
  </div>
{/if}
