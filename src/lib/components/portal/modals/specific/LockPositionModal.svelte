<script lang="ts">
  import type { PositionView } from 'declarations/spot/spot.did';
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import { marketRepository } from "$lib/repositories/market.repository";
  import { toastState } from "$lib/state/portal/toast.state.svelte";
  import { ToggleGroup } from "$lib/components/ui";
  import type { ToggleOption } from "$lib/components/ui/ToggleGroup.svelte";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import Modal from "../Modal.svelte";
  import { formatTimestamp } from "$lib/utils/format.utils";
  import { PERMANENT_LOCK_MS } from "$lib/constants/app.constants";

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

  // Duration selection
  let selectedDuration = $state<string>('');
  let customDate = $state<string>('');

  const DURATION_OPTIONS: ToggleOption[] = [
    { value: '1w', label: '1 Week' },
    { value: '1m', label: '1 Month' },
    { value: '6m', label: '6 Months' },
    { value: 'custom', label: 'Custom' },
    { value: 'permanent', label: 'Permanent' },
  ];

  const DURATION_MS: Record<string, number> = {
    '1w': 7 * 24 * 60 * 60 * 1000,
    '1m': 30 * 24 * 60 * 60 * 1000,
    '6m': 180 * 24 * 60 * 60 * 1000,
  };

  // Minimum custom date: tomorrow
  const minDate = $derived.by(() => {
    const d = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // +2 days to guarantee >1 day
    return d.toISOString().split('T')[0];
  });

  // Derived
  const currentLock = $derived(position?.locked_until?.[0] ?? null);
  const isCurrentlyLocked = $derived(currentLock !== null && currentLock > BigInt(Date.now()));
  const isPermanentlyLocked = $derived(currentLock !== null && currentLock >= PERMANENT_LOCK_MS);

  const lockUntilMs = $derived.by((): bigint | null => {
    if (selectedDuration === 'permanent') return PERMANENT_LOCK_MS;
    if (selectedDuration === 'custom') {
      if (!customDate) return null;
      const ms = new Date(customDate).getTime();
      if (isNaN(ms) || ms <= Date.now() + 24 * 60 * 60 * 1000) return null;
      return BigInt(ms);
    }
    if (!selectedDuration || !DURATION_MS[selectedDuration]) return null;
    return BigInt(Date.now() + DURATION_MS[selectedDuration]);
  });

  const canSubmit = $derived.by(() => {
    if (!lockUntilMs) return false;
    if (currentLock !== null && lockUntilMs <= currentLock) return false;
    return true;
  });

  function formatLockDisplay(ms: bigint): string {
    if (ms >= PERMANENT_LOCK_MS) return 'Permanent';
    return formatTimestamp(ms);
  }

  // Load position data
  $effect(() => {
    if (!open) return;
    selectedDuration = '';
    customDate = '';

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

  async function handleLock() {
    if (!lockUntilMs) return;

    open = false;

    try {
      await toastState.show({
        async: true,
        promise: spot.lockPosition(positionId, lockUntilMs),
        messages: {
          loading: 'Locking position...',
          success: lockUntilMs >= PERMANENT_LOCK_MS ? 'Position permanently locked' : 'Position locked',
          error: (err: unknown) => err instanceof Error ? err.message : 'Failed to lock position',
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
  title="Lock Position"
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
        <!-- Current Lock Status -->
        {#if isCurrentlyLocked && currentLock}
          <div class="lock-status">
            <span class="lock-icon">&#128274;</span>
            <span class="lock-text">
              {isPermanentlyLocked ? 'Permanently locked' : `Locked until ${formatTimestamp(currentLock)}`}
            </span>
          </div>
        {/if}

        <div class="lock-info">
          <p>Locking prevents decreasing or closing this position until the selected date. Fee collection and liquidity increases remain unaffected.</p>
        </div>

        <!-- Duration Presets -->
        <div class="duration-section">
          <span class="duration-label">Lock Duration</span>
          <ToggleGroup
            options={DURATION_OPTIONS}
            value={selectedDuration}
            onValueChange={(v) => selectedDuration = v}
            size="sm"
            fullWidth
          />

          <!-- Custom date input -->
          {#if selectedDuration === 'custom'}
            <input
              type="date"
              class="custom-date-input"
              bind:value={customDate}
              min={minDate}
            />
          {/if}

          <!-- Preview -->
          {#if lockUntilMs}
            <span class="lock-until-preview">
              {lockUntilMs >= PERMANENT_LOCK_MS ? 'This position can never be decreased or closed' : `Until ${formatTimestamp(lockUntilMs)}`}
            </span>
          {/if}

          {#if selectedDuration === 'permanent'}
            <div class="permanent-warning">
              This is irreversible. The position will earn fees forever but the liquidity can never be withdrawn.
            </div>
          {/if}
        </div>

        {#if isCurrentlyLocked && lockUntilMs && currentLock && lockUntilMs <= currentLock}
          <div class="lock-warning">
            New lock must extend beyond the current lock date
          </div>
        {/if}

        <!-- Lock Button -->
        <ButtonV2
          variant="primary"
          size="xl"
          fullWidth
          onclick={handleLock}
          disabled={!canSubmit}
        >
          {#if isPermanentlyLocked}
            Already Permanently Locked
          {:else if selectedDuration === 'permanent'}
            Permanently Lock Position
          {:else if isCurrentlyLocked}
            Extend Lock
          {:else}
            Lock Position
          {/if}
        </ButtonV2>
      {/if}
    </div>
  {/snippet}
</Modal>

<style>
  .lock-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    background: oklch(from var(--color-blue) l c h / 0.1);
    border-radius: var(--radius-md);
    font-size: 0.8125rem;
    color: var(--color-blue);
  }

  .lock-icon {
    font-size: 1rem;
  }

  .lock-text {
    font-weight: 500;
  }

  .lock-info {
    padding: 0;
  }

  .lock-info p {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--muted-foreground);
  }

  .duration-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .duration-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .custom-date-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--foreground);
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .custom-date-input:focus {
    border-color: var(--ring);
  }

  .lock-until-preview {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    text-align: center;
  }

  .permanent-warning {
    padding: 0.5rem 0.75rem;
    background: oklch(from var(--color-red) l c h / 0.1);
    border-radius: var(--radius-md);
    font-size: 0.75rem;
    line-height: 1.5;
    color: var(--color-red);
    text-align: center;
  }

  .lock-warning {
    padding: 0.5rem 0.75rem;
    background: oklch(from var(--color-warning, orange) l c h / 0.1);
    border-radius: var(--radius-md);
    font-size: 0.75rem;
    color: var(--color-warning, orange);
    text-align: center;
  }
</style>
