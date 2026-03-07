<script lang="ts">
  import type { PositionView } from 'declarations/spot/spot.did';
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import { marketRepository } from "$lib/repositories/market.repository";
  import { toastState } from "$lib/state/portal/toast.state.svelte";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import Modal from "../Modal.svelte";
  import { formatTimestamp } from "$lib/utils/format.utils";
  import { PERMANENT_LOCK_MS } from "$lib/constants/app.constants";

  interface Props {
    positionId: bigint;
    spot: SpotMarket;
    open?: boolean;
    onClose: () => void;
    onBack?: () => void;
    onSuccess?: () => void;
  }

  let { positionId, spot, open = $bindable(false), onClose, onBack, onSuccess }: Props = $props();

  // Position data
  let position = $state<PositionView | null>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  // Form state
  let lockDate = $state<string>('');
  let permanent = $state(false);

  const PRESETS: { label: string; days: number }[] = [
    { label: '1m', days: 30 },
    { label: '3m', days: 90 },
    { label: '6m', days: 180 },
    { label: '1y', days: 365 },
  ];

  // Format a Date as "YYYY-MM-DD" in the user's local timezone
  function toLocalDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Minimum date: +2 days to guarantee >1 day after backend validation
  const minDate = $derived.by(() => {
    return toLocalDateString(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));
  });

  // Derived
  const currentLock = $derived(position?.locked_until?.[0] ?? null);
  const isCurrentlyLocked = $derived(currentLock !== null && currentLock > BigInt(Date.now()));
  const isPermanentlyLocked = $derived(currentLock !== null && currentLock >= PERMANENT_LOCK_MS);

  // Parse "YYYY-MM-DD" as local midnight (not UTC)
  function parseDateLocal(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  }

  const lockUntilMs = $derived.by((): bigint | null => {
    if (permanent) return PERMANENT_LOCK_MS;
    if (!lockDate) return null;
    const ms = parseDateLocal(lockDate);
    if (isNaN(ms) || ms <= Date.now() + 24 * 60 * 60 * 1000) return null;
    return BigInt(ms);
  });

  const canSubmit = $derived.by(() => {
    if (!lockUntilMs) return false;
    if (currentLock !== null && lockUntilMs <= currentLock) return false;
    return true;
  });

  function applyPreset(days: number) {
    permanent = false;
    const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    lockDate = toLocalDateString(d);
  }

  function togglePermanent() {
    permanent = !permanent;
    if (permanent) lockDate = '';
  }

  // Load position data
  $effect(() => {
    if (!open) return;
    lockDate = '';
    permanent = false;

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

  function handleBack() {
    open = false;
    onBack?.();
  }
</script>

<Modal
  bind:open
  onClose={handleClose}
  title="Lock Position"
  compactHeader={true}
  size="sm"
  showBack={!!onBack}
  onBack={handleBack}
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

        <!-- Date Picker -->
        <div class="lock-section">
          <span class="lock-label">Lock until</span>
          <input
            type="date"
            class="date-input"
            class:dimmed={permanent}
            bind:value={lockDate}
            min={minDate}
            disabled={permanent}
          />

          <!-- Quick Presets -->
          <div class="presets">
            {#each PRESETS as preset}
              <button
                class="preset-btn"
                class:dimmed={permanent}
                onclick={() => applyPreset(preset.days)}
                disabled={permanent}
                type="button"
              >
                {preset.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Permanent Toggle -->
        <button
          class="permanent-toggle"
          class:active={permanent}
          onclick={togglePermanent}
          type="button"
        >
          <span class="permanent-check">{permanent ? '✓' : ''}</span>
          <div class="permanent-content">
            <span class="permanent-title">Permanent lock</span>
            <span class="permanent-desc">Liquidity can never be withdrawn</span>
          </div>
        </button>

        {#if permanent}
          <div class="permanent-warning">
            This is irreversible. The position will earn fees forever but the liquidity can never be withdrawn.
          </div>
        {/if}

        <!-- Preview -->
        {#if lockUntilMs && !permanent}
          <span class="lock-preview">
            Until {formatTimestamp(lockUntilMs)}
          </span>
        {/if}

        {#if isCurrentlyLocked && lockUntilMs && currentLock && lockUntilMs <= currentLock}
          <div class="lock-warning">
            New lock must extend beyond the current lock date
          </div>
        {/if}

        <!-- Action Buttons -->
        <div class="modal-actions">
          {#if onBack}
            <ButtonV2
              variant="secondary"
              size="xl"
              fullWidth
              onclick={handleBack}
            >
              Back
            </ButtonV2>
          {/if}
          <ButtonV2
            variant="danger"
            size="xl"
            fullWidth
            onclick={handleLock}
            disabled={!canSubmit}
          >
            {#if isPermanentlyLocked}
              Already Permanently Locked
            {:else if permanent}
              Permanently Lock Position
            {:else if isCurrentlyLocked}
              Extend Lock
            {:else}
              Lock Position
            {/if}
          </ButtonV2>
        </div>
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

  .lock-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .lock-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .date-input {
    width: 100%;
    padding: 0.625rem 0.75rem;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--foreground);
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .date-input:focus {
    border-color: var(--ring);
  }

  .date-input.dimmed {
    opacity: 0.4;
    pointer-events: none;
  }

  .presets {
    display: flex;
    gap: 0.375rem;
  }

  .preset-btn {
    flex: 1;
    padding: 0.375rem 0;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--muted-foreground);
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preset-btn:hover:not(:disabled) {
    color: var(--foreground);
    border-color: var(--ring);
  }

  .preset-btn.dimmed {
    opacity: 0.4;
    pointer-events: none;
  }

  /* Permanent toggle */
  .permanent-toggle {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.625rem 0.75rem;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .permanent-toggle:hover {
    border-color: var(--muted-foreground);
  }

  .permanent-toggle.active {
    border-color: var(--color-red);
    background: oklch(from var(--color-red) l c h / 0.05);
  }

  .permanent-check {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
    border: 1.5px solid var(--border);
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--color-red);
    transition: all 0.15s ease;
  }

  .permanent-toggle.active .permanent-check {
    border-color: var(--color-red);
    background: oklch(from var(--color-red) l c h / 0.15);
  }

  .permanent-content {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .permanent-title {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--foreground);
  }

  .permanent-desc {
    font-size: 0.6875rem;
    color: var(--muted-foreground);
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

  .lock-preview {
    font-size: 0.75rem;
    color: var(--muted-foreground);
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
