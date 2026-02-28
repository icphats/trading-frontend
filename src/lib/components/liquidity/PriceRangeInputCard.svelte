<script lang="ts" module>
  export const InputMode = {
    PRICE: 'PRICE',
    PERCENTAGE: 'PERCENTAGE'
  } as const;

  export type InputModeType = typeof InputMode[keyof typeof InputMode];
</script>

<script lang="ts">
  import { tickToPrice, priceToTick, getNearestValidTick, isMinTick, isMaxTick } from '$lib/domain/markets/utils';
  import { formatSigFig } from '$lib/utils/format.utils';
  import AdjustableFieldCard from './shared/AdjustableFieldCard.svelte';

  type Size = 'lg' | 'sm';

  interface Props {
    /** "min" or "max" */
    type: 'min' | 'max';
    /** Current tick value */
    tick: number;
    /** Current price (for percentage calculations) */
    currentPrice?: number;
    /** Token0 decimals */
    baseDecimals?: number;
    /** Token1 decimals */
    quoteDecimals?: number;
    /** Quote token symbol */
    quoteSymbol?: string;
    /** Base token symbol */
    baseSymbol?: string;
    /** Tick spacing for the pool */
    tickSpacing?: number;
    /** Whether input is disabled */
    disabled?: boolean;
    /** Error message to display */
    error?: string | null;
    /** Callback when tick changes */
    onTickChange?: (newTick: number) => void;
    /** Whether prices are inverted (show Base/Quote instead of Quote/Base) */
    isInverted?: boolean;
    /** Size variant */
    size?: Size;
  }

  let {
    type,
    tick,
    currentPrice,
    baseDecimals = 8,
    quoteDecimals = 8,
    quoteSymbol = 'Quote',
    baseSymbol = 'Base',
    tickSpacing = 60,
    disabled = false,
    error = null,
    onTickChange,
    isInverted = false,
    size = 'lg'
  }: Props = $props();

  // Local input state
  let inputValue = $state('');
  let isFocused = $state(false);
  let inputMode = $state<InputModeType>(InputMode.PRICE);

  // Check if tick is at full range bounds
  const isAtMinBound = $derived(isMinTick(tick));
  const isAtMaxBound = $derived(isMaxTick(tick));
  const isAtBound = $derived(isAtMinBound || isAtMaxBound);

  // Derived price from tick (with inversion applied)
  const rawPrice = $derived(tickToPrice(tick, baseDecimals, quoteDecimals));
  const price = $derived(isInverted && rawPrice > 0 ? 1 / rawPrice : rawPrice);

  // Current price for display (inverted if needed)
  const displayCurrentPrice = $derived(
    currentPrice && isInverted && currentPrice > 0 ? 1 / currentPrice : currentPrice
  );

  // Calculate percentage difference from current price (using inverted values when applicable)
  const percentageDiff = $derived.by(() => {
    if (!displayCurrentPrice || displayCurrentPrice <= 0) return null;
    if (isAtBound) return null;
    return ((price - displayCurrentPrice) / displayCurrentPrice) * 100;
  });

  // Format percentage for display
  const percentageDiffFormatted = $derived.by(() => {
    if (percentageDiff === null) return '';
    const sign = percentageDiff >= 0 ? '+' : '';
    return `${sign}${percentageDiff.toFixed(2)}%`;
  });

  // Update input value when tick changes (and not focused)
  $effect(() => {
    if (!isFocused) {
      if (inputMode === InputMode.PERCENTAGE && displayCurrentPrice) {
        inputValue = percentageDiff !== null ? percentageDiff.toFixed(2) : '';
      } else {
        inputValue = formatPriceForInput(price, tick);
      }
    }
  });

  // Format price for display/input - handles full range bounds
  function formatPriceForInput(p: number, currentTick: number): string {
    // Handle full range bounds specially
    if (isMinTick(currentTick)) return '0';
    if (isMaxTick(currentTick)) return '∞';

    // Handle extreme values that shouldn't display
    if (!isFinite(p) || p > 1e30) return '∞';
    if (p < 1e-30 || p === 0) return '0';

    // Use formatSigFig for consistent formatting (5 sig figs, no subscript for inputs)
    return formatSigFig(p, 5);
  }

  // Toggle input mode
  function toggleInputMode() {
    if (!displayCurrentPrice) return;

    if (inputMode === InputMode.PRICE) {
      inputMode = InputMode.PERCENTAGE;
      inputValue = percentageDiff !== null ? percentageDiff.toFixed(2) : '';
    } else {
      inputMode = InputMode.PRICE;
      inputValue = formatPriceForInput(price, tick);
    }
  }

  // Handle input change
  function handleInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    // Only allow digits, decimal point, and commas
    inputValue = target.value.replace(/[^0-9.,]/g, '');
  }

  // Handle input blur - commit the value
  function handleBlur() {
    isFocused = false;

    // Handle special infinity/zero inputs
    const trimmed = inputValue.trim().toLowerCase();
    if (trimmed === '∞' || trimmed === 'inf' || trimmed === 'infinity') {
      inputValue = formatPriceForInput(price, tick);
      return;
    }
    if (trimmed === '0') {
      inputValue = formatPriceForInput(price, tick);
      return;
    }

    const parsed = parseFloat(inputValue.replace(/,/g, ''));

    if (!isNaN(parsed)) {
      if (inputMode === InputMode.PERCENTAGE && displayCurrentPrice) {
        // Convert percentage to price (using inverted current price when applicable)
        const newDisplayPrice = displayCurrentPrice * (1 + parsed / 100);
        if (newDisplayPrice > 0) {
          // If inverted, convert back to original price before getting tick
          const originalPrice = isInverted ? 1 / newDisplayPrice : newDisplayPrice;
          const newTick = priceToTick(originalPrice, baseDecimals, quoteDecimals, tickSpacing);
          onTickChange?.(newTick);
        }
      } else if (parsed > 0) {
        // If inverted, convert back to original price before getting tick
        const originalPrice = isInverted ? 1 / parsed : parsed;
        const newTick = priceToTick(originalPrice, baseDecimals, quoteDecimals, tickSpacing);
        onTickChange?.(newTick);
      }
    }

    // Update display
    if (inputMode === InputMode.PERCENTAGE && displayCurrentPrice) {
      inputValue = percentageDiff !== null ? percentageDiff.toFixed(2) : '';
    } else {
      inputValue = formatPriceForInput(price, tick);
    }
  }

  function handleFocus() {
    isFocused = true;
    // For bound values, don't show raw number
    if (isAtBound) return;

    if (inputMode === InputMode.PERCENTAGE && percentageDiff !== null) {
      inputValue = percentageDiff.toFixed(2);
    } else {
      // Use formatted value (without trailing zeros for easier editing)
      inputValue = formatSigFig(price, 5, { trailingZeros: false });
    }
  }

  // Increment/decrement by tick spacing
  function increment() {
    if (disabled) return;
    const newTick = getNearestValidTick(tick + tickSpacing, tickSpacing);
    onTickChange?.(newTick);
  }

  function decrement() {
    if (disabled) return;
    const newTick = getNearestValidTick(tick - tickSpacing, tickSpacing);
    onTickChange?.(newTick);
  }

  const label = $derived(type === 'min' ? 'Min Price' : 'Max Price');
