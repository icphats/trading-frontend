<script lang="ts">
  import type { Snippet } from 'svelte';
  import PortfolioHeader from '$lib/components/portfolio/PortfolioHeader.svelte';
  import CompositionBreakdown from '$lib/components/portfolio/overview/CompositionBreakdown.svelte';
  import ConnectWalletBanner from '$lib/components/portfolio/ConnectWalletBanner.svelte';
  import ConnectWalletFixedButton from '$lib/components/portfolio/ConnectWalletFixedButton.svelte';
  import { formatUSD, formatPercent } from '$lib/utils/format.utils';
  import { user } from '$lib/domain/user/auth.svelte';
  import { userPortfolio } from '$lib/domain/user';
  import { pageHeader } from '$lib/components/portfolio/page-header.svelte';
  import { onMount } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  const isConnected = $derived(user.isAuthenticated);
  const isLoading = $derived(userPortfolio.isLoading || userPortfolio.isDiscovering || userPortfolio.isLoadingSpotMarkets);

  // Sticky tabs detection — sentinel placed right before the header
  let sentinelEl: HTMLDivElement | null = $state(null);
  let isStuck = $state(false);

  $effect(() => {
    if (!sentinelEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isStuck = !entry.isIntersecting;
      },
      { threshold: 0 }
    );

    observer.observe(sentinelEl);
    return () => observer.disconnect();
  });

  // Scroll tracking for disconnected state
  let bannerElement: HTMLDivElement | null = $state(null);
  let isBannerInView = $state(true);

  // Set up intersection observer to track banner visibility
  $effect(() => {
    if (isConnected || !bannerElement) {
      isBannerInView = true;
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Banner is "in view" if any part of it is visible
        isBannerInView = entries[0]?.isIntersecting ?? true;
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0
      }
    );

    observer.observe(bannerElement);

    return () => {
      observer.disconnect();
    };
  });

  onMount(async () => {
    if (isConnected) {
      if (!userPortfolio.isInitialized) {
        await userPortfolio.initialize();
      }
      userPortfolio.hydrateSpotMarkets();
      if (user.principal) {
        await userPortfolio.discoverHoldings(user.principal as any);
      }
    }
  });
</script>

<div class="portfolio-page">
  <div class="portfolio-container">
    {#if isConnected}
      <!-- Connected state: normal view -->
      {#if pageHeader.mode === 'overview'}
        <CompositionBreakdown {isLoading} />
      {:else}
        {@const isPositive = pageHeader.change24h >= 0}
        <div class="section-header">
          <div class="section-header-top">
            <div class="section-value-block">
              <span class="section-label">{pageHeader.sectionLabel}</span>
              <span class="section-total">{formatUSD(pageHeader.totalValue, 2)}</span>
              <span class="section-change" class:positive={isPositive} class:negative={!isPositive}>
                {isPositive ? '+' : ''}{formatUSD(pageHeader.change24h, 2)} ({formatPercent(pageHeader.change24hPercent)}) today
              </span>
            </div>
          </div>
        </div>
      {/if}

      <div bind:this={sentinelEl} class="sticky-sentinel"></div>
      <PortfolioHeader stuck={isStuck} />

      <main class="portfolio-content">
        {@render children?.()}
      </main>
    {:else}
      <!-- Disconnected state: demo view -->
      <div bind:this={bannerElement}>
        <ConnectWalletBanner />
      </div>

      <div bind:this={sentinelEl} class="sticky-sentinel"></div>
      <PortfolioHeader stuck={isStuck} />

      <main class="portfolio-content demo-content">
        {@render children?.()}
      </main>

      <!-- Fixed button appears when banner scrolls out of view -->
      <ConnectWalletFixedButton visible={!isBannerInView} />
    {/if}
  </div>
</div>

<style>
  .portfolio-page {
    height: calc(100vh - var(--navbar-height));
    overflow-y: auto;
    background: var(--background);
  }

  .portfolio-container {
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    padding: 24px 16px 0;
  }

  .sticky-sentinel {
    height: 0;
    width: 100%;
    pointer-events: none;
  }

  .portfolio-content {
    padding-bottom: 24px;
  }

  .section-header {
    padding: 24px 0;
  }

  .section-header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
  }

  .section-value-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .section-label {
    font-size: 14px;
    color: var(--muted-foreground);
  }

  .section-total {
    font-size: 36px;
    font-weight: 500;
    color: var(--foreground);
    line-height: 1.1;
  }

  .section-change {
    font-size: 14px;
    color: var(--muted-foreground);
  }

  .section-change.positive {
    color: var(--color-bullish);
  }

  .section-change.negative {
    color: var(--color-bearish);
  }

  /* Demo content styling - disabled appearance */
  .demo-content {
    pointer-events: none;
    cursor: not-allowed;
    opacity: 0.6;
    user-select: none;
    position: relative;
  }

  /* Add a subtle overlay to reinforce the disabled state */
  .demo-content::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      oklch(from var(--background) l c h / 0.3) 100%
    );
    pointer-events: none;
    border-radius: var(--radius);
  }

  @media (max-width: 768px) {
    .portfolio-container {
      padding: 16px;
    }
  }
</style>
