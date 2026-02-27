<script lang="ts">
  import type { QuoteResult as QuoteResultType, VenueBreakdown, VenueId } from 'declarations/spot/spot.did';
  import { bigIntToString, tickToPrice, bpsToPercent } from "$lib/domain/markets/utils";
  import { getDisplayDecimals } from "$lib/utils/format.utils";
  import Logo from "$lib/components/ui/Logo.svelte";

  interface Props {
    isCalculating: boolean;
    quoteError?: string | null;
    quote: QuoteResultType | null;
    token0Symbol: string;
    token1Symbol: string;
    token0Decimals: number;
    token1Decimals: number;
    token0Logo?: string;
    token1Logo?: string;
    side: "Buy" | "Sell";
    /** User's requested input amount (for calculating fill %) */
    inputAmount?: bigint;
    /** The market tick when the quote was calculated */
    referenceTick?: number | null;
    /** The current live market tick */
    currentTick?: number;
  }

  let { isCalculating, quoteError = null, quote, token0Symbol, token1Symbol, token0Decimals, token1Decimals, token0Logo, token1Logo, side, inputAmount, referenceTick, currentTick }: Props = $props();

  let isExpanded = $state(false);

  // Estimated fill percentage: what portion will execute immediately
  // Sum venue_breakdown input amounts (actual immediate fills) vs user's requested amount
  // 100% = full immediate fill, <100% = partial fill (rest goes to book)
  let fillPercent = $derived.by(() => {
    if (!quote || !inputAmount || inputAmount === 0n) return null;

    // Sum input_amount from all venues in breakdown - this is what actually fills immediately
    const filledFromVenues = quote.venue_breakdown.reduce(
      (sum, venue) => sum + Number(venue.input_amount),
      0
    );

    const requested = Number(inputAmount);
    if (requested === 0) return null;
    return Math.min(100, (filledFromVenues / requested) * 100);
  });

  // Fill percentage styling thresholds
  let isFullFill = $derived(fillPercent !== null && fillPercent >= 99.9);
  let isPartialFill = $derived(fillPercent !== null && fillPercent > 0 && fillPercent < 99.9);
  let isNoFill = $derived(fillPercent !== null && fillPercent === 0);

  // Tick divergence detection: has the market moved since the quote?
  // Shows "updating" indicator when tick has changed
  let tickDiverged = $derived.by(() => {
    if (referenceTick === null || referenceTick === undefined) return false;
    if (currentTick === undefined) return false;
    return referenceTick !== currentTick;
  });

  // Price impact: convert from bps to percentage
  let priceImpactPercent = $derived(quote ? bpsToPercent(quote.price_impact_bps) : 0);

  // Warning thresholds
  let isHighImpact = $derived(priceImpactPercent >= 1);
  let isVeryHighImpact = $derived(priceImpactPercent >= 3);

  // Exchange rate from effective tick
  let executionPrice = $derived(quote ? tickToPrice(quote.effective_tick, token0Decimals, token1Decimals) : 0);
  let priceDecimals = $derived(getDisplayDecimals(executionPrice));

  // Token mapping based on side
  // Buy: spend token1 (quote) → receive token0 (base)
  // Sell: spend token0 (base) → receive token1 (quote)
  let inputTokenSymbol = $derived(side === "Buy" ? token1Symbol : token0Symbol);
  let inputTokenDecimals = $derived(side === "Buy" ? token1Decimals : token0Decimals);
  let inputTokenLogo = $derived(side === "Buy" ? token1Logo : token0Logo);
  let outputTokenSymbol = $derived(side === "Buy" ? token0Symbol : token1Symbol);
  let outputTokenDecimals = $derived(side === "Buy" ? token0Decimals : token1Decimals);
  let outputTokenLogo = $derived(side === "Buy" ? token0Logo : token1Logo);

  // Formatted values from quote
  let totalFeesFormatted = $derived(
    quote ? bigIntToString(quote.total_fees, inputTokenDecimals) : "0"
  );

  // Price impact is favorable when <= 0 (better than mid), unfavorable when > 0
  let isFavorableImpact = $derived(priceImpactPercent <= 0);
  let priceImpactFormatted = $derived(`${Math.abs(priceImpactPercent).toFixed(2)}%`);

  function toggleExpanded() {
    isExpanded = !isExpanded;
  }

  function isBookVenue(venue_id: VenueId): boolean {
    return 'book' in venue_id;
  }

  function getVenueLabel(venue_id: VenueId): string {
    if ('book' in venue_id) return 'Book';
    if ('pool' in venue_id) return `Pool-${venue_id.pool / 100}`;
    return 'Unknown';
  }

  // Allocation percentage per venue (using backend-provided input_amount)
  function getAllocationPercent(venue: VenueBreakdown): number {
    if (!quote || quote.input_amount === 0n) return 0;
    return (Number(venue.input_amount) / Number(quote.input_amount)) * 100;
  }

  // Venues sorted by allocation % (highest first)
  let sortedVenues = $derived(
    quote?.venue_breakdown.toSorted((a, b) => Number(b.input_amount) - Number(a.input_amount)) ?? []
  );
