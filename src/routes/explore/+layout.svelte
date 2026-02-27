<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import ExploreStats from '$lib/components/explore/ExploreStats.svelte';

  let { children } = $props();

  // Detect if we're on a list page (not a detail page)
  let isListPage = $derived(
    page.url.pathname === '/explore/tokens' || page.url.pathname === '/explore/pools'
  );

  // Detect current tab based on route
  let currentTab = $derived(
    page.url.pathname.startsWith('/explore/pools') ? 'pools' : 'tokens'
  );

  // Tabs
  type TabId = 'tokens' | 'pools';
  const tabs: { value: TabId; label: string }[] = [
    { value: 'tokens', label: 'Tokens' },
    { value: 'pools', label: 'Pools' }
  ];

  function handleTabClick(value: TabId) {
    goto(`/explore/${value}`);
  }
</script>

<div class="explore-container">
  {#if isListPage}
    <ExploreStats />

    <!-- Tabs Navigation -->
    <div class="explore-tabs-row">
      <div class="explore-tabs">
        {#each tabs as tab (tab.value)}
          <button
            class="explore-tab"
            class:active={currentTab === tab.value}
            onclick={() => handleTabClick(tab.value)}
          >
            {tab.label}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {@render children?.()}
</div>

<style>
  /* Explore container - matching Uniswap's 1200px max width */
  .explore-container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px 16px 48px;
  }

  @media (max-width: 768px) {
    .explore-container {
      padding: 16px;
    }
  }

  /* Tabs row */
  .explore-tabs-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 80px;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 16px;
  }

  @media (max-width: 1024px) {
    .explore-tabs-row {
      flex-direction: column;
      align-items: flex-start;
    }
  }

  /* Explore tabs - heading3 variant styling (Uniswap) */
  .explore-tabs {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
  }

  @media (max-width: 768px) {
    .explore-tabs {
      gap: 16px;
    }
  }

  .explore-tab {
    font-family: 'Basel', sans-serif;
    font-size: 25px;
    line-height: 30px;
    font-weight: 485;
    letter-spacing: -0.005em;
    color: var(--muted-foreground);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    user-select: none;
    transition: color 200ms ease-out, opacity 200ms ease-out;
  }

  .explore-tab:hover {
    opacity: 0.8;
  }

  .explore-tab.active {
    color: var(--foreground);
  }

  .explore-tab.active:hover {
    opacity: 1;
  }
</style>
