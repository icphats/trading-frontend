<script lang="ts">
  import type { QuoteResult as QuoteResultType, VenueBreakdown, VenueId } from 'declarations/spot/spot.did';
  import { bigIntToString, tickToPrice, usdImpactPercent } from "$lib/domain/markets/utils";
  import { getDisplayDecimals } from "$lib/utils/format.utils";
  import Logo from "$lib/components/ui/Logo.svelte";
  import InfoTip from "$lib/components/ui/InfoTip.svelte";

  interface Props {
    isCalculating: boolean;
    quoteError?: string | null;
    quote: QuoteResultType | null;
    baseSymbol: string;
    quoteSymbol: string;
    baseDecimals: number;
    quoteDecimals: number;
    baseLogo?: string;
    quoteLogo?: string;
    side: "Buy" | "Sell";
    /** User's requested input amount (for calculating fill %) */
    inputAmount?: bigint;
    /** The market tick when the quote was calculated */
    referenceTick?: number | null;
    /** The current live market tick */
    currentTick?: number;
    /** Input USD value (for USD-derived impact calculation) */
    inputUsdValue?: number | null;
    /** Output USD value (for USD-derived impact calculation) */
    outputUsdValue?: number | null;
    /** Compact mode — only shows price impact row, no routing */
    compact?: boolean;
  }

  let { isCalculating, quoteError = null, quote, baseSymbol, quoteSymbol, baseDecimals, quoteDecimals, baseLogo, quoteLogo, side, inputAmount, referenceTick, currentTick, inputUsdValue, outputUsdValue, compact = false }: Props = $props();

  let isExpanded = $state(false);

  // Estimated fill percentage: what portion will execute immediately
  // Sum venue_breakdown input amounts (actual immediate fills) vs user's requested amount
  // 100% = full immediate fill, <100% = partial fill (rest goes to book)
  let fillPercent = $derived.by(() => {
    if (!quote || !inputAmount || inputAmount === 0n) return null;

    // Sum input_amount from all venues in breakdown - this is what actually fills immediately
    const filledFromVenues = quote.venue_breakdown.reduce(
      (sum: number, venue: VenueBreakdown) => sum + Number(venue.input_amount),
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

  // Price impact: derived from USD values so it's always 1:1 with displayed USD
  // impact = (inputUSD - outputUSD) / inputUSD × 100 — includes fees
  let priceImpactPercent = $derived.by(() => {
    if (!inputUsdValue || !outputUsdValue || inputUsdValue === 0) return 0;
    return usdImpactPercent(inputUsdValue, outputUsdValue);
  });

  // Warning thresholds
  let isHighImpact = $derived(priceImpactPercent >= 1);
  let isVeryHighImpact = $derived(priceImpactPercent >= 3);

  // Exchange rate from effective tick
  let executionPrice = $derived(quote ? tickToPrice(quote.effective_tick, baseDecimals, quoteDecimals) : 0);
  let priceDecimals = $derived(getDisplayDecimals(executionPrice));

  // Token mapping based on side
  // Buy: spend quote → receive base
  // Sell: spend base → receive quote
  let inputTokenSymbol = $derived(side === "Buy" ? quoteSymbol : baseSymbol);
  let inputTokenDecimals = $derived(side === "Buy" ? quoteDecimals : baseDecimals);
  let inputTokenLogo = $derived(side === "Buy" ? quoteLogo : baseLogo);
  let outputTokenSymbol = $derived(side === "Buy" ? baseSymbol : quoteSymbol);
  let outputTokenDecimals = $derived(side === "Buy" ? baseDecimals : quoteDecimals);
  let outputTokenLogo = $derived(side === "Buy" ? baseLogo : quoteLogo);

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
    quote?.venue_breakdown.toSorted((a: VenueBreakdown, b: VenueBreakdown) => Number(b.input_amount) - Number(a.input_amount)) ?? []
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
    <!-- Always-visible rows -->
    <div class="quote-rows">
      {#if !compact && inputAmount !== undefined}
        <div class="quote-row" class:fill-full={isFullFill} class:fill-partial={isPartialFill} class:fill-none={isNoFill}>
          <span class="quote-label-group">
            <span class="quote-label">Est. fill</span>
            <InfoTip text="Percentage of your order that fills immediately. Remainder rests on the book." />
          </span>
          {#if isCalculating}
            <div class="skeleton skeleton-fill"></div>
          {:else if fillPercent !== null}
            <span class="quote-value fill-value">{fillPercent.toFixed(1)}%</span>
          {:else}
            <span class="quote-value fill-value">—</span>
          {/if}
        </div>
      {/if}

      {#if isCalculating || (inputUsdValue && outputUsdValue)}
        <div class="quote-row">
          <span class="quote-label-group">
            <span class="quote-label">Price impact</span>
            <InfoTip text="How much this trade moves the price, including fees." />
          </span>
          {#if isCalculating}
            <div class="skeleton skeleton-value-sm"></div>
          {:else}
            <span class="quote-value" class:quote-value-favorable={isFavorableImpact} class:quote-value-warning={!isFavorableImpact && isHighImpact} class:quote-value-severe={!isFavorableImpact && isVeryHighImpact}>{priceImpactFormatted}</span>
          {/if}
        </div>
      {/if}

      {#if !compact}
        <div class="quote-row">
          <span class="quote-label-group">
            <span class="quote-label">Total fees</span>
            <InfoTip text="Sum of fees across all venues used to fill this order." />
          </span>
          {#if isCalculating}
            <div class="skeleton skeleton-value-md"></div>
          {:else}
            <span class="quote-value">{totalFeesFormatted} {inputTokenSymbol}</span>
          {/if}
        </div>

        <div class="quote-row">
          <span class="quote-label-group">
            <span class="quote-label">Rate</span>
            <InfoTip text="Effective execution price across all venues." />
          </span>
          {#if isCalculating}
            <div class="skeleton skeleton-value-lg"></div>
          {:else}
            <span class="quote-value">1 {baseSymbol} = {executionPrice.toFixed(priceDecimals)} {quoteSymbol}</span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Routing: collapsed trigger -->
    {#if !compact}
    <div class="routing-section">
      {#if isCalculating}
        <button type="button" class="routing-collapsed" disabled>
          <span class="routing-summary">— venue(s)</span>
          <span class="total-fees">— fee</span>
          <svg class="routing-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 9l-7 7-7-7"/></svg>
        </button>
      {:else if quote && sortedVenues.length > 0}
        <button type="button" class="routing-collapsed" onclick={toggleExpanded}>
          <span class="routing-summary">{sortedVenues.length} venue{sortedVenues.length !== 1 ? 's' : ''}</span>
          <span class="total-fees">{totalFeesFormatted} {inputTokenSymbol} fee</span>
          <svg class="routing-chevron" class:expanded={isExpanded} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 9l-7 7-7-7"/></svg>
        </button>

        <!-- Expanded: per-venue details -->
        {#if isExpanded}
          <div class="routing-details">
            {#each sortedVenues as venue, i (i)}
              <div class="venue-card">
                <span class="venue-heading">{getVenueLabel(venue.venue_id)} <span class="venue-heading-pct">({getAllocationPercent(venue).toFixed(0)}%)</span></span>
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
                <div class="venue-fee-row">
                  <span class="venue-fee-label">Fee</span>
                  <span class="venue-fee-value">{bigIntToString(venue.fee_amount, inputTokenDecimals)} {inputTokenSymbol}</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
    {/if}
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

  /* Always-visible rows container */
  .quote-rows {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Fill value styling */
  .fill-value {
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

  .skeleton-fill {
    width: 40px;
    height: 14px;
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

  /* Label group (label + InfoTip) */
  .quote-label-group {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  /* Routing section */
  .routing-section {
    padding: 8px 12px;
    border-top: 1px solid var(--border);
  }

  /* Collapsed: venue count + fees + chevron */
  .routing-collapsed {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: inherit;
    width: 100%;
  }

  .routing-collapsed:disabled {
    cursor: default;
    opacity: 0.5;
  }

  .routing-summary {
    font-size: 12px;
    font-weight: 500;
    color: var(--foreground);
    flex-shrink: 0;
  }

  .total-fees {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--muted-foreground);
    margin-left: auto;
    white-space: nowrap;
  }

  .routing-chevron {
    color: var(--muted-foreground);
    flex-shrink: 0;
    transition: transform 150ms ease;
  }

  .routing-chevron.expanded {
    transform: rotate(180deg);
  }

  /* Expanded venue details */
  .routing-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
    margin-top: 0.5rem;
  }

  .venue-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .venue-card + .venue-card {
    border-top: 1px solid var(--border);
    padding-top: 0.75rem;
  }

  .venue-heading {
    font-size: 12px;
    font-weight: 600;
    color: var(--foreground);
  }

  .venue-heading-pct {
    font-weight: 400;
    color: var(--muted-foreground);
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

  .venue-fee-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .venue-fee-label {
    font-size: 11px;
    color: var(--muted-foreground);
  }

  .venue-fee-value {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--muted-foreground);
  }
</style>
