<script lang="ts">
  import MiniWalletBalanceTable from './MiniWalletBalanceTable.svelte';
  import MiniPoolPositionsTable from './MiniPoolPositionsTable.svelte';
  import MiniOpenOrdersTable from './MiniOpenOrdersTable.svelte';
  import MiniOpenTriggersTable from './MiniOpenTriggersTable.svelte';
  import MiniTradingBalanceTable from './MiniTradingBalanceTable.svelte';
  import { userPortfolio } from '$lib/domain/user';
  import { pageHeader } from '$lib/components/portfolio/page-header.svelte';

  pageHeader.reset();
  pageHeader.mode = 'overview';

  // Top 5 tokens and pools for mini tables (enriched with prices)
  let topTokens = $derived(userPortfolio.allTokens.slice(0, 5));
  let topPools = $derived(userPortfolio.portfolioPools.slice(0, 5));
</script>

<div class="overview">
  <div class="tables-section">
    <MiniWalletBalanceTable tokens={topTokens} isLoading={userPortfolio.isLoading || userPortfolio.isDiscovering} />
    <MiniTradingBalanceTable isLoading={userPortfolio.isLoadingSpotMarkets} />
    <MiniPoolPositionsTable pools={topPools} isLoading={userPortfolio.isLoadingSpotMarkets} />
    <MiniOpenOrdersTable isLoading={userPortfolio.isLoadingSpotMarkets} />
    <MiniOpenTriggersTable isLoading={userPortfolio.isLoadingSpotMarkets} />
  </div>
</div>

<style>
  .overview {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .tables-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
  }

  @media (max-width: 1024px) {
    .tables-section {
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
  }
</style>
