<script lang="ts">
  /**
   * UnifiedListRow - Configurable row for tokens and markets
   *
   * Displays entity data with flag-based display options:
   * - Token: logo, symbol, name + balance/value OR price/change
   * - Market: pair logos, pair symbol, name + price/change/volume
   *
   * Usage:
   * <!-- Token with balance and favorite star -->
   * <UnifiedListRow
   *   type="token"
   *   id={token.canisterId}
   *   logo={token.logo}
   *   primaryLabel={token.symbol}
   *   secondaryLabel={token.name}
   *   balance={{ amount: "12.34", raw: 1234000000n }}
   *   usdValue={123.45}
   *   showBalance
   *   showUsdValue
   *   isFavorite={true}
   *   onFavorite={() => toggleFavorite()}
   *   onClick={() => handleClick(token)}
   * />
   *
   * <!-- Market with price/change and favorite star -->
   * <UnifiedListRow
   *   type="market"
   *   id={market.canisterId}
   *   pairLogos={{ base: logoA, quote: logoB }}
   *   pairSymbols={{ base: "PARTY", quote: "ICP" }}
   *   primaryLabel="PARTY/ICP"
   *   secondaryLabel="Party Token"
   *   price={12.50}
   *   priceChange={5.23}
   *   showPrice
   *   showPriceChange
   *   isFavorite={true}
   *   onFavorite={() => toggleFavorite()}
   *   onClick={() => selectMarket()}
   * />
   */

  import Logo from '$lib/components/ui/Logo.svelte';
  import TokenPairLogo from '$lib/components/ui/TokenPairLogo.svelte';
  import { formatUSD } from '$lib/utils/format.utils';

  type RowType = 'token' | 'market';

  interface Props {
    // Entity identification
    type: RowType;
    id: string;

    // Logo data
    logo?: string | null;
    pairLogos?: { base?: string; quote?: string };
    pairSymbols?: { base: string; quote: string };

    // Labels
    primaryLabel: string;
    secondaryLabel?: string;

    // Value data (show based on flags)
    balance?: { amount: string; raw: bigint };
    usdValue?: number;
    price?: number;
    priceChange?: number;
    volume?: number;

    // Display flags
    showBalance?: boolean;
    showUsdValue?: boolean;
    showPrice?: boolean;
    showPriceChange?: boolean;
    showVolume?: boolean;

    // State
    isFavorite?: boolean;
    isSelected?: boolean;
    isLoading?: boolean;

    // Callbacks
    onClick?: () => void;
    onFavorite?: () => void;

    // Sizing
    size?: 'sm' | 'md';
    logoSize?: 'xs' | 'sm' | 'md';
  }

  let {
    type,
    id,
    logo,
    pairLogos,
    pairSymbols,
    primaryLabel,
    secondaryLabel,
    balance,
    usdValue,
    price,
    priceChange,
    volume,
    showBalance = false,
    showUsdValue = false,
    showPrice = false,
    showPriceChange = false,
    showVolume = false,
    isFavorite = false,
    isSelected = false,
    isLoading = false,
    onClick,
    onFavorite,
    size = 'md',
    logoSize = 'sm',
  }: Props = $props();

  // Format helpers
  function formatPrice(value: number): string {
    if (value === 0) return '$0.00';
    if (value < 0.01) return `$${value.toFixed(6)}`;
    if (value < 1) return `$${value.toFixed(4)}`;
    if (value < 1000) return `$${value.toFixed(2)}`;
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  function formatPriceChangeStr(change: number): string {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  }

  function formatVolumeStr(value: number): string {
    if (value === 0) return '$0';
    if (value < 1000) return `$${value.toFixed(0)}`;
    if (value < 1_000_000) return `$${(value / 1000).toFixed(1)}K`;
    if (value < 1_000_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }

  // Derived states
  let isPositive = $derived(priceChange !== undefined && priceChange >= 0);

  function handleClick(e: MouseEvent) {
    // Don't trigger row click when clicking star
    if ((e.target as HTMLElement).closest('.star-button')) return;
    onClick?.();
  }

  function handleStarClick(e: MouseEvent) {
    e.stopPropagation();
    onFavorite?.();
  }
</script>

<button
  class="unified-row"
  class:size-sm={size === 'sm'}
  class:size-md={size === 'md'}
  class:selected={isSelected}
  class:loading={isLoading}
  class:clickable={!!onClick}
  onclick={handleClick}
  disabled={isLoading}
>
  <!-- Left: Logo + Labels -->
  <div class="row-left">
    {#if type === 'market' && pairLogos && pairSymbols}
      <TokenPairLogo
        baseLogo={pairLogos.base}
        quoteLogo={pairLogos.quote}
        baseSymbol={pairSymbols.base}
        quoteSymbol={pairSymbols.quote}
        size={logoSize === 'xs' ? 'xxs' : logoSize === 'sm' ? 'xs' : 'sm'}
      />
    {:else}
      <Logo src={logo ?? undefined} alt={primaryLabel} size={logoSize} circle />
    {/if}

    <div class="row-labels">
      <span class="primary-label">{primaryLabel}</span>
      {#if secondaryLabel}
        <span class="secondary-label">{secondaryLabel}</span>
      {/if}
    </div>
  </div>

  <!-- Right: Values + Star -->
  <div class="row-right">
    <!-- Value columns -->
    <div class="row-values">
      {#if showBalance && balance}
        <span class="value-primary">{balance.amount}</span>
      {/if}

      {#if showPrice && price !== undefined}
        <span class="value-primary">{formatPrice(price)}</span>
      {/if}

      {#if showUsdValue && usdValue !== undefined}
        <span class="value-secondary value-usd">{formatUSD(usdValue, 2)}</span>
      {/if}

      {#if showPriceChange && priceChange !== undefined}
        <span class="value-secondary value-change" class:positive={isPositive} class:negative={!isPositive}>
          {formatPriceChangeStr(priceChange)}
        </span>
      {/if}

      {#if showVolume && volume !== undefined}
        <span class="value-secondary value-volume">{formatVolumeStr(volume)}</span>
      {/if}
    </div>

    <!-- Favorite star -->
    {#if onFavorite}
      <span
        class="star-button"
        class:is-favorite={isFavorite}
        onclick={handleStarClick}
        onkeydown={(e) => e.key === 'Enter' && handleStarClick(e as unknown as MouseEvent)}
        role="button"
        tabindex="0"
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={isFavorite ? 'currentColor' : 'none'}
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </span>
    {/if}
  </div>
</button>

<style>
  .unified-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: transparent;
    border: none;
    text-align: left;
    transition: background-color 150ms ease;
  }

  .size-sm {
    padding: 10px 12px;
    gap: 10px;
  }

  .size-md {
    padding: 0.75rem 1rem;
    gap: 12px;
  }

  .unified-row.clickable {
    cursor: pointer;
  }

  .unified-row.clickable:hover {
    background: var(--hover-overlay);
  }

  .unified-row.clickable:active {
    background: var(--active-overlay);
  }

  .unified-row.selected {
    background: oklch(from var(--primary) l c h / 0.08);
  }

  .unified-row.selected:hover {
    background: oklch(from var(--primary) l c h / 0.12);
  }

  .unified-row.loading {
    opacity: 0.6;
    pointer-events: none;
  }

  /* Left section */
  .row-left {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
  }

  .size-sm .row-left {
    gap: 8px;
  }

  .size-md .row-left {
    gap: 12px;
  }

  .row-labels {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .size-sm .row-labels {
    gap: 1px;
  }

  .size-md .row-labels {
    gap: 2px;
  }

  .primary-label {
    font-weight: 500;
    color: var(--foreground);
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .size-sm .primary-label {
    font-size: 14px;
  }

  .size-md .primary-label {
    font-size: 16px;
  }

  .secondary-label {
    color: var(--muted-foreground);
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .size-sm .secondary-label {
    font-size: 12px;
  }

  .size-md .secondary-label {
    font-size: 14px;
  }

  /* Right section */
  .row-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .row-values {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .size-sm .row-values {
    gap: 1px;
  }

  .size-md .row-values {
    gap: 2px;
  }

  .value-primary {
    font-weight: 500;
    color: var(--foreground);
    font-family: var(--font-sans);
    line-height: 1.25;
  }

  .size-sm .value-primary {
    font-size: 14px;
  }

  .size-md .value-primary {
    font-size: 16px;
  }

  .value-secondary {
    font-family: var(--font-sans);
    line-height: 1.25;
  }

  .size-sm .value-secondary {
    font-size: 12px;
  }

  .size-md .value-secondary {
    font-size: 14px;
  }

  .value-usd {
    color: var(--muted-foreground);
  }

  .value-change {
    font-weight: 500;
  }

  .value-change.positive {
    color: var(--color-bullish, #22c55e);
  }

  .value-change.negative {
    color: var(--color-bearish, #ef4444);
  }

  .value-volume {
    color: var(--muted-foreground);
  }

  /* Star button - always visible */
  .star-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: var(--muted-foreground);
    opacity: 0.4;
    transition: opacity 150ms ease, color 150ms ease, background-color 150ms ease;
  }

  .star-button:hover {
    background: var(--hover-overlay);
    color: var(--foreground);
    opacity: 1;
  }

  .star-button.is-favorite {
    color: var(--color-warning, #eab308);
    opacity: 1;
  }

  .star-button.is-favorite:hover {
    color: oklch(from var(--color-warning, #eab308) calc(l * 0.9) c h);
  }

  /* Brighten star on row hover */
  .unified-row:hover .star-button:not(.is-favorite) {
    opacity: 0.7;
  }
</style>
