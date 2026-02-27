<script lang="ts">
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import type { PositionViewEnhanced } from "$lib/actors/services/spot.service";
  import { tickToPrice, bpsToPercent } from "$lib/domain/markets/utils";
  import { formatSigFig, formatUSD } from "$lib/utils/format.utils";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import PositionDetailsModal from "$lib/components/portal/modals/specific/PositionDetailsModal.svelte";
  import { GridTable, GridHeader, GridRow, GridCell, gridPresets } from "$lib/components/ui/table";
  import Badge from "$lib/components/ui/Badge.svelte";
  let { spot }: { spot: SpotMarket } = $props();

  // Derive token info from the current market
  const market = $derived(entityStore.getMarket(spot.canister_id));
  const baseToken = $derived(market?.baseToken ? entityStore.getToken(market.baseToken) : null);
  const quoteToken = $derived(market?.quoteToken ? entityStore.getToken(market.quoteToken) : null);
  const baseDecimals = $derived(baseToken?.decimals ?? 8);
  const quoteDecimals = $derived(quoteToken?.decimals ?? 8);

  // Positions for this market, sorted by USD value descending
  const positions = $derived(
    [...spot.userPositions].sort((a, b) => Number(b.usd_value_e6 - a.usd_value_e6))
  );

  // Modal state
  let detailsModalOpen = $state(false);
  let selectedPosition = $state<PositionViewEnhanced | null>(null);

  function handleRowClick(position: PositionViewEnhanced) {
    selectedPosition = position;
    detailsModalOpen = true;
  }

  function isInRange(position: PositionViewEnhanced): boolean {
    if (spot.lastTradeTick === null) return false;
    return spot.lastTradeTick >= position.tick_lower && spot.lastTradeTick < position.tick_upper;
  }

  function formatTickPrice(tick: number): string {
    const price = tickToPrice(tick, baseDecimals, quoteDecimals);
    return formatSigFig(price, 5, { subscriptZeros: true });
  }
</script>

<GridTable columns={gridPresets.positions}>
  <GridHeader>
    <GridCell align="left">ID</GridCell>
    <GridCell align="center">Fee</GridCell>
    <GridCell align="left">Range</GridCell>
    <GridCell align="right">Value</GridCell>
    <GridCell align="right">Fees</GridCell>
    <GridCell align="right">APR</GridCell>
    <GridCell align="center">Status</GridCell>
  </GridHeader>

  {#each positions as position (position.position_id)}
    {@const inRange = isInRange(position)}
    <GridRow clickable onclick={() => handleRowClick(position)}>
      <GridCell align="left" compact>
        <span class="entity-id">#{position.position_id.toString()}</span>
      </GridCell>
      <GridCell align="center" compact>
        <Badge variant="green" size="xs">{(position.fee_pips / 10000).toFixed(position.fee_pips % 10000 === 0 ? 1 : 2)}%</Badge>
      </GridCell>
      <GridCell align="left" compact>
        <span class="range">{formatTickPrice(position.tick_lower)} → {formatTickPrice(position.tick_upper)}</span>
      </GridCell>
      <GridCell align="right" compact>
        {formatUSD(Number(position.usd_value_e6) / 1e6)}
      </GridCell>
      <GridCell align="right" compact>
        {formatUSD(Number(position.fees_usd_value_e6) / 1e6)}
      </GridCell>
      <GridCell align="right" compact>
        <span class="apr">{bpsToPercent(position.apr_bps).toFixed(1)}%</span>
      </GridCell>
      <GridCell align="center" compact>
        <Badge variant={inRange ? 'green' : 'red'} size="xs">{inRange ? 'In Range' : 'Out'}</Badge>
      </GridCell>
    </GridRow>
  {:else}
    <div class="empty-state">
      <p class="empty-text">No pool positions — use the Pool tab to add liquidity</p>
    </div>
  {/each}
</GridTable>

<PositionDetailsModal
  bind:open={detailsModalOpen}
  position={selectedPosition}
  {spot}
  onClose={() => {
    detailsModalOpen = false;
    selectedPosition = null;
  }}
/>

<style>
  .entity-id {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    font-variant-numeric: tabular-nums;
  }

  .range {
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .apr {
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
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
