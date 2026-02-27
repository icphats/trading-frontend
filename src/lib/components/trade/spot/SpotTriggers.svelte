<script lang="ts">
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import type { TriggerView } from "$lib/actors/services/spot.service";
  import { tickToPrice } from "$lib/domain/markets/utils";
  import { formatToken, formatSigFig, formatTimestamp } from "$lib/utils/format.utils";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { userPreferences } from "$lib/domain/user";
  import { getTriggerLabel } from "$lib/utils/trigger.utils";
  import { GridTable, GridHeader, GridRow, GridCell, gridPresets, SideBadge, TypeBadge } from "$lib/components/ui/table";
  import TriggerDetailsModal from "$lib/components/portal/modals/specific/TriggerDetailsModal.svelte";
  import EditTriggerModal from "$lib/components/portal/modals/specific/EditTriggerModal.svelte";
  import ConfirmationModal from "$lib/components/portal/modals/specific/ConfirmationModal.svelte";
  import { Logo } from "$lib/components/ui";
  import Button from "$lib/components/ui/Button.svelte";
  import { toastState } from "$lib/state/portal/toast.state.svelte";

  let { spot }: { spot: SpotMarket } = $props();

  // Derive token info from the current market
  const market = $derived(entityStore.getMarket(spot.canister_id));
  const baseToken = $derived(market?.baseToken ? entityStore.getToken(market.baseToken) : null);
  const quoteToken = $derived(market?.quoteToken ? entityStore.getToken(market.quoteToken) : null);
  const baseDecimals = $derived(baseToken?.decimals ?? 8);
  const quoteDecimals = $derived(quoteToken?.decimals ?? 8);
  const baseSymbol = $derived(baseToken?.displaySymbol ?? 'TOKEN');
  const quoteSymbol = $derived(quoteToken?.displaySymbol ?? 'QUOTE');
  const baseLogo = $derived(baseToken?.logo ?? undefined);
  const quoteLogo = $derived(quoteToken?.logo ?? undefined);

  // Triggers for this market only, sorted newest first
  const triggers = $derived(
    [...spot.userTriggers].sort((a, b) => Number(b.timestamp - a.timestamp))
  );

  // ============================================
  // Modal State
  // ============================================

  let detailsModalOpen = $state(false);
  let editModalOpen = $state(false);
  let cancelModalOpen = $state(false);
  let selectedTrigger = $state<TriggerView | null>(null);
  let cancellingTriggerId = $state<bigint | null>(null);

  /** Tracks whether the sub-modal was opened from TriggerDetailsModal */
  let enteredFromDetails = $state(false);

  // ============================================
  // Rich Confirmation Detail
  // ============================================

  const cancelTriggerDetail = $derived.by(() => {
    if (!selectedTrigger || !baseToken || !quoteToken) return undefined;
    const isBuy = 'buy' in selectedTrigger.side;
    const inputTkn = isBuy ? quoteToken : baseToken;
    const inputDec = isBuy ? quoteDecimals : baseDecimals;
    const price = tickToPrice(selectedTrigger.trigger_tick, baseDecimals, quoteDecimals);

    return {
      side: (isBuy ? 'Buy' : 'Sell') as 'Buy' | 'Sell',
      baseSymbol: baseSymbol,
      baseLogo,
      rows: [
        { label: 'Trigger Price', value: formatSigFig(price, 5, { subscriptZeros: true }) },
        { label: 'Amount', value: `${formatToken({ value: selectedTrigger.input_amount, unitName: inputDec, displayDecimals: 6, commas: true })} ${inputTkn.displaySymbol}` },
        { label: 'Execution', value: selectedTrigger.immediate_or_cancel ? 'Market (IOC)' : 'Limit' },
      ]
    };
  });

  // ============================================
  // Row Click → Details Modal
  // ============================================

  function handleRowClick(trigger: TriggerView) {
    selectedTrigger = trigger;
    detailsModalOpen = true;
  }

  // ============================================
  // Inline Cancel Button (skip details modal)
  // ============================================

  async function handleCancel(e: MouseEvent, trigger: TriggerView) {
    e.stopPropagation();
    cancellingTriggerId = trigger.trigger_id;
    try {
      await executeCancelTrigger(trigger);
    } finally {
      cancellingTriggerId = null;
    }
  }

  // ============================================
  // TriggerDetailsModal Callbacks
  // ============================================

  function handleDetailsCancel(trigger: TriggerView) {
    enteredFromDetails = true;
    selectedTrigger = trigger;
    cancelModalOpen = true;
  }

  function handleDetailsEdit(trigger: TriggerView) {
    enteredFromDetails = true;
    selectedTrigger = trigger;
    editModalOpen = true;
  }

  // ============================================
  // Sub-Modal Navigation
  // ============================================

  function handleSubModalBack() {
    editModalOpen = false;
    cancelModalOpen = false;

    if (enteredFromDetails) {
      detailsModalOpen = true;
    } else {
      selectedTrigger = null;
    }
  }

  function handleSubModalSuccess() {
    editModalOpen = false;
    cancelModalOpen = false;
    detailsModalOpen = false;
    selectedTrigger = null;
  }

  function handleEditSuccess() {
    editModalOpen = false;
    detailsModalOpen = false;
    selectedTrigger = null;
  }

  // ============================================
  // Direct Execution (skip confirmation)
  // ============================================

  async function executeCancelTrigger(trigger: TriggerView) {
    await toastState.show({
      async: true,
      promise: spot.cancelTrigger(BigInt(trigger.trigger_id)),
      messages: {
        loading: `Cancelling trigger #${trigger.trigger_id}...`,
        success: () => `Trigger #${trigger.trigger_id} cancelled`,
        error: (err: unknown) => err instanceof Error ? err.message : 'Failed to cancel trigger',
      },
      data: {
        type: 'order',
        side: 'buy' in trigger.side ? 'Buy' : 'Sell',
        orderType: 'trigger',
        symbol: baseSymbol,
        logo: baseLogo,
      },
      duration: 3000,
      toastPosition: 'bottom-right',
    });
  }

  // ============================================
  // Confirmation Handler
  // ============================================

  async function handleConfirmCancel() {
    if (!selectedTrigger) return;
    try {
      await spot.cancelTrigger(BigInt(selectedTrigger.trigger_id));
    } catch (err) {
      throw err;
    }
  }

  // ============================================
  // Helpers
  // ============================================

  function formatTickPrice(tick: number): string {
    const price = tickToPrice(tick, baseDecimals, quoteDecimals);
    return formatSigFig(price, 5, { subscriptZeros: true });
  }

  function getInputToken(trigger: TriggerView) {
    if ("buy" in trigger.side) {
      return { symbol: quoteSymbol, logo: quoteLogo, decimals: quoteDecimals };
    }
    return { symbol: baseSymbol, logo: baseLogo, decimals: baseDecimals };
  }
