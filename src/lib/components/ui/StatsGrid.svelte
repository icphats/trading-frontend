<script lang="ts">
  import type { Stat } from "$lib/types/components";

  interface Props {
    stats: Stat[];
  }

  let { stats }: Props = $props();
</script>

<div class="stats-row">
  {#each stats as stat, index (stat.label)}
    <div class="stat-item" class:first={index === 0}>
      <div class="stat-label">{stat.label}</div>
      <div class="stat-value">{stat.value}</div>
      {#if stat.change}
        <div class="stat-change-row">
          <span class="delta-arrow" class:positive={stat.isPositive} class:negative={!stat.isPositive}>
            {stat.isPositive ? '▲' : '▼'}
          </span>
          <span class="stat-change">{stat.change} today</span>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  /* Stats row - Uniswap style with left borders */
  .stats-row {
    display: flex;
    width: 100%;
  }

  .stat-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 60px;
    padding-left: 24px;
    border-left: 1px solid var(--border);
  }

  .stat-item.first {
    padding-left: 0;
    border-left: none;
  }

  /* body4 variant - 13px/16px */
  .stat-label {
    font-family: 'Basel', sans-serif;
    font-size: 13px;
    line-height: 16px;
    font-weight: 485;
    color: var(--muted-foreground);
  }

  /* subheading1 variant - 19px/24px */
  .stat-value {
    font-family: 'Basel', sans-serif;
    font-size: 19px;
    line-height: 24px;
    font-weight: 485;
    color: var(--foreground);
  }

  .stat-change-row {
    display: flex;
    align-items: center;
    gap: 2px;
    min-height: 16px;
  }

  .delta-arrow {
    font-size: 10px;
    line-height: 1;
  }

  .delta-arrow.positive {
    color: var(--color-bullish);
  }

  .delta-arrow.negative {
    color: var(--color-bearish);
  }

  /* body4 variant - 13px/16px */
  .stat-change {
    font-family: 'Basel', sans-serif;
    font-size: 13px;
    line-height: 16px;
    font-weight: 485;
    color: var(--foreground);
  }

  /* Responsive: show 3 on tablet, 2 on mobile */
  @media (max-width: 1024px) {
    .stat-item:nth-child(n+4) {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .stat-item:nth-child(n+3) {
      display: none;
    }
  }
</style>
