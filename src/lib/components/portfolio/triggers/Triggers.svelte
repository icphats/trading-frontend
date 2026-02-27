<script lang="ts">
  import type { TriggerView } from "$lib/actors/services/spot.service";
  import { tickToPrice } from "$lib/domain/markets/utils";
  import { formatToken, formatSigFig, formatTimestamp } from "$lib/utils/format.utils";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { userPortfolio, userPreferences } from "$lib/domain/user";
  import { marketRegistry } from "$lib/domain/markets";
  import TriggerDetailsModal from "$lib/components/portal/modals/specific/TriggerDetailsModal.svelte";
  import EditTriggerModal from "$lib/components/portal/modals/specific/EditTriggerModal.svelte";
  import ConfirmationModal from "$lib/components/portal/modals/specific/ConfirmationModal.svelte";
  import { GridTable, GridHeader, GridRow, GridCell, gridPresets, SideBadge, TypeBadge } from "$lib/components/ui/table";
  import { Logo } from "$lib/components/ui";

  import type { DropdownOption } from "$lib/components/ui/dropdown/types";
  import { ticker } from "$lib/domain/orchestration/ticker-action";
  import { pageHeader } from '$lib/components/portfolio/page-header.svelte';
  import { toastState } from "$lib/state/portal/toast.state.svelte";

  // Configure page header
  pageHeader.reset();
  pageHeader.mode = 'triggers';
  pageHeader.sectionLabel = 'Triggers Value';
  pageHeader.showValue = true;
  pageHeader.filterType = 'dropdown';
  pageHeader.dropdownAriaLabel = 'Filter by market';
  pageHeader.dropdownMultiSelect = true;
  pageHeader.dropdownValues = [];

  const dropdownOptions = $derived.by(() => {
    const options: DropdownOption<string>[] = [];
    for (const marketData of userPortfolio.spotMarkets) {
      const market = entityStore.getMarket(marketData.spotCanisterId);
      const baseToken = market?.baseToken ? entityStore.getToken(market.baseToken) : null;
      const quoteToken = market?.quoteToken ? entityStore.getToken(market.quoteToken) : null;
      options.push({
        value: marketData.spotCanisterId,
        label: `${baseToken?.displaySymbol ?? '?'}/${quoteToken?.displaySymbol ?? '?'}`,
      });
    }
    return options;
  });

  // Push dropdown options to page header
  $effect(() => {
    pageHeader.dropdownOptions = dropdownOptions;
    pageHeader.showDropdown = dropdownOptions.length > 0;
  });

  // Read filter values from page header (empty = show all)
  const filterCanisterIds = $derived(pageHeader.dropdownValues);

  const allTriggersWithContext = $derived.by(() => {
    const result: Array<{
      trigger: TriggerView;
      spotCanisterId: string;
      baseSymbol: string;
      quoteSymbol: string;
      baseLogo?: string;
      quoteLogo?: string;
      baseDecimals: number;
      quoteDecimals: number;
      valueUsd: number;
    }> = [];

    for (const marketData of userPortfolio.spotMarkets) {
      const market = entityStore.getMarket(marketData.spotCanisterId);
      const baseToken = market?.baseToken ? entityStore.getToken(market.baseToken) : null;
      const quoteToken = market?.quoteToken ? entityStore.getToken(market.quoteToken) : null;

      const baseDecimals = baseToken?.decimals ?? 8;
      const quoteDecimals = quoteToken?.decimals ?? 8;
      const basePriceUsd = baseToken?.priceUsd ?? 0n;
      const quotePriceUsd = quoteToken?.priceUsd ?? 0n;

      for (const trigger of marketData.triggers) {
        const isBuy = 'buy' in trigger.side;
        const decimals = isBuy ? quoteDecimals : baseDecimals;
        const priceUsd = isBuy ? quotePriceUsd : basePriceUsd;

        const amountFloat = Number(trigger.input_amount) / (10 ** decimals);
        const priceFloat = Number(priceUsd) / 1e12;
        const valueUsd = amountFloat * priceFloat;

        result.push({
          trigger,
          spotCanisterId: marketData.spotCanisterId,
          baseSymbol: baseToken?.displaySymbol ?? 'TOKEN',
          quoteSymbol: quoteToken?.displaySymbol ?? 'QUOTE',
          baseLogo: baseToken?.logo ?? undefined,
          quoteLogo: quoteToken?.logo ?? undefined,
          baseDecimals,
          quoteDecimals,
          valueUsd,
        });
      }
    }

    const sorted = result.sort((a, b) => Number(b.trigger.timestamp - a.trigger.timestamp));
    if (filterCanisterIds.length > 0) return sorted.filter(item => filterCanisterIds.includes(item.spotCanisterId));
    return sorted;
  });

  const triggerCount = $derived(allTriggersWithContext.length);
  const totalValue = $derived(allTriggersWithContext.reduce((sum, t) => sum + t.valueUsd, 0));

  // 24h change for triggers (locked token price changes)
  const change24h = $derived.by(() => {
    let total = 0;
    for (const item of allTriggersWithContext) {
      if (item.valueUsd === 0) continue;
      const isBuy = 'buy' in item.trigger.side;
      const tokenId = isBuy
        ? entityStore.getMarket(item.spotCanisterId)?.quoteToken
        : entityStore.getMarket(item.spotCanisterId)?.baseToken;
      const token = tokenId ? entityStore.getToken(tokenId) : null;
      if (!token || token.priceChange24h === 0) continue;
      const d = 1 + token.priceChange24h / 100;
      if (d > 0) total += item.valueUsd - item.valueUsd / d;
    }
    return total;
  });

  const change24hPercent = $derived.by(() => {
    if (totalValue <= 0 || change24h === 0) return 0;
    const prev = totalValue - change24h;
    return prev > 0 ? (change24h / prev) * 100 : 0;
  });

  // Push reactive values to page header
  $effect(() => {
    pageHeader.totalValue = totalValue;
    pageHeader.change24h = change24h;
    pageHeader.change24hPercent = change24hPercent;
    pageHeader.count = triggerCount;
    pageHeader.countLabel = triggerCount === 1 ? 'trigger' : 'triggers';
  });

  // Modal state
  let detailsModalOpen = $state(false);
  let editModalOpen = $state(false);
  let cancelModalOpen = $state(false);
  let selectedTrigger = $state<TriggerView | null>(null);
  let selectedSpotCanisterId = $state<string | null>(null);

  const selectedSpot = $derived(
    selectedSpotCanisterId ? marketRegistry.getSpotMarket(selectedSpotCanisterId) : undefined
  );

  function handleRowClick(trigger: TriggerView, spotCanisterId: string) {
    selectedTrigger = trigger;
    selectedSpotCanisterId = spotCanisterId;
    detailsModalOpen = true;
  }

  function handleCancel(e: MouseEvent, trigger: TriggerView, spotCanisterId: string) {
    e.stopPropagation();
    selectedTrigger = trigger;
    selectedSpotCanisterId = spotCanisterId;

    if (userPreferences.skipOrderConfirmation) {
      const spot = marketRegistry.getSpotMarket(spotCanisterId);
      if (!spot) return;
      const market = entityStore.getMarket(spotCanisterId);
      const baseToken = market?.baseToken ? entityStore.getToken(market.baseToken) : null;

      toastState.show({
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
          symbol: baseToken?.displaySymbol ?? 'TOKEN',
          logo: baseToken?.logo ?? undefined,
        },
        duration: 3000,
        toastPosition: 'bottom-right',
      });
    } else {
      cancelModalOpen = true;
    }
  }

  async function handleConfirmCancel() {
    if (!selectedTrigger || !selectedSpot) return;
    try {
      await selectedSpot.cancelTrigger(BigInt(selectedTrigger.trigger_id));
    } catch (err) {
      throw err;
    }
  }

  function formatTickPrice(tick: number, baseDecimals: number = 8, quoteDecimals: number = 8): string {
    const price = tickToPrice(tick, baseDecimals, quoteDecimals);
    return formatSigFig(price, 5, { subscriptZeros: true });
  }

  function getInputToken(item: typeof allTriggersWithContext[0]) {
    if ("buy" in item.trigger.side) {
      return { symbol: item.quoteSymbol, logo: item.quoteLogo, decimals: item.quoteDecimals };
    }
    return { symbol: item.baseSymbol, logo: item.baseLogo, decimals: item.baseDecimals };
  }