</script>

<GridTable columns={gridPresets.triggers}>
  <GridHeader>
    <GridCell align="left">Date</GridCell>
    <GridCell align="left">ID</GridCell>
    <GridCell align="center">Type</GridCell>
    <GridCell align="center">Side</GridCell>
    <GridCell align="center">Trigger</GridCell>
    <GridCell align="center">Amount</GridCell>
    <GridCell align="center">Limit</GridCell>
    <GridCell align="center">Actions</GridCell>
  </GridHeader>

  {#each triggers as trigger (trigger.trigger_id)}
    {@const inputToken = getInputToken(trigger)}
    <GridRow clickable onclick={() => handleRowClick(trigger)}>
      <GridCell align="left" compact>
        <span class="timestamp">{formatTimestamp(trigger.timestamp)}</span>
      </GridCell>
      <GridCell align="left" compact>
        <span class="entity-id">#{trigger.trigger_id.toString()}</span>
      </GridCell>
      <GridCell align="center" compact>
        <TypeBadge type={trigger.trigger_type} side={trigger.side} />
      </GridCell>
      <GridCell align="center" compact>
        <SideBadge side={trigger.side} />
      </GridCell>
      <GridCell align="right" compact>
        {formatTickPrice(trigger.trigger_tick)}
      </GridCell>
      <GridCell align="right" compact>
        <div class="amount-cell">
          <span>{formatToken({ value: trigger.input_amount, unitName: inputToken.decimals, displayDecimals: 4, commas: true })}</span>
          <Logo src={inputToken.logo} alt={inputToken.symbol} size="xxs" circle={true} />
        </div>
      </GridCell>
      <GridCell align="right" compact>
        {formatTickPrice(trigger.limit_tick)}
      </GridCell>
      <GridCell align="center" compact>
        <div class="actions-cell">
          <Button size="sm" variant="red" loading={cancellingTriggerId === trigger.trigger_id} onclick={(e) => handleCancel(e, trigger)}>Cancel</Button>
        </div>
      </GridCell>
    </GridRow>
  {:else}
    <div class="empty-state">
      <p class="empty-text">No active triggers</p>
    </div>
  {/each}
</GridTable>

<!-- Details Modal (display only — actions delegate back here) -->
<TriggerDetailsModal
  bind:open={detailsModalOpen}
  trigger={selectedTrigger}
  {spot}
  onClose={() => {
    detailsModalOpen = false;
    selectedTrigger = null;
  }}
  onRequestCancel={handleDetailsCancel}
  onRequestEdit={handleDetailsEdit}
/>

<!-- Edit Trigger Modal -->
<EditTriggerModal
  bind:open={editModalOpen}
  trigger={selectedTrigger}
  {spot}
  onClose={handleSubModalBack}
  onSuccess={handleEditSuccess}
/>

<!-- Cancel Confirmation Modal (shared by both inline + details paths) -->
{#if selectedTrigger}
  <ConfirmationModal
    bind:open={cancelModalOpen}
    title="Cancel Trigger"
    orderDetail={cancelTriggerDetail}
    confirmLabel="Cancel Trigger"
    cancelLabel="Back"
    variant="danger"
    showSkipOption
    onSkipPreferenceChange={(skip) => userPreferences.setSkipOrderConfirmation(skip)}
    onConfirm={handleConfirmCancel}
    onClose={handleSubModalBack}
    onSuccess={handleSubModalSuccess}
    toastMessages={{
      loading: `Cancelling trigger #${selectedTrigger.trigger_id}...`,
      success: `Trigger #${selectedTrigger.trigger_id} cancelled`,
      error: (err) => err instanceof Error ? err.message : 'Failed to cancel trigger',
    }}
  />
{/if}

<style>
  .timestamp {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .entity-id {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    font-variant-numeric: tabular-nums;
  }

  .amount-cell {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.375rem;
  }

  .empty-state {
    padding: 24px;
    text-align: center;
  }

  .empty-text {
    font-size: 0.8125rem;
    color: var(--muted-foreground);
  }

  .actions-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
</style>
