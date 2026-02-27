<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { STATS_TABS, StatsTab } from './types';

  // Derive active tab from current URL path
  const activeTab = $derived(() => {
    const path = $page.url.pathname;
    const segment = path.split('/').filter(Boolean).pop() || 'platform';

    // Check if segment matches a valid tab
    const validTabs = Object.values(StatsTab) as string[];
    if (validTabs.includes(segment)) {
      return segment as StatsTab;
    }
    return StatsTab.Platform;
  });

  function handleTabClick(tabId: StatsTab) {
    goto(`/stats/${tabId}`);
  }
</script>

<nav class="stats-tabs">
  <div class="tabs-container">
    {#each STATS_TABS as tab}
      <button
        class="tab-button"
        class:active={activeTab() === tab.id}
        onclick={() => handleTabClick(tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </div>
</nav>

<style>
  .stats-tabs {
    width: 100%;
  }

  .tabs-container {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
  }

  @media (max-width: 768px) {
    .tabs-container {
      gap: 16px;
    }
  }

  .tab-button {
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

  .tab-button:hover {
    opacity: 0.8;
  }

  .tab-button.active {
    color: var(--foreground);
  }

  .tab-button.active:hover {
    opacity: 1;
  }
</style>