</script>

<AdjustableFieldCard
  {label}
  value={inputValue}
  placeholder="0.0"
  {disabled}
  {error}
  {size}
  onIncrement={increment}
  onDecrement={decrement}
  onInput={handleInputChange}
  onBlur={handleBlur}
  onFocus={handleFocus}
>
  {#snippet footer()}
    <span class="unit">{quoteSymbol} per {baseSymbol}</span>
    {#if percentageDiffFormatted && !isAtBound}
      <span class="percentage-badge" class:negative={percentageDiff !== null && percentageDiff < 0}>
        {percentageDiffFormatted}
      </span>
    {/if}
  {/snippet}
</AdjustableFieldCard>

<style>
  .unit {
    font-size: 12px;
    color: var(--muted-foreground);
  }

  .percentage-badge {
    font-size: 11px;
    font-weight: 500;
    padding: 2px 6px;
    border-radius: 4px;
    background: oklch(from var(--color-bullish) l c h / 0.15);
    color: var(--color-bullish);
  }

  .percentage-badge.negative {
    background: oklch(from var(--destructive) l c h / 0.15);
    color: var(--destructive);
  }

  /* SM overrides for footer content */
  :global(.afc-size-sm) .unit {
    font-size: 11px;
  }

  :global(.afc-size-sm) .percentage-badge {
    font-size: 10px;
    padding: 1px 4px;
  }
</style>
