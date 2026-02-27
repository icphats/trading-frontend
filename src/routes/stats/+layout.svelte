<script lang="ts">
  import type { Snippet } from 'svelte';
  import StatsTabs from '$lib/components/stats/StatsTabs.svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="stats-page">
  <div class="stats-container">
    <header class="stats-header">
      <StatsTabs />
    </header>

    <main class="stats-content">
      {@render children?.()}
    </main>
  </div>
</div>

<style>
  .stats-page {
    min-height: calc(100vh - 64px);
    background: var(--background);
  }

  .stats-container {
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    padding: 48px 40px;
  }

  .stats-header {
    margin-bottom: 48px;
  }

  .stats-content {
    width: 100%;
  }

  @media (max-width: 768px) {
    .stats-container {
      padding: 24px 16px;
    }

    .stats-header {
      margin-bottom: 32px;
    }
  }
</style>