</script>

<!-- Quote Display -->
{#if quoteError}
  <div class="quote-card">
    <div class="quote-content">
      <p class="quote-error">{quoteError}</p>
    </div>
  </div>
{:else if quote || isCalculating}
  <div class="quote-card" class:is-loading={isCalculating} class:is-updating={tickDiverged && !isCalculating}>
    <!-- Estimated Fill Percentage (shown at top when inputAmount provided) -->
    {#if inputAmount !== undefined}
      <div class="fill-indicator" class:fill-full={isFullFill} class:fill-partial={isPartialFill} class:fill-none={isNoFill}>
        <div class="fill-header">
          <span class="fill-label">Est. fill</span>
          {#if isCalculating}
            <div class="skeleton skeleton-fill"></div>
          {:else if fillPercent !== null}
            <span class="fill-value">{fillPercent.toFixed(1)}%</span>
          {:else}
            <span class="fill-value">—</span>
          {/if}
        </div>
        {#if !isCalculating && fillPercent !== null && fillPercent < 100}
          <div class="fill-bar-container">
            <div class="fill-bar" style="width: {fillPercent}%"></div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Expandable details -->
    {#if isExpanded}
      <div class="quote-details">
        <!-- Primary quote info -->
        <div class="quote-row">
          <span class="quote-label">Market impact</span>
          {#if isCalculating}
            <div class="skeleton skeleton-value-sm"></div>
          {:else}
            <span class="quote-value" class:quote-value-favorable={isFavorableImpact} class:quote-value-warning={!isFavorableImpact && isHighImpact} class:quote-value-severe={!isFavorableImpact && isVeryHighImpact}>{priceImpactFormatted}</span>
          {/if}
        </div>

        <div class="quote-row">
          <span class="quote-label">Total fees</span>
          {#if isCalculating}
            <div class="skeleton skeleton-value-md"></div>
          {:else}
            <span class="quote-value">{totalFeesFormatted} {inputTokenSymbol}</span>
          {/if}
        </div>

        <div class="quote-row">
          <span class="quote-label">Rate</span>
          {#if isCalculating}
            <div class="skeleton skeleton-value-lg"></div>
          {:else}
            <span class="quote-value">1 {token0Symbol} = {executionPrice.toFixed(priceDecimals)} {token1Symbol}</span>
          {/if}
        </div>

        <!-- Venue allocation breakdown -->
        <div class="venue-section">
          <div class="venue-section-header">
            <span class="venue-title">Routing</span>
          </div>
          <div class="venue-list">
            {#if isCalculating}
              <div class="venue-card">
                <div class="venue-badges">
                  <div class="skeleton skeleton-badge"></div>
                  <div class="skeleton skeleton-badge skeleton-badge-sm"></div>
                </div>
                <div class="venue-amounts">
                  <div class="venue-amount-item"><div class="skeleton skeleton-amount"></div></div>
                  <span class="venue-arrow">→</span>
                  <div class="venue-amount-item"><div class="skeleton skeleton-amount"></div></div>
                </div>
              </div>
            {:else if quote && sortedVenues.length > 0}
              {#each sortedVenues as venue, i (i)}
                <div class="venue-card">
                  <span class="venue-badge" class:is-book={isBookVenue(venue.venue_id)} class:is-pool={!isBookVenue(venue.venue_id)}>
                    {getVenueLabel(venue.venue_id)}: {getAllocationPercent(venue).toFixed(0)}%
                  </span>
                  <div class="venue-amounts">
                    <div class="venue-amount-item">
                      <span class="venue-amount-value">{bigIntToString(venue.input_amount, inputTokenDecimals)}</span>
                      <Logo src={inputTokenLogo} alt={inputTokenSymbol} size="xxs" circle />
                    </div>
                    <span class="venue-arrow">→</span>
                    <div class="venue-amount-item">
                      <span class="venue-amount-value">{bigIntToString(venue.output_amount, outputTokenDecimals)}</span>
                      <Logo src={outputTokenLogo} alt={outputTokenSymbol} size="xxs" circle />
                    </div>
                  </div>
                </div>
              {/each}
            {:else}
              <span class="venue-empty">No venue data</span>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- Expand/Collapse button -->
    <button type="button" onclick={toggleExpanded} class="quote-expand-btn">
      <span>{isExpanded ? "Less" : "Details"}</span>
      <svg class="quote-expand-icon {isExpanded ? 'rotated' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  </div>
{/if}

<style>
  /* Main card */
  .quote-card {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    transition: opacity 150ms ease;
  }

  /* Updating state - subtle indicator that quote is refreshing */
  .quote-card.is-updating {
    opacity: 0.7;
  }

  /* Fill Indicator */
  .fill-indicator {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .fill-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .fill-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--muted-foreground);
  }

  .fill-value {
    font-size: 14px;
    font-weight: 600;
    font-family: var(--font-mono);
  }

  /* Fill states */
  .fill-full .fill-value {
    color: hsl(142 71% 45%);
  }

  .fill-partial .fill-value {
    color: hsl(45 93% 47%);
  }

  .fill-none .fill-value {
    color: var(--muted-foreground);
  }

  /* Progress bar */
  .fill-bar-container {
    height: 4px;
    background: var(--muted);
    border-radius: 2px;
    overflow: hidden;
  }

  .fill-bar {
    height: 100%;
    background: hsl(45 93% 47%);
    border-radius: 2px;
    transition: width 300ms ease;
  }

  .skeleton-fill {
    width: 40px;
    height: 16px;
  }

  /* Skeleton loading states */
  .skeleton {
    background: var(--muted);
    border-radius: 4px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-value-sm {
    width: 80px;
    height: 14px;
  }

  .skeleton-value-md {
    width: 100px;
    height: 14px;
  }

  .skeleton-value-lg {
    width: 140px;
    height: 14px;
  }

  .venue-empty {
    font-size: 12px;
    color: var(--muted-foreground);
    margin: 0;
    padding: 8px 0;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* Content area */
  .quote-content {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .quote-error {
    font-size: 12px;
    color: var(--destructive);
    margin: 0;
  }

  /* Quote rows */
  .quote-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .quote-label {
    font-size: 12px;
    color: var(--muted-foreground);
    flex-shrink: 0;
  }

  .quote-value {
    font-size: 12px;
    font-weight: 500;
    color: var(--foreground);
    text-align: right;
  }

  .quote-value-favorable {
    color: var(--color-bullish);
  }

  .quote-value-warning {
    color: var(--color-bearish);
  }

  .quote-value-severe {
    color: var(--color-bearish);
  }

  /* Expanded details */
  .quote-details {
    padding: 0 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-top: 1px solid var(--border);
    padding-top: 12px;
    margin-top: 0;
  }

  /* Venue section */
  .venue-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .venue-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .venue-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--muted-foreground);
  }

  .venue-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .venue-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .venue-badges {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .venue-badge {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 500;
    border-radius: var(--radius-sm);
    border: 1px solid;
  }

  .venue-badge.is-book {
    border-color: oklch(0.70 0.16 55 / 0.4);
    background: oklch(0.70 0.16 55 / 0.1);
    color: oklch(0.70 0.16 55);
  }

  .venue-badge.is-pool {
    border-color: oklch(from var(--color-bullish) l c h / 0.4);
    background: oklch(from var(--color-bullish) l c h / 0.1);
    color: var(--color-bullish);
  }

  .skeleton-badge {
    width: 70px;
    height: 22px;
    border-radius: 6px;
  }

  .skeleton-badge-sm {
    width: 55px;
  }

  .venue-amounts {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
  }

  .venue-amount-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .venue-amount-item:first-child {
    justify-self: start;
  }

  .venue-amount-item:last-child {
    justify-self: end;
  }

  .venue-amount-value {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--foreground);
  }

  .venue-arrow {
    justify-self: center;
    font-size: 10px;
    color: var(--muted-foreground);
  }

  .skeleton-amount {
    width: 60px;
    height: 11px;
  }

  /* Expand button */
  .quote-expand-btn {
    width: 100%;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 11px;
    color: var(--muted-foreground);
    background: transparent;
    border: none;
    border-top: 1px solid var(--border);
    cursor: pointer;
    transition: color 150ms ease;
  }

  .quote-expand-btn:hover {
    color: var(--foreground);
  }

  .quote-expand-icon {
    width: 12px;
    height: 12px;
    transition: transform 200ms ease;
  }

  .quote-expand-icon.rotated {
    transform: rotate(180deg);
  }
</style>
