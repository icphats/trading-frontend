<script lang="ts">
  /**
   * Hero Quote Explorer Widget
   *
   * Classic swap interface: input → output with venue badges strip.
   * Paired with mini orderbook to communicate hybrid CLOB+AMM.
   */

  import MiniOrderBook from './MiniOrderBook.svelte';
  import ConfirmationModal from '$lib/components/portal/modals/specific/ConfirmationModal.svelte';
  import TokenAmountInput from '$lib/components/ui/inputs/TokenAmountInput.svelte';
  import MarketSelectionModal from './MarketSelectionModal.svelte';
  import { quoteExplorerState } from './quoteExplorer.state.svelte';
  import { bigIntToString, bpsToPercent } from '$lib/domain/markets/utils';
  import { checkAndApprove } from '$lib/utils/allowance.utils';
  import { user } from '$lib/domain/user/auth.svelte';
  import type { VenueId } from 'declarations/spot/spot.did';
  import { api } from '$lib/actors/api.svelte';
  import { onDestroy } from 'svelte';

  let marketModalOpen = $state(false);
  let swapModalOpen = $state(false);

  function handleFlipSide() {
    const newSide = quoteExplorerState.side === 'buy' ? 'sell' : 'buy';
    quoteExplorerState.setSide(newSide);
  }

  function handleInputChange(value: string) {
    quoteExplorerState.setInputAmount(value);
  }

  function handleMarketSelect(canisterId: string) {
    quoteExplorerState.switchMarket(canisterId);
  }

  // Output display value (readonly)
  let outputDisplay = $derived.by(() => {
    const quote = quoteExplorerState.quote;
    const outputToken = quoteExplorerState.outputToken;
    if (!quote || !outputToken) return '';
    return bigIntToString(quote.output_amount, outputToken.decimals);
  });

  // Venue helpers
  function isBookVenue(venue_id: VenueId): boolean {
    return 'book' in venue_id;
  }

  function getVenueLabel(venue_id: VenueId): string {
    if ('book' in venue_id) return 'Book';
    if ('pool' in venue_id) return `Pool-${venue_id.pool / 100}`;
    return 'Unknown';
  }

  let sortedVenues = $derived(
    quoteExplorerState.quote?.venue_breakdown.toSorted(
      (a, b) => Number(b.input_amount) - Number(a.input_amount)
    ) ?? []
  );

  let priceImpactPercent = $derived(
    quoteExplorerState.quote ? bpsToPercent(quoteExplorerState.quote.price_impact_bps) : 0
  );

  // Track if we've initialized to avoid double-init
  let hasInitialized = $state(false);

  $effect(() => {
    if (api.indexer && !hasInitialized && !quoteExplorerState.isMarketLoading) {
      hasInitialized = true;
      quoteExplorerState.initializeMarket();
    }
  });

  onDestroy(() => {
    quoteExplorerState.reset();
  });

  $effect(() => {
    if (quoteExplorerState.market) {
      quoteExplorerState.refreshOrderbook();

      const interval = setInterval(() => {
        quoteExplorerState.refreshOrderbook();
      }, 2000);

      return () => clearInterval(interval);
    }
  });

  // Pre-approve ICRC-2 allowance when user has a quote
  $effect(() => {
    if (!user.principal || !quoteExplorerState.quote || !quoteExplorerState.market) return;
    const inputToken = quoteExplorerState.inputToken;
    if (!inputToken) return;
    checkAndApprove(inputToken.canisterId, quoteExplorerState.market.canister_id);
  });

  let confirmSide = $derived(quoteExplorerState.side === 'buy' ? 'Buy' as const : 'Sell' as const);

  function buildVenueRouting(quote: NonNullable<typeof quoteExplorerState.quote>) {
    const inputToken = quoteExplorerState.inputToken;
    const outputToken = quoteExplorerState.outputToken;
    if (!inputToken || !outputToken) return undefined;

    const filledFromVenues = quote.venue_breakdown.reduce(
      (sum, v) => sum + Number(v.input_amount), 0
    );
    const requested = Number(quote.input_amount);
    const fillPercent = requested > 0 ? Math.min(100, (filledFromVenues / requested) * 100) : 0;

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
            inputAmount: bigIntToString(v.input_amount, inputToken.decimals),
            outputAmount: bigIntToString(v.output_amount, outputToken.decimals),
            feeAmount: bigIntToString(v.fee_amount, inputToken.decimals),
          };
        }),
      fillPercent,
      totalFees: bigIntToString(quote.total_fees, inputToken.decimals),
      inputSymbol: inputToken.displaySymbol,
      inputLogo: inputToken.logo ?? undefined,
      outputSymbol: outputToken.displaySymbol,
      outputLogo: outputToken.logo ?? undefined,
    };
  }

  let confirmationDetail = $derived.by(() => {
    const quote = quoteExplorerState.quote;
    const inputToken = quoteExplorerState.inputToken;
    const outputToken = quoteExplorerState.outputToken;
    const baseToken = quoteExplorerState.token0;
    if (!quote || !inputToken || !outputToken || !baseToken) return undefined;

    const inputDisplay = bigIntToString(quote.input_amount, inputToken.decimals);
    const outputDisplay = bigIntToString(quote.output_amount, outputToken.decimals);
    const minOutputDisplay = bigIntToString(quote.min_output, outputToken.decimals);
    const impactPct = bpsToPercent(quote.price_impact_bps);
    const impactStr = impactPct < 0.01 ? '< 0.01%' : `${impactPct.toFixed(2)}%`;

    return {
      side: confirmSide,
      baseSymbol: baseToken.displaySymbol,
      baseLogo: baseToken.logo ?? undefined,
      rows: [
        { label: 'Spend', value: `${inputDisplay} ${inputToken.displaySymbol}` },
        { label: 'Receive', value: `~${outputDisplay} ${outputToken.displaySymbol}` },
        { label: 'Min. received', value: `${minOutputDisplay} ${outputToken.displaySymbol}` },
        { label: 'Price impact', value: impactStr },
      ],
      routing: buildVenueRouting(quote),
    };
  });

  async function handleSlowSwap() {
    await quoteExplorerState.executeSlowSwap();
  }
