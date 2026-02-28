<script lang="ts">
  /**
   * TradePriceInput - Dual-mode price/percentage input for trading
   *
   * ========================================
   * TWO OPERATIONAL MODES
   * ========================================
   *
   * 1. LIMIT PRICE MODE (allowNegativeSlippage = true)
   *    - Used for: Limit orders, trigger limit prices
   *    - Percentage display: Signed (+2.5% or -2.5%) relative to currentPrice
   *    - Badge colors: Directional (green = above market, red = below market)
   *    - Quick adjust buttons: Adjust price directionally (+10 = price goes up)
   *    - User can set price anywhere (above or below market)
   *
   * 2. SLIPPAGE MODE (allowNegativeSlippage = false)
   *    - Used for: Market orders, trigger market execution
   *    - Percentage display: Magnitude only (always positive, e.g., "1.50%")
   *    - Badge colors: Severity-based (green = low risk, yellow = caution, red = high risk)
   *    - Quick adjust buttons: Adjust slippage magnitude (+10 = worse slippage)
   *      - For Buy: +10 increases price (more slippage)
   *      - For Sell: +10 decreases price (more slippage) - inverted!
   *    - Price is clamped: cannot cross market (no "negative slippage")
   *
   * ========================================
   * SIDE-SPECIFIC BEHAVIOR (Slippage Mode)
   * ========================================
   *
   * BUY orders:
   *   - Acceptable price is ABOVE market (willing to pay more)
   *   - Slippage = (price - market) / market * 100 → positive number
   *   - +10 button → price increases → slippage increases
   *
   * SELL orders:
   *   - Acceptable price is BELOW market (willing to receive less)
   *   - Slippage = |price - market| / market * 100 → shown as positive magnitude
   *   - +10 button → price DECREASES → slippage increases (inverted)
   */

  import { tickToPrice, priceToTick, isMinTick, isMaxTick } from '$lib/domain/markets/utils';
  import { formatSigFig } from '$lib/utils/format.utils';
  import {
    priceToTickDirectional as _priceToTickDirectional,
    clampPrice as _clampPrice,
    clampPercentage as _clampPercentage,
  } from '$lib/utils/price-input.utils';

  type DisplayMode = 'price' | 'percentage';
  type Side = 'Buy' | 'Sell';

  interface Props {
    /** Display label */
    label?: string;
    /** Current tick value */
    tick: number | null;
    /** Current price (for percentage calculations) */
    currentPrice?: number;
    /** Base token decimals */
    baseDecimals?: number;
    /** Quote token decimals */
    quoteDecimals?: number;
    /** Tick spacing for the market */
    tickSpacing?: number;
    /** Number of significant figures to display (default: 5) */
    significantFigures?: number;
    /** Whether input is disabled */
    disabled?: boolean;
    /** Read-only display mode (no buttons, no editing) */
    readonly?: boolean;
    /** Suffix text to display (e.g., "USDC/ICP") */
    suffix?: string;
    /** Callback when tick changes */
    onTickChange?: (newTick: number) => void;
    /**
     * Allow negative slippage (price crossing market).
     * - false (default): Clamp so price can't cross market (for market orders)
     * - true: Allow any price (for limit orders)
     */
    allowNegativeSlippage?: boolean;
    /**
     * Order side - required when allowNegativeSlippage is false.
     * - 'Buy': Price cannot go below currentPrice
     * - 'Sell': Price cannot go above currentPrice
     */
    side?: Side;
    /** Initial display mode */
    initialDisplayMode?: DisplayMode;
    /**
     * Initial slippage percentage (only used when allowNegativeSlippage = false).
     * When provided, the component will auto-initialize the tick to this slippage
     * from currentPrice, using directional rounding to ensure at least this much slippage.
     * Example: 1 = 1% slippage
     */
    initialSlippagePercent?: number;
  }

  let {
    label,
    tick,
    currentPrice,
    baseDecimals = 8,
    quoteDecimals = 8,
    tickSpacing = 60,
    significantFigures = 5,
    disabled = false,
    readonly = false,
    suffix,
    onTickChange,
    allowNegativeSlippage = true,
    side,
    initialDisplayMode = 'price',
    initialSlippagePercent
  }: Props = $props();

  // Display mode toggle state
  let displayMode = $state<DisplayMode>(initialDisplayMode);

  // Local input state
  let inputValue = $state('');
  let isFocused = $state(false);

  // In slippage mode, this is the source of truth for the user's desired slippage %.
  // The tick is re-derived from this whenever currentPrice changes, so slippage stays fixed.
  let targetSlippage = $state<number | null>(null);

  // ============================================
  // Directional Tick Conversion (for slippage)
  // ============================================

  function priceToTickDirectional(targetPrice: number): number {
    return _priceToTickDirectional(targetPrice, {
      baseDecimals,
      quoteDecimals,
      tickSpacing,
      directional: !allowNegativeSlippage && !!side,
      side,
    });
  }

  // ============================================
  // Auto-initialization from initialSlippagePercent
  // ============================================

  let hasAutoInitialized = $state(false);
  $effect(() => {
    // Only auto-init if:
    // - initialSlippagePercent is provided
    // - In slippage mode (allowNegativeSlippage = false)
    // - Side is provided
    // - currentPrice is available
    // - Haven't already initialized
    // - tick is null (parent hasn't set it)
    if (
      initialSlippagePercent !== undefined &&
      !allowNegativeSlippage &&
      side &&
      currentPrice &&
      currentPrice > 0 &&
      !hasAutoInitialized &&
      tick === null
    ) {
      hasAutoInitialized = true;
      targetSlippage = initialSlippagePercent;

      // Calculate target price based on slippage
      const slippageMultiplier = side === 'Buy'
        ? 1 + initialSlippagePercent / 100
        : 1 - initialSlippagePercent / 100;
      const targetPrice = currentPrice * slippageMultiplier;

      // Use directional rounding to ensure at least the target slippage
      const initialTick = priceToTickDirectional(targetPrice);
      onTickChange?.(initialTick);
    }
  });

  // Price-tracking effect: recalculate tick to maintain target slippage as market moves
  $effect(() => {
    if (
      !allowNegativeSlippage &&
      side &&
      currentPrice &&
      currentPrice > 0 &&
      targetSlippage !== null
    ) {
      const multiplier = side === 'Buy'
        ? 1 + targetSlippage / 100
        : 1 - targetSlippage / 100;
      const targetPrice = currentPrice * multiplier;
      const newTick = priceToTickDirectional(targetPrice);
      if (newTick !== tick) {
        onTickChange?.(newTick);
      }
    }
  });

  // Handle null tick
  const effectiveTick = $derived(tick ?? 0);

  // Check bounds
  const isAtBound = $derived(isMinTick(effectiveTick) || isMaxTick(effectiveTick));

  // Derived price from tick
  const price = $derived(tickToPrice(effectiveTick, baseDecimals, quoteDecimals));

  // Calculate percentage difference from current price (slippage)
  const percentageDiff = $derived.by(() => {
    if (!currentPrice || currentPrice <= 0 || isAtBound || tick === null) return null;
    return ((price - currentPrice) / currentPrice) * 100;
  });

  // For slippage mode, we use absolute magnitude (always positive)
  const slippageMagnitude = $derived.by(() => {
    if (percentageDiff === null) return null;
    return Math.abs(percentageDiff);
  });

  // Determine slippage severity for warning colors (only used when allowNegativeSlippage is false)
  const slippageSeverity = $derived.by<'low' | 'medium' | 'high' | null>(() => {
    if (slippageMagnitude === null) return null;
    if (slippageMagnitude <= 1) return 'low';      // 0-1% = safe (green)
    if (slippageMagnitude <= 3) return 'medium';   // 1-3% = caution (yellow)
    return 'high';                                  // >3% = warning (red)
  });

  const percentageDiffFormatted = $derived.by(() => {
    if (percentageDiff === null) return '';

    // For slippage mode (allowNegativeSlippage = false), show magnitude only
    if (!allowNegativeSlippage) {
      return `${slippageMagnitude?.toFixed(2)}%`;
    }

    // For limit price mode, show signed value
    const sign = percentageDiff >= 0 ? '+' : '';
    return `${sign}${percentageDiff.toFixed(2)}%`;
  });

  // Format percentage for input display
  function formatPercentageDisplay(): string {
    if (percentageDiff === null) return '0';

    // For slippage mode, show magnitude only
    if (!allowNegativeSlippage) {
      return (slippageMagnitude ?? 0).toFixed(2);
    }

    return percentageDiff.toFixed(2);
  }

  // Update input value when tick changes (and not focused)
  $effect(() => {
    if (!isFocused) {
      if (tick === null) {
        inputValue = '';
      } else if (displayMode === 'price') {
        inputValue = formatPriceDisplay(price);
      } else {
        inputValue = formatPercentageDisplay();
      }
    }
  });

  // Update input value when display mode changes (and not focused)
  $effect(() => {
    const _mode = displayMode; // Track dependency
    if (!isFocused && tick !== null) {
      if (_mode === 'price') {
        inputValue = formatPriceDisplay(price);
      } else {
        inputValue = formatPercentageDisplay();
      }
    }
  });

  // Format price for display using significant figures
  function formatPriceDisplay(p: number): string {
    if (isMinTick(effectiveTick)) return '0';
    if (isMaxTick(effectiveTick)) return '∞';
    if (!isFinite(p) || p > 1e30) return '∞';
    if (p < 1e-30 || p === 0) return '0';

    return formatSigFig(p, significantFigures);
  }

  function clampPrice(targetPrice: number): number {
    return _clampPrice(targetPrice, { currentPrice, allowNegativeSlippage, side });
  }

  function clampPercentage(pct: number): number {
    return _clampPercentage(pct, { allowNegativeSlippage, side });
  }

  // Toggle between price and percentage display modes
  function toggleDisplayMode() {
    displayMode = displayMode === 'price' ? 'percentage' : 'price';
  }

  function handleInput(e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    // Allow digits, decimal point, commas, and minus sign (for percentage mode)
    if (displayMode === 'percentage') {
      inputValue = raw.replace(/[^0-9.,-]/g, '');
    } else {
      inputValue = raw.replace(/[^0-9.,]/g, '');
    }
  }

  function handleBlur() {
    isFocused = false;
    const trimmed = inputValue.trim().toLowerCase();

    if (displayMode === 'price') {
      // Price mode handling
      if (trimmed === '∞' || trimmed === 'inf' || trimmed === '0') {
        inputValue = formatPriceDisplay(price);
        return;
      }

      const parsed = parseFloat(inputValue.replace(/,/g, ''));
      if (!isNaN(parsed) && parsed > 0) {
        const clampedPrice = clampPrice(parsed);
        // In slippage mode, derive targetSlippage from the entered price
        if (!allowNegativeSlippage && currentPrice && currentPrice > 0) {
          targetSlippage = Math.abs((clampedPrice - currentPrice) / currentPrice * 100);
        }
        onTickChange?.(priceToTickDirectional(clampedPrice));
      }

      inputValue = formatPriceDisplay(price);
    } else {
      // Percentage mode handling
      const parsed = parseFloat(inputValue.replace(/,/g, ''));
      if (!isNaN(parsed) && currentPrice && currentPrice > 0) {
        let effectivePct: number;

        if (!allowNegativeSlippage) {
          // Slippage mode: user enters magnitude (always positive)
          const magnitude = Math.abs(parsed);
          targetSlippage = magnitude;
          if (side === 'Buy') {
            effectivePct = magnitude;
          } else {
            effectivePct = -magnitude;
          }
        } else {
          // Limit price mode: user enters signed percentage directly
          effectivePct = parsed;
        }

        const clampedPct = clampPercentage(effectivePct);
        const targetPrice = currentPrice * (1 + clampedPct / 100);
        onTickChange?.(priceToTickDirectional(targetPrice));
      }

      inputValue = formatPercentageDisplay();
    }
  }

  function handleFocus() {
    isFocused = true;
    if (isAtBound) return;

    if (displayMode === 'price') {
      // Use formatted value (without trailing zeros for easier editing)
      inputValue = formatSigFig(price, significantFigures, { trailingZeros: false });
    } else {
      // Show percentage without trailing zeros
      if (!allowNegativeSlippage) {
        // Slippage mode: show magnitude only
        inputValue = slippageMagnitude !== null ? slippageMagnitude.toFixed(2) : '0';
      } else {
        // Limit price mode: show signed value
        inputValue = percentageDiff !== null ? percentageDiff.toFixed(2) : '0';
      }
    }
  }

  // Reset to current market price (or initial slippage if in slippage mode)
  function reset() {
    if (disabled || !currentPrice) return;

    if (!allowNegativeSlippage && side && initialSlippagePercent !== undefined) {
      // In slippage mode with initial slippage: reset to initial slippage
      targetSlippage = initialSlippagePercent;
      const slippageMultiplier = side === 'Buy'
        ? 1 + initialSlippagePercent / 100
        : 1 - initialSlippagePercent / 100;
      const targetPrice = currentPrice * slippageMultiplier;
      onTickChange?.(priceToTickDirectional(targetPrice));
    } else {
      // Limit price mode or no initial slippage: reset to market price
      const centerTick = priceToTick(currentPrice, baseDecimals, quoteDecimals, tickSpacing);
      onTickChange?.(centerTick);
    }
  }

  // Quick percentage adjustment
  // In limit price mode: adjusts price directionally (+10 = price goes up)
  // In slippage mode: adjusts slippage magnitude (+10 = more slippage)
  function adjustByPercent(percent: number) {
    if (disabled || price <= 0) return;

    // In slippage mode, adjust the target slippage directly
    if (!allowNegativeSlippage && side && targetSlippage !== null) {
      const newSlippage = Math.max(0, targetSlippage + percent);
      targetSlippage = newSlippage;
      // Immediately compute and emit new tick
      if (currentPrice && currentPrice > 0) {
        const multiplier = side === 'Buy'
          ? 1 + newSlippage / 100
          : 1 - newSlippage / 100;
        const targetPrice = currentPrice * multiplier;
        onTickChange?.(priceToTickDirectional(targetPrice));
      }
      return;
    }

    let effectivePercent = percent;

    // Apply percentage change to the CURRENT price
    let targetPrice = price * (1 + effectivePercent / 100);

    // Apply clamping if negative slippage is not allowed
    targetPrice = clampPrice(targetPrice);

    // Use directional rounding for proper tick alignment
    onTickChange?.(priceToTickDirectional(targetPrice));
  }

  // Quick adjustment buttons - incremental basis point adjustments
  const quickAdjustButtons = [
    { label: '-100', value: -1 },
    { label: '-10', value: -0.1 },
    { label: '-1', value: -0.01 },
    { label: '+1', value: 0.01 },
    { label: '+10', value: 0.1 },
    { label: '+100', value: 1 },
  ];
