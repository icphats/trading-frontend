<!--
  @deprecated Use PriceInput from $lib/components/ui/inputs instead.
  This component lacks decimal awareness and proper $ vs % toggle.
-->
<script lang="ts">
  import {
    priceToTick,
    tickToPrice,
    alignTickToSpacing,
    MIN_TICK,
    MAX_TICK
  } from "$lib/domain/markets/utils";

  interface Props {
    limitTick: number | null;
    tickSpacing: number;
    currentTick: number;
    spotPrice: number;
    baseSymbol: string; // Base token symbol
    quoteSymbol: string; // Quote token symbol
    disabled: boolean;
    onUpdate: (tick: number | null) => void;
    label?: string;
    showCurrentPrice?: boolean;
    showPriceDifference?: boolean;
  }

  let {
    limitTick = $bindable(),
    tickSpacing,
    currentTick,
    spotPrice,
    baseSymbol,
    quoteSymbol,
    disabled = false,
    onUpdate,
    label = "Limit Price",
    showCurrentPrice = true,
    showPriceDifference = false
  }: Props = $props();

  // Local state for debounced user input
  let rawPriceInput = $state<string>("");
  let debounceTimer = $state<number | null>(null);

  // Derive display price from limitTick
  const displayPrice = $derived.by(() => {
    if (limitTick === null) return null;
    return tickToPrice(limitTick);
  });

  const displayPriceString = $derived.by(() => {
    if (displayPrice === null) return "";
    return displayPrice.toFixed(8);
  });

  // Display value for input field - use raw input while typing, aligned price after debounce
  const inputDisplayValue = $derived.by(() => {
    return rawPriceInput || displayPriceString;
  });

  // Calculate price difference percentage
  const priceDifference = $derived.by(() => {
    if (displayPrice === null) return null;
    const difference = ((displayPrice - spotPrice) / spotPrice) * 100;
    return difference;
  });

  // Get current tick increment at this price level
  function getTickIncrement(): number {
    const tick = alignTickToSpacing(priceToTick(spotPrice), tickSpacing, false);
    return tickToPrice(tick + tickSpacing) - tickToPrice(tick);
  }

  // Adjust price by tick spacing increments
  function adjustPriceByTicks(direction: number) {
    // Clear any pending debounce and raw input when using tick buttons
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    rawPriceInput = "";

    // Start from current limitTick or align current market tick
    const baseTick = limitTick !== null
      ? limitTick
      : alignTickToSpacing(currentTick, tickSpacing, false);

    // Calculate new tick (already aligned, so just add/subtract spacing)
    let newTick = baseTick + (direction * tickSpacing);

    // Clamp to valid range
    const bounds = { min: MIN_TICK, max: MAX_TICK };
    newTick = Math.max(bounds.min, Math.min(bounds.max, newTick));

    // Ensure alignment (safety check)
    newTick = alignTickToSpacing(newTick, tickSpacing, false);

    limitTick = newTick;
    onUpdate(newTick);
  }

  // Debounced price input handler
  function handlePriceInput(val: string) {
    // Clear existing timer
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }

    // Update raw input immediately (user sees what they type)
    rawPriceInput = val;

    // Handle empty input
    if (val === "" || val === ".") {
      debounceTimer = window.setTimeout(() => {
        limitTick = null;
        onUpdate(null);
        rawPriceInput = "";
        debounceTimer = null;
      }, 1000);
      return;
    }

    // Parse and validate price
    const price = parseFloat(val);
    if (isNaN(price) || price <= 0) {
      return; // Keep showing what user typed but don't convert
    }

    // After 1 second of no typing, convert to aligned tick
    debounceTimer = window.setTimeout(() => {
      const rawTick = priceToTick(price);
      const alignedTick = alignTickToSpacing(rawTick, tickSpacing, false);
      limitTick = alignedTick;
      onUpdate(alignedTick);
      rawPriceInput = ""; // Clear raw input so aligned price shows
      debounceTimer = null;
    }, 1000);
  }

  // Cleanup debounce timer on unmount
  $effect(() => {
    return () => {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }
    };
  });
</script>

<div>
  <label for="limit-price" class="block text-xs text-muted-foreground mb-1">
    {label}
    <span class="text-[10px] text-muted-foreground/70">
      (Tick: ≈{getTickIncrement().toFixed(8)} {quoteSymbol})
    </span>
  </label>
  <div class="flex gap-1">
    <!-- Decrease Tick Button -->
    <button
      type="button"
      onclick={() => adjustPriceByTicks(-1)}
      disabled={disabled}
      class="px-2 py-1.5 bg-muted/50 hover:bg-muted border border-border text-foreground text-sm rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[36px] min-h-[36px] flex items-center justify-center"
      title="Decrease by 1 tick"
    >
      −
    </button>

    <!-- Price Input -->
    <div class="relative flex-1">
      <input
        type="text"
        inputmode="decimal"
        id="limit-price"
        name="limit-price"
        placeholder="0.000000"
        disabled={disabled}
        value={inputDisplayValue}
        oninput={(e) => {
          const input = e.target as HTMLInputElement;
          // Sanitize input - allow only digits and decimal point
          let val = input.value.replace(/[^0-9.]/g, "");
          const parts = val.split(".");
          // Allow only one decimal point
          if (parts.length > 2) val = parts[0] + "." + parts.slice(1).join("");
          // Limit to 8 decimal places
          if (parts.length === 2 && parts[1].length > 8) {
            parts[1] = parts[1].slice(0, 8);
            val = parts.join(".");
          }
          input.value = val;

          // Debounced conversion to aligned tick (1s delay)
          handlePriceInput(val);
        }}
        class="w-full px-2 py-1.5 pr-20 bg-transparent border border-border text-foreground text-sm rounded-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-numeric disabled:opacity-50 min-h-[36px]"
      />
      <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-muted-foreground">
        {quoteSymbol}/{baseSymbol}
      </div>
    </div>

    <!-- Increase Tick Button -->
    <button
      type="button"
      onclick={() => adjustPriceByTicks(1)}
      disabled={disabled}
      class="px-2 py-1.5 bg-muted/50 hover:bg-muted border border-border text-foreground text-sm rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[36px] min-h-[36px] flex items-center justify-center"
      title="Increase by 1 tick"
    >
      +
    </button>
  </div>

  <!-- Price Info Row -->
  {#if showCurrentPrice || showPriceDifference}
    <div class="flex justify-between items-center mt-1">
      {#if showCurrentPrice}
        <p class="text-xs text-muted-foreground">
          Current: {spotPrice.toFixed(6)} {quoteSymbol}
        </p>
      {/if}
      {#if showPriceDifference && priceDifference !== null}
        <p class="text-xs {priceDifference > 0 ? 'text-green-500' : 'text-red-500'}">
          {priceDifference > 0 ? '+' : ''}{priceDifference.toFixed(2)}%
        </p>
      {/if}
    </div>
  {/if}
</div>