</script>

<div class="hero-swap-widget">
  <div class="swap-column">
    <!-- Swap card -->
    <div class="swap-card">
      {#if !quoteExplorerState.inputToken}
        <!-- Skeleton shell — uses TokenAmountInput's built-in skeleton mode for pixel-perfect height -->
        <TokenAmountInput skeleton showPresets={false} showBalance={false} />

        <div class="arrow-divider">
          <div class="arrow-circle skeleton-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M7 3v18" />
              <path d="M3 7l4-4 4 4" />
              <path d="M17 21V3" />
              <path d="M21 17l-4 4-4-4" />
            </svg>
          </div>
        </div>

        <TokenAmountInput skeleton showPresets={false} showBalance={false} />

        <!-- Skeleton bottom strip -->
        <div class="bottom-strip">
          <div class="strip-info">
            <div class="skeleton skeleton-badge"></div>
            <div class="skeleton skeleton-badge skeleton-badge-sm"></div>
            <div class="skeleton skeleton-impact"></div>
          </div>
          <div class="skeleton skeleton-action-btn"></div>
        </div>
      {:else}
        <!-- Input -->
        <TokenAmountInput
          value={quoteExplorerState.inputAmount}
          token={quoteExplorerState.inputToken}
          onValueChange={handleInputChange}
          onTokenClick={() => marketModalOpen = true}
          disabled={quoteExplorerState.isMarketLoading}
          showPresets={false}
          showBalance={false}
        />

        <!-- Arrow divider (click to flip direction) -->
        <div class="arrow-divider">
          <button type="button" class="arrow-circle" aria-label="Flip swap direction" onclick={handleFlipSide}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M7 3v18" />
              <path d="M3 7l4-4 4 4" />
              <path d="M17 21V3" />
              <path d="M21 17l-4 4-4-4" />
            </svg>
          </button>
        </div>

        <!-- Output (readonly) -->
        {#if quoteExplorerState.outputToken}
          <TokenAmountInput
            value={outputDisplay}
            token={quoteExplorerState.outputToken}
            disabled={quoteExplorerState.isMarketLoading}
            readonly
            loading={quoteExplorerState.isQuoting}
            showPresets={false}
            showBalance={false}
          />
        {/if}

        <!-- Bottom strip: venue badges + impact + action button -->
        {#if quoteExplorerState.quote || quoteExplorerState.isQuoting}
          <div class="bottom-strip">
            <div class="strip-info">
              {#if quoteExplorerState.isQuoting}
                <div class="skeleton skeleton-badge"></div>
                <div class="skeleton skeleton-impact"></div>
              {:else if quoteExplorerState.quote}
                <div class="venue-badges">
                  {#each sortedVenues as venue, i (i)}
                    {@const pct = quoteExplorerState.quote ? (Number(venue.input_amount) / Number(quoteExplorerState.quote.input_amount)) * 100 : 0}
                    <span class="venue-badge" class:is-book={isBookVenue(venue.venue_id)} class:is-pool={!isBookVenue(venue.venue_id)}>
                      {getVenueLabel(venue.venue_id)}
                    </span>
                  {/each}
                </div>
                <span class="impact-text" class:warn={priceImpactPercent >= 1} class:severe={priceImpactPercent >= 3}>
                  {priceImpactPercent < 0.01 ? '< 0.01' : priceImpactPercent.toFixed(2)}% impact
                </span>
              {/if}
            </div>
            <button
              type="button"
              class="action-btn"
              aria-label="Confirm swap"
              disabled={!quoteExplorerState.quote || quoteExplorerState.isQuoting || !user.principal}
              onclick={() => swapModalOpen = true}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        {/if}
      {/if}
    </div>
  </div>

  <div class="orderbook-container">
    <MiniOrderBook
      book={quoteExplorerState.orderbook}
      market={quoteExplorerState.market}
      currentPrice={quoteExplorerState.market?.spotPrice}
      isLoading={quoteExplorerState.isMarketLoading}
    />
  </div>
</div>

<MarketSelectionModal
  bind:open={marketModalOpen}
  markets={quoteExplorerState.marketList}
  currentMarketId={quoteExplorerState.market?.canister_id}
  onSelect={handleMarketSelect}
/>

<ConfirmationModal
  bind:open={swapModalOpen}
  title="Confirm Swap"
  orderDetail={confirmationDetail}
  confirmLabel={`${confirmSide} ${quoteExplorerState.token0?.displaySymbol ?? ''}`}
  variant="primary"
  onConfirm={handleSlowSwap}
  toastMessages={{
    loading: `${confirmSide === 'Buy' ? 'Buying' : 'Selling'} ${quoteExplorerState.token0?.displaySymbol ?? ''}...`,
    success: 'Swap complete',
    error: (err) => err instanceof Error ? err.message : 'Swap failed',
  }}
/>

<style>
  .hero-swap-widget {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    justify-content: center;
    width: 100%;
    max-width: 788px;
    min-width: 0;
    margin: 0 auto;
  }

  .swap-column {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: 0;
    width: min(640px, 100%);
    min-width: 0;
  }

  /* Swap card */
  .swap-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: var(--background);
    border-radius: 24px;
    padding: 4px;
    box-shadow: 0 0 0 1px oklch(1 0 0 / 0.04), 0 0 12px oklch(1 0 0 / 0.03);
    box-sizing: border-box;
    min-width: 0;
  }

  /* Arrow divider */
  .arrow-divider {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 0;
    position: relative;
    z-index: 1;
  }

  .arrow-circle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: var(--background);
    border: 3px solid var(--background);
    color: var(--muted-foreground);
    cursor: pointer;
    transition: color 150ms ease, background 150ms ease;
  }

  .arrow-circle:hover {
    color: var(--foreground);
    background: var(--field-hover);
  }

  /* Bottom strip (inside swap card) */
  .bottom-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px 8px;
  }

  .strip-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .venue-badges {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .venue-badge {
    display: inline-flex;
    align-items: center;
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

  .impact-text {
    font-size: 11px;
    font-weight: 500;
    color: var(--muted-foreground);
    margin-left: auto;
    flex-shrink: 0;
  }

  .impact-text.warn { color: oklch(0.75 0.15 85); }
  .impact-text.severe { color: var(--destructive); }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: var(--primary);
    color: var(--primary-foreground);
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    transition: opacity 150ms ease;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .skeleton-arrow {
    cursor: default;
    color: var(--muted-foreground);
    opacity: 0.5;
  }

  /* Skeleton */
  .skeleton {
    background: var(--muted);
    border-radius: var(--radius-sm);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-badge { width: 70px; height: 22px; border-radius: 6px !important; }
  .skeleton-badge-sm { width: 55px; }
  .skeleton-impact { width: 60px; height: 14px; margin-left: auto; }
  .skeleton-action-btn { width: 32px; height: 32px; border-radius: 10px !important; flex-shrink: 0; }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Orderbook */
  .orderbook-container {
    flex: 0 0 auto;
    width: min(140px, 100%);
    min-width: 0;
    background: var(--background);
    border-radius: 20px;
    box-shadow: 0 0 0 1px oklch(1 0 0 / 0.04), 0 0 12px oklch(1 0 0 / 0.03);
    overflow: hidden;
  }

  /* Mobile: stack vertically with orderbook on top */
  @media (max-width: 767px) {
    .hero-swap-widget {
      flex-direction: column-reverse;
      align-items: center;
      width: min(480px, 100%);
      min-width: 0;
      gap: clamp(4px, 1.5vw, 8px);
    }

    .swap-column {
      flex: 1 1 auto;
      width: 100%;
    }

    .swap-card {
      border-radius: clamp(16px, 5vw, 24px);
      padding: clamp(3px, 1vw, 4px);
    }

    .arrow-circle {
      width: clamp(28px, 7vw, 32px);
      height: clamp(28px, 7vw, 32px);
      border-radius: clamp(8px, 2.5vw, 10px);
    }

    .bottom-strip {
      padding: clamp(2px, 1vw, 4px) clamp(8px, 2.5vw, 12px) clamp(4px, 1.5vw, 8px);
      gap: clamp(4px, 1.5vw, 8px);
    }

    .venue-badge {
      padding: 2px clamp(6px, 2vw, 10px);
      font-size: clamp(10px, 2.8vw, 12px);
    }

    .impact-text {
      font-size: clamp(9px, 2.5vw, 11px);
    }

    .action-btn {
      width: clamp(28px, 7vw, 32px);
      height: clamp(28px, 7vw, 32px);
      border-radius: clamp(8px, 2.5vw, 10px);
    }

    .orderbook-container {
      flex: none;
      width: 100%;
      height: clamp(90px, 25vw, 120px);
      border-radius: clamp(14px, 4vw, 20px);
    }
  }

  /* Compact step-down for small mobile (<480px) */
  @media (max-width: 480px) {
    .swap-card {
      border-radius: 16px;
      padding: 3px;
    }

    .swap-card :global(.deposit-input-card) {
      padding: 10px;
      border-radius: 14px;
    }

    .swap-card :global(.deposit-amount-input) {
      font-size: 24px;
    }

    .swap-card :global(.deposit-token-symbol) {
      font-size: 14px;
    }

    .swap-card :global(.deposit-token-badge) {
      gap: 5px;
    }

    .swap-card :global(.deposit-info-row) {
      height: 22px;
    }

    .swap-card :global(.deposit-usd-value) {
      font-size: 12px;
    }

    .arrow-circle {
      width: 28px;
      height: 28px;
    }

    .arrow-circle svg {
      width: 12px;
      height: 12px;
    }

    .bottom-strip {
      padding: 2px 8px 6px;
    }

    .venue-badge {
      padding: 2px 6px;
      font-size: 10px;
    }

    .impact-text {
      font-size: 9px;
    }

    .action-btn {
      width: 28px;
      height: 28px;
    }
  }
</style>