</script>

<div class="triggers-page">
  <GridTable columns={gridPresets.portfolioTriggers} flex minWidth="840px">
    <GridHeader>
      <GridCell align="left">Date</GridCell>
      <GridCell align="left">ID</GridCell>
      <GridCell align="left">Market</GridCell>
      <GridCell align="center">Type</GridCell>
      <GridCell align="center">Side</GridCell>
      <GridCell align="center">Trigger</GridCell>
      <GridCell align="center">Amount</GridCell>
      <GridCell align="center">Limit</GridCell>
    </GridHeader>

    {#each allTriggersWithContext as item (item.trigger.trigger_id)}
      {@const trigger = item.trigger}
      {@const inputToken = getInputToken(item)}
      <GridRow clickable onclick={() => handleRowClick(trigger, item.spotCanisterId)}>
        <GridCell align="left" compact>
          <span class="timestamp">{formatTimestamp(trigger.timestamp)}</span>
        </GridCell>
        <GridCell align="left" compact>
          <span class="entity-id">#{trigger.trigger_id.toString()}</span>
        </GridCell>
        <GridCell align="left" compact>
          <span class="market-pair" use:ticker={item.spotCanisterId}>{item.baseSymbol}/{item.quoteSymbol}</span>
        </GridCell>
        <GridCell align="center" compact>
          <TypeBadge type={trigger.trigger_type} side={trigger.side} />
        </GridCell>
        <GridCell align="center" compact>
          <SideBadge side={trigger.side} />
        </GridCell>
        <GridCell align="right" compact>
          {formatTickPrice(trigger.trigger_tick, item.baseDecimals, item.quoteDecimals)}
        </GridCell>
        <GridCell align="right" compact>
          <div class="amount-cell">
            <span>{formatToken({ value: trigger.input_amount, unitName: inputToken.decimals, displayDecimals: 4, commas: true })}</span>
            <Logo src={inputToken.logo} alt={inputToken.symbol} size="xxs" circle={true} />
          </div>
        </GridCell>
        <GridCell align="right" compact>
          {formatTickPrice(trigger.limit_tick, item.baseDecimals, item.quoteDecimals)}
        </GridCell>
      </GridRow>
    {:else}
      <div class="empty-state">
        <p class="empty-text">No active triggers</p>
      </div>
    {/each}
  </GridTable>
</div>

{#if selectedSpot}
  <TriggerDetailsModal
    bind:open={detailsModalOpen}
    trigger={selectedTrigger}
    spot={selectedSpot}
    onClose={() => {
      detailsModalOpen = false;
      selectedTrigger = null;
    }}
  />

  <EditTriggerModal
    bind:open={editModalOpen}
    trigger={selectedTrigger}
    spot={selectedSpot}
    onClose={() => {
      editModalOpen = false;
      selectedTrigger = null;
    }}
    onSuccess={() => {
      editModalOpen = false;
      selectedTrigger = null;
    }}
  />

  {#if selectedTrigger}
    <ConfirmationModal
      bind:open={cancelModalOpen}
      title="Cancel Trigger"
      confirmLabel="Cancel Trigger"
      variant="danger"
      showSkipOption
      onSkipPreferenceChange={(skip) => userPreferences.setSkipOrderConfirmation(skip)}
      onConfirm={handleConfirmCancel}
      onClose={() => {
        cancelModalOpen = false;
        selectedTrigger = null;
      }}
      toastMessages={{
        loading: `Cancelling trigger #${selectedTrigger.trigger_id}...`,
        success: `Trigger #${selectedTrigger.trigger_id} cancelled`,
        error: (err) => err instanceof Error ? err.message : 'Failed to cancel trigger',
      }}
    />
  {/if}
{/if}

<style>
  .triggers-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
    flex: 1;
    min-height: 0;
  }

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

  .market-pair {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--foreground);
    white-space: nowrap;
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

</style>
