<script lang="ts">
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import { Principal } from "@dfinity/principal";
  import { user } from "$lib/domain/user/auth.svelte";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import Modal from "../Modal.svelte";
  import ConfirmationModal from "./ConfirmationModal.svelte";

  interface Props {
    positionId: bigint;
    spot: SpotMarket;
    open?: boolean;
    onClose: () => void;
    onSuccess?: () => void;
  }

  let { positionId, spot, open = $bindable(false), onClose, onSuccess }: Props = $props();

  let recipientText = $state('');
  let confirmModalOpen = $state(false);

  // Position data from spot's cached user positions
  const position = $derived(
    spot.userPositions?.find(p => p.position_id === positionId) ?? null
  );

  // Validate recipient principal
  const validationResult = $derived.by((): { valid: boolean; error?: string } => {
    const text = recipientText.trim();
    if (!text) return { valid: false };

    try {
      const principal = Principal.fromText(text);

      if (principal.isAnonymous()) {
        return { valid: false, error: 'Cannot transfer to anonymous principal' };
      }

      const selfPrincipal = user.principal;
      if (selfPrincipal && principal.toText() === selfPrincipal.toString()) {
        return { valid: false, error: 'Cannot transfer to yourself' };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid principal format' };
    }
  });

  const isValidPrincipal = $derived(validationResult.valid);
  const validationError = $derived(recipientText.trim() ? validationResult.error : undefined);

  // Fee tier display
  const feeTier = $derived(
    position ? (position.fee_pips / 10000).toFixed(position.fee_pips % 10000 === 0 ? 1 : 2) + '%' : ''
  );

  function handleTransferClick() {
    open = false;
    confirmModalOpen = true;
  }

  async function handleConfirm() {
    const recipient = Principal.fromText(recipientText.trim());
    return await spot.transferPosition(positionId, recipient);
  }

  function handleConfirmSuccess() {
    confirmModalOpen = false;
    onSuccess?.();
  }

  function handleConfirmClose() {
    confirmModalOpen = false;
    open = true;
  }

  function handleClose() {
    recipientText = '';
    open = false;
    onClose();
  }
</script>

<Modal
  bind:open
  onClose={handleClose}
  title="Transfer Position"
  compactHeader={true}
  size="sm"
>
  {#snippet children()}
    <div class="modal-body">
      {#if position}
        <!-- Position Summary -->
        <div class="modal-panel">
          <div class="summary-row">
            <span class="summary-label">Position</span>
            <span class="summary-value">#{positionId.toString()}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Fee Tier</span>
            <span class="summary-value">{feeTier}</span>
          </div>
          {#if position.locked_until?.[0]}
            <div class="summary-row">
              <span class="summary-label">Lock Status</span>
              <span class="summary-value locked">Locked</span>
            </div>
          {/if}
        </div>

        <!-- Recipient Input -->
        <div class="input-section">
          <label class="input-label" for="recipient-principal">Recipient Principal</label>
          <input
            id="recipient-principal"
            type="text"
            class="principal-input"
            class:input-error={!!validationError}
            bind:value={recipientText}
            placeholder="xxxxx-xxxxx-xxxxx-xxxxx-xxx"
            spellcheck="false"
            autocomplete="off"
          />
          {#if validationError}
            <span class="validation-error">{validationError}</span>
          {/if}
        </div>

        <!-- Warning -->
        <div class="transfer-warning">
          This will transfer ownership of the position. Accrued fees will go to the new owner.
        </div>

        <!-- Transfer Button -->
        <ButtonV2
          variant="danger"
          size="xl"
          fullWidth
          onclick={handleTransferClick}
          disabled={!isValidPrincipal}
        >
          Transfer Position
        </ButtonV2>
      {:else}
        <div class="modal-state">
          <p class="modal-state-text">Position not found</p>
        </div>
      {/if}
    </div>
  {/snippet}
</Modal>

<ConfirmationModal
  bind:open={confirmModalOpen}
  title="Confirm Transfer"
  message="Are you sure you want to transfer position #{positionId.toString()} to {recipientText.trim()}? This action cannot be undone."
  confirmLabel="Transfer Position"
  variant="danger"
  onConfirm={handleConfirm}
  onSuccess={handleConfirmSuccess}
  onClose={handleConfirmClose}
  toastMessages={{
    loading: 'Transferring position...',
    success: 'Position transferred',
    error: (err: unknown) => err instanceof Error ? err.message : 'Failed to transfer position',
  }}
/>

<style>
  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .summary-label {
    font-size: 0.8125rem;
    color: var(--muted-foreground);
  }

  .summary-value {
    font-size: 0.8125rem;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: var(--foreground);
  }

  .summary-value.locked {
    color: var(--color-blue);
  }

  .input-section {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .input-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .principal-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--foreground);
    font-size: 0.8125rem;
    font-family: var(--font-mono);
    outline: none;
    transition: border-color 0.15s ease;
  }

  .principal-input:focus {
    border-color: var(--ring);
  }

  .principal-input.input-error {
    border-color: var(--color-red);
  }

  .validation-error {
    font-size: 0.75rem;
    color: var(--color-red);
  }

  .transfer-warning {
    padding: 0.5rem 0.75rem;
    background: oklch(from var(--color-red) l c h / 0.1);
    border-radius: var(--radius-md);
    font-size: 0.75rem;
    line-height: 1.5;
    color: var(--color-red);
    text-align: center;
  }
</style>
