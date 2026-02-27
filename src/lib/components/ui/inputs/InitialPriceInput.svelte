<script lang="ts">
  import type { NormalizedToken } from "$lib/types/entity.types";
  import Logo from "$lib/components/ui/Logo.svelte";
  import ToggleGroup from "$lib/components/ui/ToggleGroup.svelte";

  interface Props {
    /** Current price value */
    value: string;
    /** Base token (the token being priced) */
    token: NormalizedToken;
    /** Quote token (the token used as reference, e.g., ICP, USDC) */
    quoteToken: NormalizedToken;
    /** Whether the price display is inverted */
    isInverted?: boolean;
    /** Callback when inversion toggle changes */
    onToggle?: () => void;
    /** Callback when value changes */
    onValueChange?: (value: string) => void;
    /** Error message to display */
    error?: string;
    /** Placeholder text */
    placeholder?: string;
    /** Whether the input is disabled */
    disabled?: boolean;
  }

  let {
    value,
    token,
    quoteToken,
    isInverted = false,
    onToggle,
    onValueChange,
    error,
    placeholder = "0",
    disabled = false,
  }: Props = $props();

  // Token toggle options for ToggleGroup
  // Matches chart header: [BASE, QUOTE] - highlighted token is "what we're pricing"
  const toggleOptions = $derived([
    {
      value: 'normal',
      label: token.displaySymbol,
      showIcon: true,
      icon: token.logo ?? undefined
    },
    {
      value: 'inverted',
      label: quoteToken.displaySymbol,
      showIcon: true,
      icon: quoteToken.logo ?? undefined
    }
  ]);

  // Current toggle value based on isInverted
  // When normal: showing "Quote per Base" (e.g., "ICP per TOKEN")
  // When inverted: showing "Base per Quote" (e.g., "TOKEN per ICP")
  const toggleValue = $derived(isInverted ? 'inverted' : 'normal');

  // Handle toggle change
  function handleToggle(val: string) {
    onToggle?.();
  }

  // Handle input changes
  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    // Allow only numbers and decimal point
    let val = target.value.replace(/[^0-9.]/g, "");
    // Prevent multiple decimal points
    const parts = val.split(".");
    if (parts.length > 2) {
      val = parts[0] + "." + parts.slice(1).join("");
    }
    // Limit decimal places to 8 (reasonable precision for prices)
    if (parts.length === 2 && parts[1].length > 8) {
      parts[1] = parts[1].slice(0, 8);
      val = parts.join(".");
    }
    target.value = val;
    onValueChange?.(val);
  }

  // Price direction labels
  const priceLabel = $derived(
    isInverted
      ? `${token.displaySymbol} per ${quoteToken.displaySymbol}`
      : `${quoteToken.displaySymbol} per ${token.displaySymbol}`
  );

  // Generate unique ID for accessibility
  const stableId = Math.random().toString(36).slice(2, 9);
  const inputId = $derived(`price-input-${token.displaySymbol}-${stableId}`);
</script>

<div class="price-input-container">
  <!-- Label -->
  <label for={inputId} class="price-input-label">Initial Price</label>

  <!-- Main Input Card -->
  <div class="price-input-card" class:price-input-error={!!error} class:price-input-disabled={disabled}>
    <!-- Input Row -->
    <div class="price-input-row">
      <input
        id={inputId}
        type="text"
        inputmode="decimal"
        {placeholder}
        {disabled}
        value={value}
        oninput={handleInput}
        class="price-amount-input"
      />

      <!-- Token Toggle -->
      <ToggleGroup
        options={toggleOptions}
        value={toggleValue}
        onValueChange={handleToggle}
        size="sm"
        ariaLabel="Select price direction"
      />
    </div>

    <!-- Bottom Row: Price direction hint -->
    <div class="price-info-row">
      <span class="price-direction-hint">{priceLabel}</span>
    </div>
  </div>

  <!-- Error Message -->
  {#if error}
    <p class="price-error-message">{error}</p>
  {/if}
</div>

<style>
  .price-input-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .price-input-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground);
  }

  .price-input-card {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 16px;
    background: var(--field);
    border: 1px solid transparent;
    border-radius: 20px;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .price-input-card:hover:not(.price-input-disabled):not(:focus-within) {
    background: var(--field-hover);
  }

  .price-input-card:focus-within:not(.price-input-disabled) {
    background: var(--field-active);
    border-color: var(--field-border);
  }

  .price-input-card.price-input-error {
    outline: 1px solid var(--destructive);
  }

  .price-input-card.price-input-disabled {
    background: var(--field-disabled);
    cursor: not-allowed;
  }

  /* Input Row */
  .price-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .price-amount-input {
    flex: 1;
    min-width: 0;
    padding: 0;
    font-size: 36px;
    font-weight: 500;
    font-family: var(--font-sans);
    color: var(--foreground);
    background: transparent;
    border: none;
    outline: none;
  }

  .price-amount-input::placeholder {
    color: var(--muted-foreground);
    opacity: 0.4;
  }

  .price-amount-input:disabled {
    cursor: not-allowed;
  }

  /* Info Row */
  .price-info-row {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    height: 28px;
  }

  .price-direction-hint {
    font-size: 14px;
    color: var(--muted-foreground);
  }

  /* Error Message */
  .price-error-message {
    font-size: 13px;
    color: var(--destructive);
    margin: 0;
  }
</style>
