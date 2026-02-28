<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { userPortfolio, type PortfolioPool } from '$lib/domain/user/user-portfolio.svelte';
  import { user } from '$lib/domain/user/auth.svelte';
  import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
  import { marketRegistry } from '$lib/domain/markets';
  import { EmptyState } from '$lib/components/ui';
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import TokenPairLogo from '$lib/components/ui/TokenPairLogo.svelte';
  import PositionDetailsModal from '$lib/components/portal/modals/specific/PositionDetailsModal.svelte';
  import { pageHeader } from '$lib/components/portfolio/page-header.svelte';
  import { formatUSD } from '$lib/utils/format.utils';
  import { PERMANENT_LOCK_MS } from '$lib/constants/app.constants';
  import type { DropdownOption } from '$lib/components/ui/dropdown/types';

  // Configure page header
  pageHeader.reset();
  pageHeader.mode = 'pools';
  pageHeader.sectionLabel = 'Pools Value';
  pageHeader.showValue = true;
  pageHeader.filterType = 'dropdown';
  pageHeader.dropdownAriaLabel = 'Filter by market';
  pageHeader.dropdownMultiSelect = true;
  pageHeader.dropdownValues = [];

  // Derive dropdown options from user's spot positions
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

  $effect(() => {
    pageHeader.dropdownOptions = dropdownOptions;
    pageHeader.showDropdown = dropdownOptions.length > 0;
  });

  const filterCanisterIds = $derived(pageHeader.dropdownValues);

  // Derived from shared state
  let allPools = $derived(userPortfolio.portfolioPools);
  let pools = $derived(
    filterCanisterIds.length > 0
      ? allPools.filter(p => filterCanisterIds.includes(p.canisterId))
      : allPools
  );
  let isLoading = $derived(userPortfolio.isLoadingSpotMarkets);
  let loadError = $derived(userPortfolio.spotMarketsError);
  let totalValue = $derived(userPortfolio.portfolioPoolsTotalValue);
  let poolCount = $derived(userPortfolio.activePoolPositionsCount);

  // 24h change for pool positions
  const change24h = $derived.by(() => {
    let total = 0;
    for (const pool of pools) {
      const market = entityStore.getMarket(pool.canisterId);
      const base = market?.baseToken ? entityStore.getToken(market.baseToken) : null;
      const quote = market?.quoteToken ? entityStore.getToken(market.quoteToken) : null;
      const halfValue = pool.valueUsd / 2;
      if (base && base.priceChange24h !== 0) {
        const d = 1 + base.priceChange24h / 100;
        if (d > 0) total += halfValue - halfValue / d;
      }
      if (quote && quote.priceChange24h !== 0) {
        const d = 1 + quote.priceChange24h / 100;
        if (d > 0) total += halfValue - halfValue / d;
      }
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
    pageHeader.count = poolCount;
    pageHeader.countLabel = poolCount === 1 ? 'position' : 'positions';
  });

  // Modal state — resolve SpotMarket from registry (same pattern as Orders.svelte)
  let detailsModalOpen = $state(false);
  let selectedSpotCanisterId = $state<string | null>(null);
  let selectedPositionId = $state<bigint | null>(null);

  const selectedSpot = $derived(
    selectedSpotCanisterId ? marketRegistry.getSpotMarket(selectedSpotCanisterId) : undefined
  );

  // Resolve raw PositionViewEnhanced for PositionDetailsModal
  const selectedPosition = $derived.by(() => {
    if (!selectedSpot || selectedPositionId === null) return null;
    return selectedSpot.userPositions.find(p => p.position_id === selectedPositionId) ?? null;
  });

  // Hydrate spot markets when user is authenticated - uses $effect with readiness guard
  let hasHydrated = $state(false);

  $effect(() => {
    // Wait for user to be authenticated
    if (user.principal && !hasHydrated) {
      hasHydrated = true;
      untrack(() => {
        userPortfolio.hydrateSpotMarkets();
      });
    }
  });

  function handleAddLiquidity() {
    goto('/trade');
  }

  function selectPool(pool: PortfolioPool) {
    selectedSpotCanisterId = pool.canisterId;
    selectedPositionId = pool.positionId;
  }

  function clearSelection() {
    selectedSpotCanisterId = null;
    selectedPositionId = null;
  }

  function handleCardClick(pool: PortfolioPool) {
    selectPool(pool);
    detailsModalOpen = true;
  }

</script>

<div class="pools-page">
  <!-- Pools List -->
  {#if isLoading}
    <div class="pools-grid">
      {#each Array(4) as _}
        <div class="pool-card skeleton-card">
          <div class="skeleton skeleton-header"></div>
          <div class="skeleton skeleton-body"></div>
          <div class="skeleton skeleton-footer"></div>
        </div>
      {/each}
    </div>
  {:else if loadError}
    <div class="error-state">
      <p>Failed to load positions: {loadError}</p>
      <Button variant="gray" size="sm" onclick={() => userPortfolio.hydrateSpotMarkets()}>Retry</Button>
    </div>
  {:else if pools.length === 0}
    <EmptyState
      title="No positions yet"
      description="Your liquidity positions will appear here"
    />
  {:else}
    <div class="pools-grid">
      {#each pools as pool (pool.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="pool-card" onclick={() => handleCardClick(pool)}>
          <div class="pool-header">
            <TokenPairLogo
              baseLogo={pool.base.logo}
              quoteLogo={pool.quote.logo}
              baseSymbol={pool.base.displaySymbol}
              quoteSymbol={pool.quote.displaySymbol}
              size="sm"
            />
            <div class="pool-title">
              <span class="pool-pair">{pool.base.displaySymbol}/{pool.quote.displaySymbol}</span>
              <span class="pool-fee">{pool.fee}% fee</span>
            </div>
            {#if pool.lockedUntil !== null && pool.lockedUntil > BigInt(Date.now())}
              <Badge variant="blue" size="xs">
                &#128274; {pool.lockedUntil >= PERMANENT_LOCK_MS ? 'Permanent' : 'Locked'}
              </Badge>
            {/if}
            {#if pool.inRange !== undefined}
              <Badge variant={pool.inRange ? 'green' : 'red'} size="xs">
                {pool.inRange ? 'In range' : 'Out of range'}
              </Badge>
            {/if}
          </div>

          <!-- Hero Value -->
          <div class="pool-value">{formatUSD(pool.valueUsd, 2)}</div>

          <!-- Earnings Panel -->
          <div class="earnings-panel">
            <div class="earning">
              <span class="earning-label">Uncollected Fees</span>
              <span class="earning-value">{formatUSD(pool.feesUsd, 2)}</span>
            </div>
            {#if pool.apr !== undefined}
              <div class="earning">
                <span class="earning-label">APR</span>
                <span class="earning-value apr">{pool.apr.toFixed(2)}%</span>
              </div>
            {/if}
          </div>

        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Position Details Modal — card click -->
{#if selectedSpot && selectedPosition}
  <PositionDetailsModal
    bind:open={detailsModalOpen}
    position={selectedPosition}
    spot={selectedSpot}
    onClose={() => {
      detailsModalOpen = false;
      clearSelection();
      userPortfolio.invalidateAndRefreshSpotMarkets();
    }}
  />
{/if}


<style>
  .pools-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
    flex: 1;
    min-height: 0;
  }

  .pools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    align-content: start;
  }

  .pool-card {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .pool-card:hover {
    border-color: var(--muted-foreground);
  }

  .pool-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .pool-title {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .pool-pair {
    font-size: 16px;
    font-weight: 600;
    color: var(--foreground);
  }

  .pool-fee {
    font-size: 12px;
    color: var(--muted-foreground);
  }

  .pool-value {
    font-size: 24px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--foreground);
    letter-spacing: -0.01em;
  }

  .earnings-panel {
    display: flex;
    justify-content: space-between;
    margin-top: auto;
  }

  .earning {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .earning:last-child {
    text-align: right;
  }

  .earning-label {
    font-size: 11px;
    color: var(--muted-foreground);
  }

  .earning-value {
    font-size: 14px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: var(--foreground);
  }

  .earning-value.apr {
    color: var(--color-bullish);
  }

  .skeleton-card {
    min-height: 200px;
  }

  .skeleton {
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-sm);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-header {
    height: 40px;
  }

  .skeleton-body {
    height: 60px;
  }

  .skeleton-footer {
    height: 36px;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .error-state {
    text-align: center;
    padding: 48px 24px;
    color: var(--muted-foreground);
  }

  .error-state p {
    margin: 0 0 16px;
    color: var(--destructive);
  }
</style>
