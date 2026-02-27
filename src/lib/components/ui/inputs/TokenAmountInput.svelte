<script lang="ts">
  import type { NormalizedToken } from "$lib/types/entity.types";
  import Logo from "$lib/components/ui/Logo.svelte";
  import { formatUSD } from "$lib/utils/format.utils";
  import { bigIntToString } from "$lib/domain/markets/utils";

  type Size = 'lg' | 'md' | 'sm';

  interface Props {
    /** Display label for the input */
    label?: string;
    /** Current input value */
    value?: string;
    /** Token data from entityStore */
    token?: NormalizedToken;
    /** Placeholder text */
    placeholder?: string;
    /** Error message to display */
    error?: string;
    /** Callback when value changes */
    onValueChange?: (value: string) => void;
    /** Whether the input is disabled */
    disabled?: boolean;
    /** Whether to show loading state */
    loading?: boolean;
    /** Skeleton mode — renders identical DOM with placeholder bars */
    skeleton?: boolean;
    /** Size variant: lg (36px), md (24px), sm (18px) */
    size?: Size;
    /** Read-only display mode (no presets, subtle styling) */
    readonly?: boolean;
    /** Override: show/hide balance (default: true for lg/md, false for sm) */
    showBalance?: boolean;
    /** Override: show/hide presets (default: true for lg/md when not readonly, false otherwise) */
    showPresets?: boolean;
    /** Override: show/hide USD value (default: true) */
    showUsdValue?: boolean;
    /** User's balance for this token (from userPortfolio) */
    balance?: bigint;
    /** Transfer fee to deduct from max/presets (ICRC-1 ledger fee) */
    fee?: bigint;
    /** Callback when token badge is clicked (enables clickable token pill) */
    onTokenClick?: () => void;
    /** Callback when "Deposit" is clicked on zero-balance hint */
    onDepositClick?: () => void;
  }

  let {
    label,
    value = '',
    token,
    placeholder = "0",
    error,
    onValueChange,
    disabled = false,
    loading = false,
    skeleton = false,
    size = 'lg',
    readonly = false,
    showBalance,
    showPresets,
    showUsdValue,
    balance = 0n,
    fee = 0n,
    onTokenClick,
    onDepositClick,
  }: Props = $props();

  // Smart defaults based on size and readonly
  let shouldShowBalance = $derived(showBalance ?? (size !== 'sm'));
  let shouldShowPresets = $derived(showPresets ?? (!readonly && !disabled));
  let shouldShowUsdValue = $derived(showUsdValue ?? true);

  // Preset percentages matching Uniswap
  const PRESETS = [25, 50, 75, "max"] as const;
  type Preset = (typeof PRESETS)[number];

  // Check if input has a value (for showing presets vs USD)
  let hasValue = $derived(value && value !== "" && parseFloat(value) > 0);

  // Calculate USD value using entityStore.priceUsd (E12 precision per 06-Precision.md)
  let usdValue = $derived.by(() => {
    if (skeleton || !token) return null;
    if (!value || value === "" || value === "0") return null;

    try {
      const amount = parseFloat(value);
      if (isNaN(amount) || amount <= 0) return null;

      // priceUsd is E12 (12 decimals) per 06-Precision.md
      const priceUsd = token.priceUsd;
      if (!priceUsd || priceUsd === 0n) return null;

      const priceNum = Number(priceUsd) / 1e12;
      return priceNum * amount;
    } catch {
      return null;
    }
  });

  // Format USD value for display
  let formattedUsdValue = $derived(usdValue !== null ? `~${formatUSD(usdValue)}` : null);

  // Format balance for display (using bigIntToString per canon 4.7)
  let formattedBalance = $derived.by(() => {
    if (skeleton || !token) return '0';
    if (!balance || balance === 0n) return '0';
    // Use bigIntToString for precision-safe conversion
    const balanceStr = bigIntToString(balance, token.decimals);
    const num = parseFloat(balanceStr);
    return num.toLocaleString('en-US', { maximumFractionDigits: 4 });
  });

  // Max spendable: balance minus fee (clamped to 0)
  let maxSpendable = $derived(balance > fee ? balance - fee : 0n);

  // Calculate amount for a given preset (using BigInt arithmetic per canon 8.4)
  function getPresetAmount(preset: Preset): string {
    if (!balance || balance === 0n) return "0";

    if (preset === "max") {
      return bigIntToString(maxSpendable, token?.decimals ?? 8);
    }

    // Calculate percentage of balance, capped at maxSpendable
    const amount = (balance * BigInt(preset)) / 100n;
    const capped = amount > maxSpendable ? maxSpendable : amount;
    return bigIntToString(capped, token?.decimals ?? 8);
  }

  // Check if preset should be disabled
  function isPresetDisabled(preset: Preset): boolean {
    return disabled || !balance || balance === 0n;
  }

  // Handle preset button click
  function handlePresetClick(preset: Preset) {
    if (isPresetDisabled(preset)) return;
    const amount = getPresetAmount(preset);
    onValueChange?.(amount);
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
    // Limit decimal places to token decimals
    if (token && parts.length === 2 && parts[1].length > token.decimals) {
      parts[1] = parts[1].slice(0, token.decimals);
      val = parts.join(".");
    }
    target.value = val;
    onValueChange?.(val);
  }

  // Format preset label
  function getPresetLabel(preset: Preset): string {
    return preset === "max" ? "Max" : `${preset}%`;
  }

  // Generate unique ID for accessibility
  const stableId = Math.random().toString(36).slice(2, 9);
  const inputId = $derived(`deposit-input-${token?.symbol ?? 'skeleton'}-${stableId}`);
