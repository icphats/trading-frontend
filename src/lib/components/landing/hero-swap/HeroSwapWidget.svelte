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
  import QuoteResult from '$lib/components/trade/shared/QuoteResult.svelte';
  import MarketSelectionModal from './MarketSelectionModal.svelte';
  import { quoteExplorerState } from './quoteExplorer.state.svelte';
  import { bigIntToString, computeOutputUsd, usdImpactPercent } from '$lib/domain/markets/utils';
  import { checkAndApprove } from '$lib/utils/allowance.utils';
  import { user } from '$lib/domain/user/auth.svelte';
  import type { VenueBreakdown } from 'declarations/spot/spot.did';
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

  // Input USD: input amount × input token's oracle price
  let inputUsdValue = $derived.by(() => {
    const inputToken = quoteExplorerState.inputToken;
    if (!inputToken) return null;
    const inputPriceUsd = inputToken.priceUsd;
    if (!inputPriceUsd || inputPriceUsd === 0n) return null;
    const oracleUsd = Number(inputPriceUsd) / 1e12;
    const inputFloat = parseFloat(quoteExplorerState.inputAmount);
    if (!inputFloat || inputFloat <= 0) return null;
    return inputFloat * oracleUsd;
  });

  // Output USD: convert output via reference_tick to input-token terms, then oracle
  let outputUsdValue = $derived.by(() => {
    const q = quoteExplorerState.quote;
    const b = quoteExplorerState.baseToken;
    const qt = quoteExplorerState.quoteToken;
    const inputToken = quoteExplorerState.inputToken;
    if (!q || !b || !qt || !inputToken) return null;
    if (q.output_amount === 0n) return null;
    const inputPriceUsd = inputToken.priceUsd;
    if (!inputPriceUsd || inputPriceUsd === 0n) return null;
    const oracleUsd = Number(inputPriceUsd) / 1e12;
    const outputDecimals = quoteExplorerState.outputDecimals;
    return computeOutputUsd(q.output_amount, outputDecimals, q.reference_tick, b.decimals, qt.decimals, quoteExplorerState.side, oracleUsd);
  });

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
      (sum: number, v: VenueBreakdown) => sum + Number(v.input_amount), 0
    );
    const requested = Number(quote.input_amount);
    const fillPercent = requested > 0 ? Math.min(100, (filledFromVenues / requested) * 100) : 0;

    return {
      venues: quote.venue_breakdown
        .toSorted((a: VenueBreakdown, b: VenueBreakdown) => Number(b.input_amount) - Number(a.input_amount))
        .map((v: VenueBreakdown) => {
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
    const baseToken = quoteExplorerState.baseToken;
    if (!quote || !inputToken || !outputToken || !baseToken) return undefined;

    const inputDisplay = bigIntToString(quote.input_amount, inputToken.decimals);
    const outputDisplay = bigIntToString(quote.output_amount, outputToken.decimals);
    const priceImpact = (inputUsdValue && outputUsdValue && inputUsdValue > 0)
      ? (() => { const p = usdImpactPercent(inputUsdValue, outputUsdValue); return Math.abs(p) < 0.01 ? '< 0.01%' : `${Math.abs(p).toFixed(2)}%`; })()
      : undefined;

    return {
      side: confirmSide,
      baseSymbol: baseToken.displaySymbol,
      baseLogo: baseToken.logo ?? undefined,
      rows: [
        { label: 'Spend', value: `${inputDisplay} ${inputToken.displaySymbol}` },
        { label: 'Receive', value: `~${outputDisplay} ${outputToken.displaySymbol}` },
      ],
      routing: (() => {
        const r = buildVenueRouting(quote);
        return r ? { ...r, priceImpact } : undefined;
      })(),
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

        <!-- Skeleton bottom section -->
        <div class="bottom-section">
          <div class="quote-result-wrapper">
            <div class="skeleton skeleton-quote-result"></div>
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
            usdOverride={outputUsdValue}
          />
        {/if}

        <!-- Quote result + action button -->
        {#if quoteExplorerState.quote || quoteExplorerState.isQuoting}
          <div class="bottom-section">
            <div class="quote-result-wrapper">
              <QuoteResult
                compact
                isCalculating={quoteExplorerState.isQuoting}
                quote={quoteExplorerState.quote}
                baseSymbol={quoteExplorerState.baseToken?.displaySymbol ?? ''}
                quoteSymbol={quoteExplorerState.quoteToken?.displaySymbol ?? ''}
                baseDecimals={quoteExplorerState.baseToken?.decimals ?? 8}
                quoteDecimals={quoteExplorerState.quoteToken?.decimals ?? 8}
                baseLogo={quoteExplorerState.baseToken?.logo ?? undefined}
                quoteLogo={quoteExplorerState.quoteToken?.logo ?? undefined}
                side={quoteExplorerState.side === 'buy' ? 'Buy' : 'Sell'}
                {inputUsdValue}
                {outputUsdValue}
                inputAmount={quoteExplorerState.quote?.input_amount}
              />
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
  confirmLabel={`${confirmSide} ${quoteExplorerState.baseToken?.displaySymbol ?? ''}`}
  variant="primary"
  onConfirm={handleSlowSwap}
  toastMessages={{
    loading: `${confirmSide === 'Buy' ? 'Buying' : 'Selling'} ${quoteExplorerState.baseToken?.displaySymbol ?? ''}...`,
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

  /* Bottom section: QuoteResult + action button */
  .bottom-section {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 0 4px 4px;
  }

  .quote-result-wrapper {
    flex: 1;
    min-width: 0;
  }

  /* Remove QuoteResult's outer border inside the swap card */
  .quote-result-wrapper :global(.quote-card) {
    border: none;
  }

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

  .skeleton-quote-result { width: 100%; height: 48px; border-radius: 8px !important; }
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

    .action-btn {
      width: 28px;
      height: 28px;
    }
  }
</style>
