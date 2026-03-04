<script lang="ts">
  import Modal from '$lib/components/portal/modals/Modal.svelte';
  import ButtonV2 from '$lib/components/ui/ButtonV2.svelte';
  import { user } from '$lib/domain/user/auth.svelte';
  import { toastState } from '$lib/state/portal/toast.state.svelte';
  import { getIcpToCyclesRate, topUpCanister, ICP_FEE } from '$lib/services/topup.service';

  interface Props {
    open: boolean;
    canisterId: string;
    onSuccess: () => void;
  }

  let { open = $bindable(false), canisterId, onSuccess }: Props = $props();

  let amount = $state('');
  let estimatedRate = $state<bigint | null>(null);
  let isLoadingRate = $state(false);

  // Fetch conversion rate when modal opens
  $effect(() => {
    if (open && user.agent && !estimatedRate) {
      isLoadingRate = true;
      getIcpToCyclesRate(user.agent)
        .then((rate) => { estimatedRate = rate; })
        .catch(() => { /* rate display is optional */ })
        .finally(() => { isLoadingRate = false; });
    }
  });

  // Reset on close
  $effect(() => {
    if (!open) {
      amount = '';
    }
  });

  const icpE8s = $derived.by(() => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) return 0n;
    return BigInt(Math.round(parsed * 1e8));
  });

  const estimatedCycles = $derived.by(() => {
    if (!estimatedRate || icpE8s <= 0n) return null;
    // Rate is xdr_permyriad_per_icp. 1 XDR = 1T cycles.
    // cycles = (icpE8s / 1e8) * (rate / 1e4) * 1e12 = icpE8s * rate
    return icpE8s * estimatedRate;
  });

  const formattedEstimatedCycles = $derived.by(() => {
    if (!estimatedCycles) return '—';
    const t = Number(estimatedCycles) / 1e12;
    return `${t.toFixed(3)} T`;
  });

  const canSubmit = $derived(icpE8s > ICP_FEE);

  function handleClose() {
    open = false;
  }

  async function handleConfirm() {
    const agent = user.agent;
    if (!agent || icpE8s <= 0n) return;

    const amountToSend = icpE8s;
    const cid = canisterId;

    handleClose();

    try {
      await toastState.show({
        async: true,
        promise: topUpCanister(agent, cid, amountToSend),
        messages: {
          loading: 'Topping up canister with cycles...',
          success: (cycles: bigint) => {
            const t = Number(cycles) / 1e12;
            return `Added ${t.toFixed(3)} T cycles`;
          },
          error: (err: unknown) =>
            err instanceof Error ? err.message : 'Top-up failed',
        },
        duration: 4000,
        toastPosition: 'bottom-right',
      });
      onSuccess();
    } catch {
      // Error already shown by toast
    }
  }
</script>

<Modal bind:open onClose={handleClose} title="Top Up Cycles" size="sm" compactHeader>
  {#snippet children()}
    <div class="modal-body">
      <!-- Amount Input -->
      <div class="modal-form-section">
        <label class="input-label" for="topup-amount">ICP Amount</label>
        <input
          id="topup-amount"
          class="amount-input"
          type="number"
          step="0.0001"
          min="0"
          placeholder="0.0"
          bind:value={amount}
        />
      </div>

      <!-- Details Panel -->
      <div class="modal-panel">
        <div class="modal-detail-row">
          <span class="modal-detail-label">Network Fee</span>
          <span class="modal-detail-value">0.0001 ICP</span>
        </div>
        <div class="modal-detail-row">
          <span class="modal-detail-label">Estimated Cycles</span>
          <span class="modal-detail-value">
            {#if isLoadingRate}
              Loading...
            {:else}
              {formattedEstimatedCycles}
            {/if}
          </span>
        </div>
      </div>

      <!-- Actions -->
      <div class="modal-actions">
        <ButtonV2 variant="secondary" size="lg" fullWidth onclick={handleClose}>
          Cancel
        </ButtonV2>
        <ButtonV2
          variant="primary"
          size="lg"
          fullWidth
          onclick={handleConfirm}
          disabled={!canSubmit}
        >
          Confirm
        </ButtonV2>
      </div>
    </div>
  {/snippet}
</Modal>

<style>
  .input-label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--muted-foreground);
    margin-bottom: 0.375rem;
  }

  .amount-input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--foreground);
    background: var(--muted);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    outline: none;
    transition: border-color var(--transition-fast);
    box-sizing: border-box;
  }

  .amount-input::placeholder {
    color: var(--muted-foreground);
    opacity: 0.5;
  }

  .amount-input:focus {
    border-color: var(--primary);
  }

  /* Hide number input spinners */
  .amount-input::-webkit-outer-spin-button,
  .amount-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .amount-input[type='number'] {
    -moz-appearance: textfield;
  }
</style>