</script>

<div class="trade-price-container" class:disabled class:readonly>
  <div class="trade-price-header">
    {#if label}
      <label class="trade-price-label">{label}</label>
    {/if}
    {#if !readonly && currentPrice}
      <!-- Show the opposite value as a reference badge -->
      {#if displayMode === 'price' && percentageDiffFormatted && !isAtBound}
        {#if !allowNegativeSlippage}
          <!-- Slippage mode: use severity-based warning colors -->
          <span
            class="diff-badge slippage"
            class:slippage-low={slippageSeverity === 'low'}
            class:slippage-medium={slippageSeverity === 'medium'}
            class:slippage-high={slippageSeverity === 'high'}
          >
            {percentageDiffFormatted}
          </span>
        {:else}
          <!-- Limit price mode: use directional colors -->
          <span class="diff-badge" class:negative={percentageDiff !== null && percentageDiff < 0}>
            {percentageDiffFormatted}
          </span>
        {/if}
      {:else if displayMode === 'percentage' && !isAtBound}
        <span class="diff-badge price-ref">
          {formatPriceDisplay(price)}
        </span>
      {/if}
    {/if}
  </div>

  <div class="trade-price-input">
    <input
      type="text"
      inputmode="decimal"
      value={inputValue}
      oninput={handleInput}
      onblur={handleBlur}
      onfocus={handleFocus}
      disabled={disabled || readonly}
      placeholder={displayMode === 'price' ? '0.0' : '0.00'}
      class="price-field"
    />

    {#if displayMode === 'percentage'}
      <span class="price-suffix separated">%</span>
    {:else if suffix}
      <span class="price-suffix">{suffix}</span>
    {/if}

    {#if !readonly && currentPrice}
      <div class="input-actions">
        <!-- Toggle button for switching between $ and % modes -->
        <button
          type="button"
          class="action-btn"
          onclick={toggleDisplayMode}
          disabled={disabled}
          aria-label={displayMode === 'price' ? 'Switch to percentage mode' : 'Switch to price mode'}
          title={displayMode === 'price' ? 'Switch to percentage' : 'Switch to price'}
        >
          {displayMode === 'price' ? '%' : '$'}
        </button>

        <button
          type="button"
          class="action-btn"
          onclick={reset}
          disabled={disabled || !currentPrice}
          aria-label="Reset to current price"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
        </button>
      </div>
    {:else if !readonly}
      <div class="input-actions">
        <button
          type="button"
          class="action-btn"
          onclick={reset}
          disabled={disabled || !currentPrice}
          aria-label="Reset to current price"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
        </button>
      </div>
    {/if}
  </div>

  <!-- Quick percentage adjustment buttons (incremental, not presets) -->
  {#if !readonly}
    <div class="quick-adjust-row">
      {#each quickAdjustButtons as btn}
        <button
          type="button"
          class="quick-adjust-btn"
          class:negative={btn.value < 0}
          onclick={() => adjustByPercent(btn.value)}
          disabled={disabled || price <= 0}
        >
          {btn.label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .trade-price-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .trade-price-container.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .trade-price-container.disabled .trade-price-input {
    background: var(--field-disabled);
  }

  .trade-price-container.readonly .trade-price-input {
    background: var(--muted);
  }

  .trade-price-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .trade-price-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground);
  }

  .trade-price-input {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    background: var(--field);
    border: 1px solid transparent;
    border-radius: 12px;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .trade-price-container:not(.disabled):not(.readonly) .trade-price-input:hover:not(:focus-within) {
    background: var(--field-hover);
  }

  .trade-price-container:not(.disabled):not(.readonly) .trade-price-input:focus-within {
    background: var(--field-active);
    border-color: var(--field-border);
  }

  .price-field {
    flex: 1;
    min-width: 0;
    padding: 0;
    background: transparent;
    border: none;
    outline: none;
    font-size: 18px;
    font-weight: 500;
    font-family: var(--font-sans);
    color: var(--foreground);
    text-align: left;
  }

  .price-field::placeholder {
    color: var(--muted-foreground);
    opacity: 0.4;
  }

  .price-suffix {
    font-size: 12px;
    color: var(--muted-foreground);
    flex-shrink: 0;
  }

  .price-suffix.separated {
    margin-right: 8px;
  }

  .diff-badge {
    font-size: 11px;
    font-weight: 500;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: var(--font-numeric);
    white-space: nowrap;
    background: oklch(from var(--color-bullish) l c h / 0.15);
    color: var(--color-bullish);
  }

  .diff-badge.negative {
    background: oklch(from var(--destructive) l c h / 0.15);
    color: var(--destructive);
  }

  .diff-badge.price-ref {
    background: var(--muted);
    color: var(--muted-foreground);
  }

  /* Slippage severity colors (warning-style) */
  .diff-badge.slippage-low {
    background: oklch(from var(--color-bullish) l c h / 0.15);
    color: var(--color-bullish);
  }

  .diff-badge.slippage-medium {
    background: oklch(0.75 0.15 85 / 0.15); /* amber/yellow */
    color: oklch(0.75 0.15 85);
  }

  .diff-badge.slippage-high {
    background: oklch(from var(--destructive) l c h / 0.15);
    color: var(--destructive);
  }

  /* Quick adjust row - sits tightly below input */
  .quick-adjust-row {
    display: flex;
    gap: 4px;
    margin-top: 0;
  }

  .quick-adjust-btn {
    flex: 1;
    padding: 6px 4px;
    font-size: 11px;
    font-weight: 500;
    font-family: var(--font-numeric);
    color: var(--foreground);
    background: var(--field);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .quick-adjust-btn:hover:not(:disabled) {
    background: var(--muted);
    transform: scale(1.02);
  }

  .quick-adjust-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .quick-adjust-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Negative buttons (decrease) - subtle red tint */
  .quick-adjust-btn.negative {
    color: var(--destructive);
  }

  .quick-adjust-btn.negative:hover:not(:disabled) {
    background: oklch(from var(--destructive) l c h / 0.1);
  }

  /* Positive buttons (increase) - subtle green tint */
  .quick-adjust-btn:not(.negative) {
    color: var(--color-bullish);
  }

  .quick-adjust-btn:not(.negative):hover:not(:disabled) {
    background: oklch(from var(--color-bullish) l c h / 0.1);
  }

  /* Action buttons container */
  .input-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  /* Unified action button style (perfect squares) */
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--muted-foreground);
    cursor: pointer;
    transition: all 0.12s ease;
    font-size: 14px;
    font-weight: 600;
    font-family: var(--font-numeric);
  }

  .action-btn:hover:not(:disabled) {
    background: var(--muted);
    border-color: var(--foreground);
    color: var(--foreground);
  }

  .action-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
