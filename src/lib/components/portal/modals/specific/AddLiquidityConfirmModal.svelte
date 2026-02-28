<script lang="ts">
  import type { NormalizedToken } from "$lib/types/entity.types";
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import { toastState } from "$lib/state/portal/toast.state.svelte";
  import Modal from "../Modal.svelte";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import LiquidityPositionInfo from "$lib/components/liquidity/LiquidityPositionInfo.svelte";
  import DetailLineItem from "$lib/components/liquidity/DetailLineItem.svelte";
  import {
    tickToPrice,
    bigIntToString,
    formatFeePips,
  } from "$lib/domain/markets/utils";
  import { formatSigFig } from "$lib/utils/format.utils";
  import { PERMANENT_LOCK_MS } from "$lib/constants/app.constants";

  interface Props {
    open: boolean;
    spot: SpotMarket;
    base?: NormalizedToken;
    quote?: NormalizedToken;
    feePips: number;
    tickLower: number;
    tickUpper: number;
    amountBase: bigint;
    amountQuote: bigint;
    initialTick?: number;
    lockUntilMs?: bigint;
    isNewPool: boolean;
    onClose: () => void;
    onSuccess?: () => void;
  }

  let {
    open = $bindable(false),
    spot,
    base,
    quote,
    feePips,
    tickLower,
    tickUpper,
    amountBase,
    amountQuote,
    initialTick,
    lockUntilMs,
    isNewPool,
    onClose,
    onSuccess,
  }: Props = $props();

  const baseDecimals = $derived(base?.decimals ?? 8);
  const quoteDecimals = $derived(quote?.decimals ?? 8);

  const positionInfo = $derived.by(() => {
    if (!base || !quote) return null;
    return {
      base: { symbol: base.symbol, displaySymbol: base.displaySymbol, logo: base.logo },
      quote: { symbol: quote.symbol, displaySymbol: quote.displaySymbol, logo: quote.logo },
      fee_pips: feePips,
    };
  });

  const minPrice = $derived(formatSigFig(tickToPrice(tickLower, baseDecimals, quoteDecimals), 5, { subscriptZeros: true }));
  const maxPrice = $derived(formatSigFig(tickToPrice(tickUpper, baseDecimals, quoteDecimals), 5, { subscriptZeros: true }));

  const initialPrice = $derived.by(() => {
    if (initialTick === undefined) return null;
    return formatSigFig(tickToPrice(initialTick, baseDecimals, quoteDecimals), 5, { subscriptZeros: true });
  });

  const lockLabel = $derived.by((): string | null => {
    if (!lockUntilMs) return null;
    if (lockUntilMs >= PERMANENT_LOCK_MS) return 'Permanent';
    const date = new Date(Number(lockUntilMs));
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  });

  async function handleConfirm() {
    open = false;

    try {
      await toastState.show({
        async: true,
        promise: spot.addLiquidity(
          feePips,
          tickLower,
          tickUpper,
          amountBase,
          amountQuote,
          initialTick,
          lockUntilMs,
        ),
        messages: {
          loading: `Adding ${base?.displaySymbol ?? ''} liquidity...`,
          success: (result) => `Position #${result.position_id} created`,
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
</script>

<Modal
  bind:open
  onClose={handleClose}
  title={isNewPool ? 'Create Pool' : 'Add Liquidity'}
  compactHeader={true}
  size="md"
>
  {#snippet children()}
    <div class="modal-body">
      {#if positionInfo}
        <!-- Position Info -->
        <LiquidityPositionInfo position={positionInfo} hideStatus />

        {#if isNewPool}
          <div class="new-pool-badge">New Pool</div>
        {/if}

        <!-- Deposit Amounts -->
        <div class="modal-panel">
          {#if amountBase > 0n}
            <DetailLineItem
              label={base?.displaySymbol ?? 'Base'}
              value={bigIntToString(amountBase, baseDecimals)}
            />
          {/if}
          {#if amountQuote > 0n}
            <DetailLineItem
              label={quote?.displaySymbol ?? 'Quote'}
              value={bigIntToString(amountQuote, quoteDecimals)}
            />
          {/if}
        </div>

        <!-- Range & Fee Details -->
        <div class="modal-details">
          <DetailLineItem
            label="Min Price"
            value="{minPrice} {quote?.displaySymbol ?? ''}"
          />
          <DetailLineItem
            label="Max Price"
            value="{maxPrice} {quote?.displaySymbol ?? ''}"
          />
          <DetailLineItem
            label="Fee Tier"
            value={formatFeePips(feePips)}
          />
        </div>

        <!-- New Pool Banner -->
        {#if isNewPool && initialPrice}
          <div class="modal-info-banner">
            Creates a new pool at price {initialPrice} {quote?.displaySymbol ?? ''} per {base?.displaySymbol ?? ''}
          </div>
        {/if}

        <!-- Lock Warning -->
        {#if lockLabel}
          <div class="lock-warning">
            {#if lockLabel === 'Permanent'}
              <span class="lock-warning-icon">!</span>
              Position will be <strong>permanently locked</strong> — liquidity can never be withdrawn
            {:else}
              <span class="lock-warning-icon">!</span>
              Position locked until <strong>{lockLabel}</strong>
            {/if}
          </div>
        {/if}

        <!-- Actions -->
        <div class="modal-actions">
          <ButtonV2 variant="secondary" size="lg" fullWidth onclick={handleClose}>
            Back
          </ButtonV2>
          <ButtonV2 variant="primary" size="lg" fullWidth onclick={handleConfirm}>
            Confirm
          </ButtonV2>
        </div>
      {/if}
    </div>
  {/snippet}
</Modal>

<style>
  .new-pool-badge {
    display: inline-flex;
    align-self: flex-start;
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
    background: oklch(from var(--ring) l c h / 0.15);
    color: var(--ring);
  }

  .modal-info-banner {
    padding: 0.625rem 0.75rem;
    background: oklch(from var(--ring) l c h / 0.1);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    line-height: 1.4;
    color: var(--ring);
  }

  .lock-warning {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    background: oklch(from var(--color-red) l c h / 0.1);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    line-height: 1.4;
    color: var(--color-red);
  }

  .lock-warning-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--color-red);
    color: white;
    font-size: 0.625rem;
    font-weight: 700;
    margin-top: 0.0625rem;
  }

  .modal-actions {
    display: flex;
    gap: 0.5rem;
  }
</style>
