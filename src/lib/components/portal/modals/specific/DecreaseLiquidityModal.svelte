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
  import PercentageInput from "$lib/components/liquidity/PercentageInput.svelte";
  import {
    tickToPrice,
    getAmountsForLiquidity,
    bigIntToString,
  } from "$lib/domain/markets/utils";
  import { formatSigFig } from "$lib/utils/format.utils";

  interface Props {
    positionId: bigint;
    spot: SpotMarket;
    open?: boolean;
    onClose: () => void;
    onSuccess?: () => void;
  }

  let { positionId, spot, open = $bindable(false), onClose, onSuccess }: Props = $props();

  // ============================================
  // Position & Token Data
  // ============================================

  let position = $state<PositionView | null>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  let baseLedgerCanisterId = $state<string | null>(null);
  let quoteLedgerCanisterId = $state<string | null>(null);

  const base = $derived(baseLedgerCanisterId ? entityStore.getToken(baseLedgerCanisterId) : null);
  const quote = $derived(quoteLedgerCanisterId ? entityStore.getToken(quoteLedgerCanisterId) : null);
  const baseDecimals = $derived(base?.decimals ?? 8);
  const quoteDecimals = $derived(quote?.decimals ?? 8);

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
      // Silent — stale tick is acceptable
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

  // ============================================
  // Form State
  // ============================================

  let percent = $state('');
  const percentNum = $derived(Number(percent));
  const percentInvalid = $derived(isNaN(percentNum) || percentNum <= 0 || percentNum > 100);

  const presets = [25, 50, 75, 100];

  const liquidityDelta = $derived.by(() => {
    if (!position || percentInvalid) return 0n;
    return (position.liquidity * BigInt(percentNum)) / 100n;
  });

  // Estimated amounts returned — uses pool tick for accurate split
  const estimatedAmounts = $derived.by(() => {
    if (!position || poolTick === null || liquidityDelta <= 0n) return null;
    const [amountBase, amountQuote] = getAmountsForLiquidity(
      poolTick, position.tick_lower, position.tick_upper, liquidityDelta
    );
    return { amountBase, amountQuote };
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
      error = null;
      percent = '';
      poolTick = null;

      try {
        const positionResult = await marketRepository.getSpotPosition(spot.canister_id, positionId);
        if ('err' in positionResult || !positionResult.ok) {
          const errValue = 'err' in positionResult ? positionResult.err : "Position not found";
          error = typeof errValue === 'string' ? errValue : JSON.stringify(errValue);
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
        error = err instanceof Error ? err.message : 'Failed to load position';
      } finally {
        isLoading = false;
      }
    })();
  });

  // ============================================
  // Submit
  // ============================================

  function handlePresetClick(preset: number) {
    percent = preset.toString();
  }

  async function handleSubmit() {
    if (!position || percentInvalid) return;

    open = false;

    try {
      await toastState.show({
        async: true,
        promise: spot.decreaseLiquidity(positionId, liquidityDelta),
        messages: {
          loading: 'Removing liquidity...',
          success: 'Liquidity removed',
          error: (err: unknown) => err instanceof Error ? err.message : 'Failed to remove liquidity',
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
  title="Remove Liquidity"
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
      {:else if error}
        <div class="modal-state">
          <p class="modal-state-text error">{error}</p>
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

        <!-- Percentage Input Panel -->
        <div class="modal-panel">
          <span class="percent-label">Withdrawal amount</span>

          <div class="percent-input-row">
            <PercentageInput
              value={percent}
              onInput={(v) => percent = v}
              placeholder="0"
            />
            <span class="percent-symbol">%</span>
          </div>

          <div class="preset-buttons">
            {#each presets as preset}
              <button
                class="preset-btn"
                onclick={() => handlePresetClick(preset)}
              >
                {preset === 100 ? 'Max' : `${preset}%`}
              </button>
            {/each}
          </div>
        </div>

        <!-- Estimated Return -->
        {#if estimatedAmounts && !percentInvalid}
          <div class="modal-details">
            <h3 class="modal-details-title">You will receive (estimate)</h3>
            <DetailLineItem
              label={base?.displaySymbol ?? 'Base'}
              value={bigIntToString(estimatedAmounts.amountBase, baseDecimals)}
            />
            <DetailLineItem
              label={quote?.displaySymbol ?? 'Quote'}
              value={bigIntToString(estimatedAmounts.amountQuote, quoteDecimals)}
            />
          </div>
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
          {#if percentNum === 100}
            <DetailLineItem
              label="Position Status"
              value="Will be closed"
            />
          {/if}
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
            variant="danger"
            size="xl"
            fullWidth
            onclick={handleSubmit}
            disabled={percentInvalid}
          >
            {percentNum === 100 ? 'Close Position' : 'Remove Liquidity'}
          </ButtonV2>
        </div>
      {/if}
    </div>
  {/snippet}
</Modal>

<style>
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

  .percent-label {
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }

  .percent-input-row {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  .percent-symbol {
    font-size: 3rem;
    font-weight: 500;
    color: var(--muted-foreground);
  }

  .preset-buttons {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
  }

  .preset-btn {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--foreground);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preset-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }
</style>
