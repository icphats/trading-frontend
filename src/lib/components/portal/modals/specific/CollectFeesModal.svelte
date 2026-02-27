<script lang="ts">
  import type { PositionView } from 'declarations/spot/spot.did';
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import { marketRepository } from "$lib/repositories/market.repository";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { toastState } from "$lib/state/portal/toast.state.svelte";
  import Logo from "$lib/components/ui/Logo.svelte";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import Modal from "../Modal.svelte";
  import { bigIntToString } from "$lib/domain/markets/utils";

  interface Props {
    positionId: bigint;
    spot: SpotMarket;
    open?: boolean;
    onClose: () => void;
    onSuccess?: () => void;
  }

  let { positionId, spot, open = $bindable(false), onClose, onSuccess }: Props = $props();

  // Position data
  let position = $state<PositionView | null>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  // Token data
  const market = $derived(entityStore.getMarket(spot.canister_id));
  const token0 = $derived(market?.baseToken ? entityStore.getToken(market.baseToken) : null);
  const token1 = $derived(market?.quoteToken ? entityStore.getToken(market.quoteToken) : null);

  // Uncollected fees
  const feesOwed0 = $derived(position?.uncollected_fees_base ?? 0n);
  const feesOwed1 = $derived(position?.uncollected_fees_quote ?? 0n);
  const hasFees = $derived(feesOwed0 > 0n || feesOwed1 > 0n);

  // Load position data
  $effect(() => {
    if (!open) return;

    (async () => {
      isLoading = true;
      error = null;

      try {
        const positionResult = await marketRepository.getSpotPosition(spot.canister_id, positionId);
        if ('err' in positionResult || !positionResult.ok) {
          const errValue = 'err' in positionResult ? positionResult.err : "Position not found";
          error = typeof errValue === 'string' ? errValue : JSON.stringify(errValue);
          return;
        }
        position = positionResult.ok;
      } catch (err) {
        console.error('Failed to load position:', err);
        error = err instanceof Error ? err.message : 'Failed to load position';
      } finally {
        isLoading = false;
      }
    })();
  });

  async function handleCollect() {
    if (!position || !hasFees) return;

    // Close immediately — toast handles loading/success/error feedback
    open = false;

    try {
      await toastState.show({
        async: true,
        promise: spot.collectFees(positionId),
        messages: {
          loading: 'Collecting fees...',
          success: 'Fees collected',
          error: (err: unknown) => err instanceof Error ? err.message : 'Failed to collect fees',
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
  title="Collect Fees"
  compactHeader={true}
  size="sm"
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
      {:else if position}
        <!-- Fee Amounts Panel -->
        <div class="modal-panel">
          <!-- Token 0 Row -->
          <div class="modal-detail-row">
            <div class="fee-token">
              {#if token0}
                <Logo src={token0.logo ?? undefined} alt={token0.displaySymbol} size="sm" circle={true} />
                <span class="token-symbol">{token0.displaySymbol}</span>
              {/if}
            </div>
            <span class="modal-detail-value">
              {token0 ? bigIntToString(feesOwed0, token0.decimals) : '0'}
            </span>
          </div>

          <!-- Token 1 Row -->
          <div class="modal-detail-row">
            <div class="fee-token">
              {#if token1}
                <Logo src={token1.logo ?? undefined} alt={token1.displaySymbol} size="sm" circle={true} />
                <span class="token-symbol">{token1.displaySymbol}</span>
              {/if}
            </div>
            <span class="modal-detail-value">
              {token1 ? bigIntToString(feesOwed1, token1.decimals) : '0'}
            </span>
          </div>
        </div>

        <!-- No Fees Message -->
        {#if !hasFees}
          <div class="no-fees">
            <p>No fees to collect yet</p>
            <p class="no-fees-hint">
              Fees accumulate as traders swap through your position's price range
            </p>
          </div>
        {/if}

        <!-- Collect Button -->
        <ButtonV2
          variant="primary"
          size="xl"
          fullWidth
          onclick={handleCollect}
          disabled={!hasFees}
        >
          Collect
        </ButtonV2>
      {/if}
    </div>
  {/snippet}
</Modal>

<style>
  .fee-token {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .token-symbol {
    font-size: 1rem;
    font-weight: 500;
    color: var(--foreground);
  }

  .no-fees {
    text-align: center;
    padding: 1rem;
  }

  .no-fees p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted-foreground);
  }

  .no-fees-hint {
    font-size: 0.75rem !important;
    margin-top: 0.5rem !important;
  }
</style>