</script>

<div class="deposit-input-container deposit-size-{size}">
  <!-- Label (optional) -->
  {#if label}
    <label for={inputId} class="deposit-input-label">{label}</label>
  {/if}

  <!-- Main Input Card -->
  <div
    class="deposit-input-card"
    class:deposit-input-error={!skeleton && !!error}
    class:deposit-input-disabled={!skeleton && disabled}
    class:deposit-input-readonly={!skeleton && readonly}
  >
    {#if skeleton}
      <!-- Skeleton mode: identical DOM structure, placeholder bars instead of content -->
      <div class="deposit-input-row">
        <input
          type="text"
          disabled
          placeholder={placeholder}
          class="deposit-amount-input"
          style="visibility: hidden;"
        />
        <div class="deposit-token-badge">
          <div class="deposit-skeleton deposit-skeleton-icon"></div>
          <div class="deposit-skeleton deposit-skeleton-symbol"></div>
        </div>
        <div class="deposit-skeleton deposit-skeleton-input-overlay"></div>
      </div>
      <div class="deposit-info-row">
        <div class="deposit-info-left">
          <div class="deposit-skeleton deposit-skeleton-usd"></div>
        </div>
      </div>
    {:else if token}
      <!-- Input Row -->
      <div class="deposit-input-row">
        <input
          id={inputId}
          type="text"
          inputmode="decimal"
          {placeholder}
          disabled={disabled || readonly}
          value={value}
          oninput={handleInput}
          class="deposit-amount-input"
        />

        <!-- Token Badge -->
        {#if onTokenClick}
          <button type="button" class="deposit-token-badge deposit-token-clickable" onclick={onTokenClick}>
            <Logo
              src={token.logo ?? undefined}
              alt={token.displaySymbol}
              size={size === 'sm' ? 'xs' : 'sm'}
              circle={true}
            />
            <span class="deposit-token-symbol">{token.displaySymbol}</span>
            <svg class="deposit-token-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        {:else}
          <div class="deposit-token-badge">
            <Logo
              src={token.logo ?? undefined}
              alt={token.displaySymbol}
              size={size === 'sm' ? 'xs' : 'sm'}
              circle={true}
            />
            <span class="deposit-token-symbol">{token.displaySymbol}</span>
          </div>
        {/if}
      </div>

      <!-- Bottom Row: Presets OR USD Value + Balance -->
      {#if shouldShowBalance || shouldShowPresets || shouldShowUsdValue}
        <div class="deposit-info-row">
          <div class="deposit-info-left">
            {#if shouldShowPresets && !hasValue}
              <!-- Preset buttons at bottom left when no value entered -->
              <div class="deposit-presets-row">
                {#each PRESETS as preset, index}
                  <button
                    type="button"
                    class="deposit-preset-btn"
                    disabled={isPresetDisabled(preset)}
                    onclick={() => handlePresetClick(preset)}
                    style="--stagger-delay: {index * 50}ms"
                  >
                    {getPresetLabel(preset)}
                  </button>
                {/each}
              </div>
            {:else if shouldShowUsdValue}
              <!-- USD value when amount is entered -->
              <span class="deposit-usd-value">
                {#if loading}
                  <span class="deposit-loading-dots">...</span>
                {:else if formattedUsdValue}
                  {formattedUsdValue}
                {:else}
                  &nbsp;
                {/if}
              </span>
            {/if}
          </div>
          {#if shouldShowBalance}
            {#if balance === 0n && onDepositClick && !disabled && !readonly}
              <button type="button" class="deposit-balance deposit-hint" onclick={onDepositClick}>
                No balance · <span class="deposit-hint-link">Deposit</span>
              </button>
            {:else}
              <span class="deposit-balance">
                {size === 'sm' ? formattedBalance : `Balance: ${formattedBalance}`}
              </span>
            {/if}
          {/if}
        </div>
      {/if}
    {/if}
  </div>

  <!-- Error Message -->
  {#if !skeleton && error}
    <p class="deposit-error-message">{error}</p>
  {/if}
</div>

<style>
  .deposit-input-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .deposit-input-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground);
  }

  .deposit-input-card {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 16px;
    background: var(--field);
    border: 1px solid transparent;
    border-radius: 20px;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .deposit-input-card:hover:not(.deposit-input-disabled):not(.deposit-input-readonly):not(:focus-within) {
    background: var(--field-hover);
  }

  .deposit-input-card:focus-within:not(.deposit-input-disabled):not(.deposit-input-readonly) {
    background: var(--field-active);
    border-color: var(--field-border);
  }

  .deposit-input-card.deposit-input-error {
    outline: 1px solid var(--destructive);
  }

  .deposit-input-card.deposit-input-disabled {
    background: var(--field-disabled);
    cursor: not-allowed;
  }

  .deposit-input-card.deposit-input-readonly {
    opacity: 0.8;
    background: var(--muted);
  }

  /* Input Row */
  .deposit-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .deposit-amount-input {
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

  .deposit-amount-input::placeholder {
    color: var(--muted-foreground);
    opacity: 0.4;
  }

  .deposit-amount-input:disabled {
    cursor: not-allowed;
  }

  /* Token Badge */
  .deposit-token-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .deposit-token-symbol {
    font-size: 18px;
    font-weight: 600;
    color: var(--foreground);
  }

  .deposit-token-clickable {
    cursor: pointer;
    padding: 4px 8px;
    border-radius: var(--radius-lg);
    border: none;
    background: var(--background);
    transition: background 150ms ease;
  }

  .deposit-token-clickable:hover {
    background: var(--muted);
  }

  .deposit-token-chevron {
    color: var(--muted-foreground);
    flex-shrink: 0;
  }

  /* Info Row - fixed height to prevent shift between presets and USD value */
  .deposit-info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 28px;
  }

  .deposit-info-left {
    display: flex;
    align-items: center;
  }

  /* Preset buttons at bottom left - matches Uniswap Add Liquidity */
  .deposit-presets-row {
    display: flex;
    gap: 4px;
    /* Animation: appear on hover with left-to-right stagger */
    opacity: 0;
    transform: translateY(-4px);
    transition: opacity 100ms ease, transform 100ms ease;
  }

  /* Show presets on card hover */
  .deposit-input-card:hover .deposit-presets-row,
  .deposit-input-card:focus-within .deposit-presets-row {
    opacity: 1;
    transform: translateY(0);
  }

  .deposit-preset-btn {
    padding: 4px 8px;
    font-size: 14px;
    font-weight: 485;
    color: var(--foreground);
    background: var(--surface-2, var(--card));
    border: 1px solid var(--surface-3, var(--border));
    border-radius: 16px;
    cursor: pointer;
    /* Individual button animation with left-to-right stagger */
    opacity: 0;
    transform: translateY(-4px) scale(0.95);
    transition:
      opacity 200ms ease,
      transform 200ms ease,
      background-color 100ms ease,
      border-color 100ms ease;
    transition-delay: var(--stagger-delay);
  }

  /* Animate individual buttons on hover */
  .deposit-input-card:hover .deposit-preset-btn,
  .deposit-input-card:focus-within .deposit-preset-btn {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  /* Button hover - matches Uniswap hoverStyle: { scale: 1.02 } */
  .deposit-preset-btn:hover:not(:disabled) {
    background: var(--surface-3, var(--muted));
    transform: translateY(0) scale(1.02);
  }

  /* Button press - matches Uniswap pressStyle: { scale: 0.99 } */
  .deposit-preset-btn:active:not(:disabled) {
    transform: translateY(0) scale(0.99);
  }

  .deposit-preset-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .deposit-usd-value {
    font-size: 14px;
    color: var(--muted-foreground);
  }

  .deposit-balance {
    font-size: 14px;
    color: var(--muted-foreground);
  }

  .deposit-hint {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
  }

  .deposit-hint-link {
    color: var(--ring);
    font-weight: 500;
  }

  .deposit-hint:hover .deposit-hint-link {
    text-decoration: underline;
  }

  .deposit-loading-dots {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }

  /* Error Message */
  .deposit-error-message {
    font-size: 13px;
    color: var(--destructive);
    margin: 0;
  }

  /* ========================================
     SIZE VARIANTS
     ======================================== */

  /* Medium size (md) - 24px input font */
  .deposit-size-md .deposit-input-card {
    padding: 12px;
    border-radius: 16px;
  }

  .deposit-size-md .deposit-amount-input {
    font-size: 24px;
  }

  .deposit-size-md .deposit-token-badge {
    gap: 6px;
  }

  .deposit-size-md .deposit-token-symbol {
    font-size: 16px;
  }

  .deposit-size-md .deposit-info-row {
    height: 24px;
  }

  .deposit-size-md .deposit-usd-value,
  .deposit-size-md .deposit-balance {
    font-size: 12px;
  }

  .deposit-size-md .deposit-preset-btn {
    padding: 3px 6px;
    font-size: 12px;
    border-radius: 12px;
  }

  .deposit-size-md .deposit-input-label {
    font-size: 12px;
  }

  .deposit-size-md .deposit-error-message {
    font-size: 11px;
  }

  /* Small size (sm) - 18px input font, compact trading style */
  .deposit-size-sm .deposit-input-card {
    padding: 8px 10px;
    border-radius: 12px;
    gap: 4px;
  }

  .deposit-size-sm .deposit-amount-input {
    font-size: 18px;
  }

  .deposit-size-sm .deposit-token-badge {
    gap: 4px;
  }

  .deposit-size-sm .deposit-token-symbol {
    font-size: 14px;
  }

  .deposit-size-sm .deposit-info-row {
    height: 20px;
    min-height: 18px;
  }

  .deposit-size-sm .deposit-usd-value,
  .deposit-size-sm .deposit-balance {
    font-size: 11px;
  }

  .deposit-size-sm .deposit-preset-btn {
    padding: 2px 6px;
    font-size: 11px;
    font-weight: 500;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  .deposit-size-sm .deposit-input-label {
    font-size: 14px;
  }

  .deposit-size-sm .deposit-error-message {
    font-size: 11px;
  }

  /* ========================================
     SKELETON MODE
     ======================================== */

  .deposit-skeleton {
    background: var(--muted);
    border-radius: var(--radius-sm);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .deposit-skeleton-input-overlay {
    position: absolute;
    top: 16px;
    left: 16px;
    width: 40%;
    height: 36px;
    border-radius: var(--radius-sm);
  }

  .deposit-skeleton-icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .deposit-skeleton-symbol {
    width: 48px;
    height: 18px;
    flex-shrink: 0;
  }

  .deposit-skeleton-usd {
    width: 52px;
    height: 14px;
  }

  /* Size variant overrides for skeleton */
  .deposit-size-md .deposit-skeleton-input-overlay {
    top: 12px;
    left: 12px;
    height: 24px;
  }

  .deposit-size-md .deposit-skeleton-icon {
    width: 20px;
    height: 20px;
  }

  .deposit-size-md .deposit-skeleton-symbol {
    width: 40px;
    height: 16px;
  }

  .deposit-size-sm .deposit-skeleton-input-overlay {
    top: 8px;
    left: 10px;
    height: 18px;
  }

  .deposit-size-sm .deposit-skeleton-icon {
    width: 16px;
    height: 16px;
  }

  .deposit-size-sm .deposit-skeleton-symbol {
    width: 36px;
    height: 14px;
  }
</style>
