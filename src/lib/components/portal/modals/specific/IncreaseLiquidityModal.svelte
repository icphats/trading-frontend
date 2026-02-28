<script lang="ts">
  import type { PositionView } from 'declarations/spot/spot.did';
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import { marketRepository } from "$lib/repositories/market.repository";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { toastState } from "$lib/state/portal/toast.state.svelte";
  import Modal from "../Modal.svelte";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import LiquidityPositionInfo from "$lib/components/liquidity/LiquidityPositionInfo.svelte";
  import DetailLineItem from "$lib/components/liquidity/DetailLineItem.svelte";
  import { TokenAmountInput } from "$lib/components/ui/inputs";
  import {
    tickToPrice,
    calculateAmountQuoteFromAmountBase,
    calculateAmountBaseFromAmountQuote,
    stringToBigInt,
    bigIntToString,
  } from "$lib/domain/markets/utils";
  import { formatSigFig } from "$lib/utils/format.utils";
  import { userPortfolio } from "$lib/domain/user";

  interface Props {
    positionId: bigint;
    spot: SpotMarket;
    open?: boolean;
    onClose: () => void;
    onSuccess?: () => void;
  }

  let {
    positionId,
    spot,
    open = $bindable(false),
    onClose,
    onSuccess
  }: Props = $props();

  // ============================================
  // Position & Token Data
  // ============================================

  let position = $state<PositionView | null>(null);
  let isLoading = $state(true);
  let loadError = $state<string | null>(null);

  let baseLedgerCanisterId = $state<string | null>(null);
  let quoteLedgerCanisterId = $state<string | null>(null);

  const base = $derived(baseLedgerCanisterId ? entityStore.getToken(baseLedgerCanisterId) : undefined);
  const quote = $derived(quoteLedgerCanisterId ? entityStore.getToken(quoteLedgerCanisterId) : undefined);
  const baseDecimals = $derived(base?.decimals ?? 8);
  const quoteDecimals = $derived(quote?.decimals ?? 8);

  const baseBalance = $derived<bigint>(
    baseLedgerCanisterId ? userPortfolio.getToken(baseLedgerCanisterId)?.balance ?? 0n : 0n
  );
  const quoteBalance = $derived<bigint>(
    quoteLedgerCanisterId ? userPortfolio.getToken(quoteLedgerCanisterId)?.balance ?? 0n : 0n
  );

  // ============================================
  // Pool Price Polling
  // ============================================

  let poolTick = $state<number | null>(null);
  let pollTimer = $state<ReturnType<typeof setInterval> | null>(null);

  const POLL_INTERVAL_MS = 5_000;

  async function fetchPoolTick() {
    if (!position) return;
    try {
      const result = await marketRepository.getSpotMarketDepth(spot.canister_id, 1, 10);
      if ('ok' in result) {
        const pool = result.ok.pools.find(p => p.fee_pips === position!.fee_pips);
        if (pool) poolTick = pool.current_tick;
      }
    } catch {
      // Silent — stale tick is acceptable, next poll will retry
    }
  }

  function startPolling() {
    stopPolling();
    fetchPoolTick();
    pollTimer = setInterval(fetchPoolTick, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // ============================================
  // Derived Price & Range Info
  // ============================================

  const currentPrice = $derived(
    poolTick !== null ? tickToPrice(poolTick, baseDecimals, quoteDecimals) : null
  );

  const inRange = $derived(
    poolTick !== null && position
      ? poolTick >= position.tick_lower && poolTick < position.tick_upper
      : null
  );

  // One-sided liquidity: tick outside position range means only one token is needed
  const depositBaseDisabled = $derived(poolTick !== null && position ? poolTick >= position.tick_upper : false);
  const depositQuoteDisabled = $derived(poolTick !== null && position ? poolTick <= position.tick_lower : false);

  // ============================================
  // Form State & Linked Amounts
  // ============================================

  let baseAmount = $state('');
  let quoteAmount = $state('');
  let lastEditedToken = $state<0 | 1>(0);

  const amountBaseDesired = $derived.by(() => {
    if (!base || !baseAmount) return 0n;
    try { return stringToBigInt(baseAmount, base.decimals); } catch { return 0n; }
  });

  const amountQuoteDesired = $derived.by(() => {
    if (!quote || !quoteAmount) return 0n;
    try { return stringToBigInt(quoteAmount, quote.decimals); } catch { return 0n; }
  });

  const insufficientBase = $derived(amountBaseDesired > baseBalance);
  const insufficientQuote = $derived(amountQuoteDesired > quoteBalance);

  const canSubmit = $derived(
    (amountBaseDesired > 0n || amountQuoteDesired > 0n) && !loadError && !insufficientBase && !insufficientQuote
  );

  const buttonLabel = $derived.by(() => {
    if (insufficientBase) return `Insufficient ${base?.displaySymbol ?? 'base'}`;
    if (insufficientQuote) return `Insufficient ${quote?.displaySymbol ?? 'quote'}`;
    if (amountBaseDesired === 0n && amountQuoteDesired === 0n) return 'Enter amount';
    return 'Add Liquidity';
  });

  // ============================================
  // Linked Amount Handlers
  // ============================================

  function handleBaseChange(value: string) {
    baseAmount = value;
    lastEditedToken = 0;

    if (!position || poolTick === null || depositQuoteDisabled) return;
    const amt0 = stringToBigInt(value || '0', baseDecimals);
    if (amt0 <= 0n) {
      quoteAmount = '';
      return;
    }

    const amt1 = calculateAmountQuoteFromAmountBase(amt0, poolTick, position.tick_lower, position.tick_upper);
    quoteAmount = amt1 > 0n ? bigIntToString(amt1, quoteDecimals) : '';
  }

  function handleQuoteChange(value: string) {
    quoteAmount = value;
    lastEditedToken = 1;

    if (!position || poolTick === null || depositBaseDisabled) return;
    const amt1 = stringToBigInt(value || '0', quoteDecimals);
    if (amt1 <= 0n) {
      baseAmount = '';
      return;
    }

    const amt0 = calculateAmountBaseFromAmountQuote(amt1, poolTick, position.tick_lower, position.tick_upper);
    baseAmount = amt0 > 0n ? bigIntToString(amt0, baseDecimals) : '';
  }

  // Recalculate linked amount when pool tick updates
  $effect(() => {
    if (poolTick === null || !position) return;
    // Re-derive the non-edited token amount from the edited one
    if (lastEditedToken === 0 && amountBaseDesired > 0n && !depositQuoteDisabled) {
      const amt1 = calculateAmountQuoteFromAmountBase(amountBaseDesired, poolTick, position.tick_lower, position.tick_upper);
      quoteAmount = amt1 > 0n ? bigIntToString(amt1, quoteDecimals) : '';
    } else if (lastEditedToken === 1 && amountQuoteDesired > 0n && !depositBaseDisabled) {
      const amt0 = calculateAmountBaseFromAmountQuote(amountQuoteDesired, poolTick, position.tick_lower, position.tick_upper);
      baseAmount = amt0 > 0n ? bigIntToString(amt0, baseDecimals) : '';
    }
  });

  // ============================================
  // Lifecycle
  // ============================================

  $effect(() => {
    if (!open) {
      stopPolling();
      return;
    }

    (async () => {
      isLoading = true;
      loadError = null;
      baseAmount = '';
      quoteAmount = '';
      poolTick = null;

      try {
        const positionResult = await marketRepository.getSpotPosition(spot.canister_id, positionId);
        if ('err' in positionResult || !positionResult.ok) {
          const errValue = 'err' in positionResult ? positionResult.err : "Position not found";
          loadError = typeof errValue === 'string' ? errValue : JSON.stringify(errValue);
          return;
        }
        position = positionResult.ok;

        const marketData = entityStore.getMarket(spot.canister_id);
        if (marketData) {
          baseLedgerCanisterId = marketData.baseToken;
          quoteLedgerCanisterId = marketData.quoteToken;
        }

        startPolling();
      } catch (err) {
        console.error('Failed to load position:', err);
        loadError = err instanceof Error ? err.message : 'Failed to load position';
      } finally {
        isLoading = false;
      }
    })();
  });

  // ============================================
  // Submit
  // ============================================

  async function handleSubmit() {
    if (!position || !canSubmit) return;

    open = false;

    try {
      await toastState.show({
        async: true,
        promise: spot.increaseLiquidity(positionId, amountBaseDesired, amountQuoteDesired),
        messages: {
          loading: 'Adding liquidity...',
          success: 'Liquidity added',
          error: (err: unknown) => err instanceof Error ? err.message : 'Failed to add liquidity',
        },
        duration: 3000,
      });
      onSuccess?.();
    } catch {
      // Error already shown by toast
    }
  }

  function handleClose() {
    open = false;
    onClose();
  }

  const positionInfo = $derived.by(() => {
    if (!position || !base || !quote) return null;
    return {
      base: { symbol: base.symbol, displaySymbol: base.displaySymbol, logo: base.logo },
      quote: { symbol: quote.symbol, displaySymbol: quote.displaySymbol, logo: quote.logo },
      fee_pips: position.fee_pips,
      status: inRange === null ? undefined : inRange ? 'in_range' as const : 'out_of_range' as const,
    };
  });
</script>

<Modal
  bind:open
  onClose={handleClose}
  title="Add Liquidity"
  compactHeader={true}
  size="md"
>
  {#snippet children()}
    <div class="modal-body">

      <!-- Loading State -->
      {#if isLoading}
        <div class="modal-state">
          <p class="modal-state-text">Loading position...</p>
        </div>

      <!-- Error State -->
      {:else if loadError}
        <div class="modal-state">
          <p class="modal-state-text error">{loadError}</p>
        </div>

      <!-- Main Content -->
      {:else if position && positionInfo}
        <!-- Position Info -->
        <LiquidityPositionInfo position={positionInfo} />

        <!-- Current Price -->
        {#if currentPrice !== null}
          <div class="current-price">
            <span class="price-label">Current Price</span>
            <span class="price-value">
              {formatSigFig(currentPrice, 6, { subscriptZeros: true })}
              <span class="price-unit">{quote?.displaySymbol} per {base?.displaySymbol}</span>
            </span>
          </div>
        {/if}

        <!-- Deposit Inputs -->
        <div class="deposit-inputs">
          <TokenAmountInput
            token={base}
            value={baseAmount}
            onValueChange={handleBaseChange}
            balance={baseBalance}
            size="md"
            showBalance
            showPresets
            disabled={depositBaseDisabled}
          />
          <TokenAmountInput
            token={quote}
            value={quoteAmount}
            onValueChange={handleQuoteChange}
            balance={quoteBalance}
            size="md"
            showBalance
            showPresets
            disabled={depositQuoteDisabled}
          />
        </div>

        {#if depositBaseDisabled || depositQuoteDisabled}
          <p class="one-sided-hint">
            Price is outside the position range — only {depositBaseDisabled ? quote?.displaySymbol : base?.displaySymbol} is needed.
          </p>
        {/if}

        <!-- Position Range -->
        <div class="modal-details">
          <DetailLineItem
            label="Min Price"
            value="{formatSigFig(tickToPrice(position.tick_lower, baseDecimals, quoteDecimals), 5, { subscriptZeros: true })} {quote?.displaySymbol}"
          />
          <DetailLineItem
            label="Max Price"
            value="{formatSigFig(tickToPrice(position.tick_upper, baseDecimals, quoteDecimals), 5, { subscriptZeros: true })} {quote?.displaySymbol}"
          />
          <DetailLineItem
            label="Fee Tier"
            value="{(position.fee_pips / 10000).toFixed(2)}%"
          />
        </div>

        <!-- Action Buttons -->
        <div class="modal-actions">
          <ButtonV2
            variant="secondary"
            size="xl"
            fullWidth
            onclick={handleClose}
          >
            Back
          </ButtonV2>
          <ButtonV2
            variant="primary"
            size="xl"
            fullWidth
            onclick={handleSubmit}
            disabled={!canSubmit}
          >
            {buttonLabel}
          </ButtonV2>
        </div>
      {/if}
    </div>
  {/snippet}
</Modal>

<style>
  .deposit-inputs {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .current-price {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 0.75rem 1rem;
    background: var(--muted);
    border-radius: var(--radius-sm);
  }

  .price-label {
    font-size: 0.8125rem;
    color: var(--muted-foreground);
  }

  .price-value {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--foreground);
    font-variant-numeric: tabular-nums;
  }

  .price-unit {
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--muted-foreground);
    margin-left: 0.25rem;
  }

  .one-sided-hint {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    text-align: center;
    padding: 0.25rem 0;
  }
</style>
