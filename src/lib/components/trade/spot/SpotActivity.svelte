<script lang="ts">
  /**
   * SpotActivity - Unified activity feed table
   *
   * Displays a normalized view of all user activity:
   * - Orders (filled, partial, cancelled)
   * - Triggers (fired, cancelled, failed)
   * - LP events (open, increase, decrease, close, fees)
   * - Transfers (deposit, withdraw)
   * - Penalties
   *
   * Features:
   * - Infinite scroll pagination
   * - Clickable rows open ActivityDetailsModal
   * - Category color coding via ActivityTypeBadge
   */

  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import type { ActivityView } from "$lib/actors/services/spot.service";
  import { formatToken, formatTimeAgo } from "$lib/utils/format.utils";
  import { normalizeActivity, type TokenContext } from "$lib/utils/activity.utils";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { app } from "$lib/state/app.state.svelte";
  import { Logo, Spinner } from "$lib/components/ui";
  import { GridTable, GridHeader, GridRow, GridCell, gridPresets } from "$lib/components/ui/table";
  import ActivityTypeBadge from "$lib/components/ui/badges/ActivityTypeBadge.svelte";
  import ActivityDetailsModal from "$lib/components/portal/modals/specific/ActivityDetailsModal.svelte";

  // Receive typed SpotMarket instance as prop
  let { spot }: { spot: SpotMarket } = $props();

  // Get token metadata from registry
  const token0 = $derived(spot.tokens ? entityStore.getToken(spot.tokens[0].toString()) : null);
  const token1 = $derived(spot.tokens && spot.tokens[1] ? entityStore.getToken(spot.tokens[1].toString()) : null);

  // Token context for normalization
  const tokenContext = $derived<TokenContext>({
    baseSymbol: token0?.displaySymbol ?? 'BASE',
    quoteSymbol: token1?.displaySymbol ?? 'QUOTE',
    baseDecimals: token0?.decimals ?? 8,
    quoteDecimals: token1?.decimals ?? 8,
  });

  // Infinite scroll state
  let sentinelEl: HTMLDivElement | null = $state(null);
  let observer: IntersectionObserver | null = null;

  // Modal state
  let detailsModalOpen = $state(false);
  let selectedActivity = $state<ActivityView | null>(null);

  // Normalize activities for display
  const normalizedActivities = $derived.by(() => {
    return spot.activityItems.map(activity => normalizeActivity(activity, tokenContext));
  });

  // Initial load on mount
  $effect(() => {
    // Only fetch if we don't have data yet
    if (spot.activityItems.length === 0 && spot.activityHasMore && !spot.activityLoading) {
      spot.fetchUserActivity(20, true);
    }
  });

  // Set up IntersectionObserver for infinite scroll
  $effect(() => {
    if (!sentinelEl) return;

    observer?.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && spot.activityHasMore && !spot.activityLoading) {
          spot.loadMoreActivity();
        }
      },
      { rootMargin: '100px' }
    );
    observer.observe(sentinelEl);

    return () => {
      observer?.disconnect();
    };
  });

  // Handle row click - open details modal
  function handleRowClick(activity: ActivityView) {
    selectedActivity = activity;
    detailsModalOpen = true;
  }

  // Format USD value
  function formatUsdValue(usd: number): string {
    if (usd === 0) return '-';
    if (usd < 0.01) return '<$0.01';
    return `$${usd.toFixed(2)}`;
  }
</script>

<GridTable columns={gridPresets.activity}>
  <GridHeader>
    <GridCell>Time</GridCell>
    <GridCell align="center">Type</GridCell>
    <GridCell>Description</GridCell>
    <GridCell align="right">Amount</GridCell>
    <GridCell align="right">Value</GridCell>
  </GridHeader>

  {#each normalizedActivities as item (item.id)}
    {@const tokenMeta = item.amountToken === 'base' ? token0 : token1}
    {@const decimals = item.amountToken === 'base' ? tokenContext.baseDecimals : tokenContext.quoteDecimals}
    <GridRow clickable onclick={() => handleRowClick(item.raw)}>
      <GridCell compact>
        <span class="timestamp">{formatTimeAgo(Number(item.timestamp), app.now)}</span>
      </GridCell>
      <GridCell align="center" compact>
        <ActivityTypeBadge type={item.type} />
      </GridCell>
      <GridCell compact>
        <span class="description">{item.description}</span>
      </GridCell>
      <GridCell align="right" compact>
        <div class="amount-cell">
          <span>
            {formatToken({
              value: item.amount,
              unitName: decimals,
              displayDecimals: 4,
              commas: true,
            })}
          </span>
          {#if tokenMeta}
            <Logo src={tokenMeta.logo ?? undefined} alt={tokenMeta.symbol} size="xxs" circle={true} />
          {/if}
        </div>
      </GridCell>
      <GridCell align="right" compact>
        <span class="usd-value">{formatUsdValue(item.usdValue)}</span>
      </GridCell>
    </GridRow>
  {:else}
    <div class="empty-state">
      {#if spot.activityLoading}
        <div class="loading-state">
          <Spinner size="sm" />
          <p class="loading-text">Loading activity...</p>
        </div>
      {:else}
        <p class="empty-text">No activity yet</p>
      {/if}
    </div>
  {/each}

  <!-- Infinite scroll sentinel -->
  {#if spot.activityHasMore}
    <div bind:this={sentinelEl} class="scroll-sentinel">
      {#if spot.activityLoading}
        <div class="loading-more">
          <Spinner size="sm" />
        </div>
      {/if}
    </div>
  {/if}
</GridTable>

<!-- Activity Details Modal -->
<ActivityDetailsModal
  bind:open={detailsModalOpen}
  activity={selectedActivity}
  {spot}
  onClose={() => {
    detailsModalOpen = false;
    selectedActivity = null;
  }}
/>

<style>
  /* Amount cell with logo */
  .amount-cell {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.375rem;
  }

  /* Timestamp styling */
  .timestamp {
    color: var(--muted-foreground);
  }

  /* Description text */
  .description {
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* USD value */
  .usd-value {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
  }

  /* Empty state */
  .empty-state {
    padding: 24px;
    text-align: center;
  }

  .empty-text {
    font-size: 0.8125rem;
    color: var(--muted-foreground);
  }

  /* Loading state */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .loading-text {
    font-size: 0.8125rem;
    color: var(--muted-foreground);
    margin: 0;
  }

  /* Infinite scroll */
  .scroll-sentinel {
    height: 1px;
    width: 100%;
  }

  .loading-more {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    color: var(--muted-foreground);
    font-size: 12px;
  }
</style>
