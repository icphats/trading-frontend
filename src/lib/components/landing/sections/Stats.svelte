<script lang="ts">
  import { untrack } from 'svelte';
  import StatCard from '../components/StatCard.svelte';
  import { createInViewObserver } from '../components/useInView.svelte';
  import { platformState } from '$lib/domain/platform';
  import { formatToken } from '$lib/utils/format.utils';
  import { api } from '$lib/actors/api.svelte';

  // Create observer for scroll-triggered animations
  const observer = createInViewObserver(0.2);

  // Track if we've already fetched
  let hasFetched = $state(false);

  // Fetch platform stats when indexer becomes available
  $effect(() => {
    if (api.indexer && !hasFetched) {
      hasFetched = true;
      untrack(() => {
        platformState.fetchStats();
      });
    }
  });

  // Format E6 value to compact USD string
  function formatE6(value: bigint): string {
    return '$' + formatToken({ value, unitName: 6, short: true });
  }

  // Format large number with suffix
  function formatCount(value: bigint): string {
    const num = Number(value);
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toLocaleString();
  }

  // Derive stats from platformState
  let stats = $derived.by(() => {
    if (!platformState.hasData) {
      // Loading state - show dashes
      return [
        { title: 'All-Time Volume', value: '—', delay: 0 },
        { title: 'Total Value Locked', value: '—', delay: 0.2 },
        { title: 'Total Trades', value: '—', delay: 0.4 },
        { title: '24h Volume', value: '—', delay: 0.6, live: true }
      ];
    }

    return [
      { title: 'All-Time Volume', value: formatE6(platformState.totalVolumeCumulative), delay: 0 },
      { title: 'Total Value Locked', value: formatE6(platformState.tvl), delay: 0.2 },
      { title: 'Total Trades', value: formatCount(platformState.totalTransactions), delay: 0.4 },
      { title: '24h Volume', value: formatE6(platformState.volume24h), delay: 0.6, live: true }
    ];
  });
</script>

<section class="stats-section" use:observer.observe>
  <div class="stats-container">
    <!-- Left side: Headline and description -->
    <div class="stats-headline">
      <h2 class="headline">
        Protocol at a Glance
      </h2>
      <div class="description">
        <p>Live data from a fully onchain protocol.</p>
        <a href="/stats" class="cta-button">
          View stats
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </a>
      </div>
    </div>

    <!-- Right side: Stats grid -->
    <div class="stats-grid">
      <div class="stats-header">
        <span class="live-indicator"></span>
        <span>Protocol Stats</span>
      </div>
      <div class="stats-cards">
        {#each stats as stat, i}
          <div class="stat-card-wrapper">
            <StatCard
              title={stat.title}
              value={stat.value}
              delay={stat.delay}
              live={stat.live}
              inView={observer.inView}
            />
          </div>
        {/each}
      </div>
    </div>
  </div>
</section>

<style>
  .stats-section {
    width: 100%;
    height: 100%;
    padding: 4rem 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .stats-container {
    max-width: 1280px;
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: 3rem;
  }

  /* Headline side */
  .stats-headline {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1.25rem;
    max-width: 500px;
  }

  .headline {
    font-size: clamp(1.5rem, 5.5vw, 2.75rem);
    font-weight: 500;
    line-height: 1.1;
    margin: 0;
    color: var(--foreground);
  }

  .description {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .description p {
    font-size: clamp(0.9375rem, 3.75vw, 1.125rem);
    line-height: 1.6;
    color: var(--muted-foreground);
    margin: 0;
  }

  .cta-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: var(--muted);
    border-radius: 24px;
    color: var(--foreground);
    font-weight: 500;
    text-decoration: none;
    width: fit-content;
    transition: background 0.2s ease;
  }

  .cta-button:hover {
    background: var(--border);
  }

  /* Stats grid side */
  .stats-grid {
    flex: 1;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .stats-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--muted);
    border-radius: 20px;
    color: var(--muted-foreground);
    font-size: 1rem;
    font-weight: 500;

    /* Dot pattern */
    background-image: radial-gradient(
      oklch(from var(--muted-foreground) l c h / 0.2) 0.5px,
      transparent 0
    );
    background-size: 12px 12px;
    background-position: -8.5px -8.5px;
  }

  .live-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-bullish);
    animation: pulsate 1s ease-in-out infinite alternate;
  }

  @keyframes pulsate {
    0% { box-shadow: 0 0 0 0 oklch(from var(--color-bullish) l c h / 0.4); }
    100% { box-shadow: 0 0 0 4px oklch(from var(--color-bullish) l c h / 0.2); }
  }

  .stats-cards {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .stat-card-wrapper {
    min-height: 140px;
  }

  @keyframes riseIn {
    0% {
      opacity: 0;
      transform: translateY(30px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Responsive */
  @media (max-width: 767px) {
    .stats-section {
      padding: clamp(0.75rem, 5vw, 2.5rem) clamp(0.5rem, 4vw, 2rem);
      box-sizing: border-box;
    }

    .stats-container {
      flex-direction: column;
      gap: clamp(1rem, 5vw, 3rem);
    }

    .stats-headline {
      max-width: 100%;
    }

    .stats-grid {
      max-width: 100%;
    }

    .stats-cards {
      grid-template-columns: 1fr;
    }

    .stat-card-wrapper {
      min-height: 120px;
    }
  }
</style>
