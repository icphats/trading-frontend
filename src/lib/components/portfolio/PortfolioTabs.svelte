<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { PORTFOLIO_TABS, PortfolioTab } from './types';

  // Derive active tab from current URL path
  const activeTab = $derived(() => {
    const path = $page.url.pathname;
    const segment = path.split('/').filter(Boolean).pop() || 'overview';

    // Check if segment matches a valid tab
    const validTabs = Object.values(PortfolioTab) as string[];
    if (validTabs.includes(segment)) {
      return segment as PortfolioTab;
    }
    return PortfolioTab.Overview;
  });

  function handleTabClick(tabId: PortfolioTab) {
    goto(`/portfolio/${tabId}`);
  }

  // Edge fade detection
  let scrollEl: HTMLDivElement;
  let canScrollLeft = $state(false);
  let canScrollRight = $state(false);

  function updateFades() {
    if (!scrollEl) return;
    canScrollLeft = scrollEl.scrollLeft > 2;
    canScrollRight = scrollEl.scrollLeft < scrollEl.scrollWidth - scrollEl.clientWidth - 2;
  }

  $effect(() => {
    if (!scrollEl) return;
    updateFades();
    const ro = new ResizeObserver(updateFades);
    ro.observe(scrollEl);
    return () => ro.disconnect();
  });
</script>

<nav class="portfolio-tabs" class:fade-left={canScrollLeft} class:fade-right={canScrollRight}>
  <div class="tabs-container" bind:this={scrollEl} onscroll={updateFades}>
    {#each PORTFOLIO_TABS as tab}
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
  .portfolio-tabs {
    flex: 1;
    min-width: 0;
    position: relative;
    --fade-width: 32px;
  }

  /* Edge fade masks */
  .portfolio-tabs::before,
  .portfolio-tabs::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: var(--fade-width);
    pointer-events: none;
    z-index: 1;
    opacity: 0;
    transition: opacity 200ms ease-out;
  }

  .portfolio-tabs::before {
    left: 0;
    background: linear-gradient(to right, var(--background), transparent);
  }

  .portfolio-tabs::after {
    right: 0;
    background: linear-gradient(to left, var(--background), transparent);
  }

  .portfolio-tabs.fade-left::before {
    opacity: 1;
  }

  .portfolio-tabs.fade-right::after {
    opacity: 1;
  }

  .tabs-container {
    display: flex;
    gap: 24px;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .tabs-container::-webkit-scrollbar {
    display: none;
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
    white-space: nowrap;
    flex-shrink: 0;
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

  @media (max-width: 640px) {
    .tab-button {
      font-size: 18px;
      line-height: 24px;
    }
  }
</style>
