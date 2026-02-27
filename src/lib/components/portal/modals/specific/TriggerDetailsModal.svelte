<script lang="ts">
  import type { TriggerView } from "$lib/actors/services/spot.service";
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import Modal from "../Modal.svelte";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import { tickToPrice } from "$lib/domain/markets/utils";
  import { formatToken, formatSigFig } from "$lib/utils/format.utils";
  import { getTriggerLabel, getTriggerVariant, getTriggerDirectionText, getTriggerDirection } from "$lib/utils/trigger.utils";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";

  interface Props {
    open: boolean;
    trigger: TriggerView | null;
    spot: SpotMarket;
    onClose?: () => void;
    /** Called when user wants to cancel the trigger */
    onRequestCancel?: (trigger: TriggerView) => void;
    /** Called when user wants to edit the trigger */
    onRequestEdit?: (trigger: TriggerView) => void;
  }

  let {
    open = $bindable(false),
    trigger,
    spot,
    onClose,
    onRequestCancel,
    onRequestEdit,
  }: Props = $props();

  // Derived trigger info
  const triggerSide = $derived(trigger ? ('buy' in trigger.side ? 'Buy' : 'Sell') : '');
  const triggerTypeLabel = $derived(trigger ? getTriggerLabel(trigger.side, trigger.trigger_type) : '');
  const triggerTypeClass = $derived(trigger ? getTriggerVariant(trigger.side) : '');

  const triggerPrice = $derived.by(() => {
    if (!trigger) return '0';
    const price = tickToPrice(trigger.trigger_tick, spot.baseTokenDecimals, spot.quoteTokenDecimals);
    return formatSigFig(price, 5, { subscriptZeros: true });
  });

  const limitPrice = $derived.by(() => {
    if (!trigger) return '0';
    const price = tickToPrice(trigger.limit_tick, spot.baseTokenDecimals, spot.quoteTokenDecimals);
    return formatSigFig(price, 5, { subscriptZeros: true });
  });

  const inputDecimals = $derived(
    trigger && 'buy' in trigger.side ? spot.quoteTokenDecimals : spot.baseTokenDecimals
  );

  const triggerAmount = $derived.by(() => {
    if (!trigger) return '0';
    return formatToken({
      value: trigger.input_amount,
      unitName: inputDecimals,
      displayDecimals: 6,
      commas: true
    });
  });

  const triggerTimestamp = $derived.by(() => {
    if (!trigger) return '';
    const date = new Date(Number(trigger.timestamp));
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  });

  const triggerIdDisplay = $derived(trigger ? trigger.trigger_id.toString() : '');

  // Token info for display
  const isBuy = $derived(trigger ? 'buy' in trigger.side : false);
  const inputToken = $derived.by(() => {
    if (!spot.tokens?.[0] || !spot.tokens?.[1]) return undefined;
    return isBuy
      ? entityStore.getToken(spot.tokens[1].toString())
      : entityStore.getToken(spot.tokens[0].toString());
  });

  const isImmediateOrCancel = $derived(trigger?.immediate_or_cancel ?? false);

  const statusLabel = $derived.by(() => {
    if (!trigger) return '';
    if ('active' in trigger.status) return 'Active';
    if ('cancelled' in trigger.status) return 'Cancelled';
    if ('triggered' in trigger.status) return 'Triggered';
    return 'Unknown';
  });

  // Handlers
  function handleClose() {
    open = false;
    onClose?.();
  }

  function handleEditClick() {
    if (!trigger) return;
    open = false;
    onRequestEdit?.(trigger);
  }

  function handleCancelClick() {
    if (!trigger) return;
    open = false;
    onRequestCancel?.(trigger);
  }
</script>

<Modal bind:open onClose={handleClose} title="Trigger Details" size="sm" compactHeader={true}>
  {#snippet children()}
    {#if trigger}
      <div class="modal-body">
        <!-- Trigger Type Badge -->
        <div class="trigger-header">
          <span class="trigger-type {triggerTypeClass}">
            {triggerTypeLabel}
          </span>
          <span class="trigger-id">#{triggerIdDisplay}</span>
        </div>

        <!-- Details Grid -->
        <div class="modal-panel">
          <div class="modal-detail-row">
            <span class="modal-detail-label">Trigger Price</span>
            <span class="modal-detail-value">{triggerPrice}</span>
          </div>

          <div class="modal-detail-row">
            <span class="modal-detail-label">Limit Price</span>
            <span class="modal-detail-value">{limitPrice}</span>
          </div>

          <div class="modal-detail-row">
            <span class="modal-detail-label">Amount</span>
            <span class="modal-detail-value">{triggerAmount} {inputToken?.displaySymbol ?? ''}</span>
          </div>

          <div class="modal-detail-row">
            <span class="modal-detail-label">Order Type</span>
            <span class="modal-detail-value">{isImmediateOrCancel ? 'Market (IOC)' : 'Limit'}</span>
          </div>

          <div class="modal-detail-row">
            <span class="modal-detail-label">Status</span>
            <span class="modal-detail-value status">{statusLabel}</span>
          </div>

          <div class="modal-detail-row">
            <span class="modal-detail-label">Created</span>
            <span class="modal-detail-value timestamp">{triggerTimestamp}</span>
          </div>
        </div>

        <!-- Info Banner -->
        <div class="modal-info-banner">
          <svg class="modal-info-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
          <span>
            {getTriggerDirectionText(trigger.trigger_type, triggerPrice)}
          </span>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <ButtonV2
            variant="secondary"
            size="md"
            fullWidth
            onclick={handleEditClick}
          >
            Edit Trigger
          </ButtonV2>
          <ButtonV2
            variant="danger"
            size="md"
            fullWidth
            onclick={handleCancelClick}
          >
            Cancel Trigger
          </ButtonV2>
        </div>
      </div>
    {:else}
      <div class="modal-empty">
        <p>No trigger selected</p>
      </div>
    {/if}
  {/snippet}
</Modal>

<style>
  /* Header specific to trigger details */
  .trigger-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .trigger-type {
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-sm);
  }

  .trigger-type.buy {
    background: oklch(from var(--color-bullish) l c h / 0.15);
    color: var(--color-bullish);
  }

  .trigger-type.sell {
    background: oklch(from var(--color-bearish) l c h / 0.15);
    color: var(--color-bearish);
  }

  .trigger-id {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }

  /* Action Buttons */
  .action-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .status {
    color: var(--primary);
  }

  .timestamp {
    font-family: var(--font-sans);
    font-weight: 400;
  }
</style>
