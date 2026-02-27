<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    isLoading?: boolean;
    error?: string | null;
    isEmpty?: boolean;
    emptyMessage?: string;
    height?: string;
    children: Snippet;
  }

  let {
    isLoading = false,
    error = null,
    isEmpty = false,
    emptyMessage = 'No chart data available',
    height = '320px',
    children,
  }: Props = $props();
</script>

<div class="chart-container" style:height>
  {@render children()}

  {#if isLoading}
    <div class="chart-overlay">
      <div class="loading-shimmer"></div>
    </div>
  {:else if error}
    <div class="chart-overlay">
      <span class="message error">{error}</span>
    </div>
  {:else if isEmpty}
    <div class="chart-overlay">
      <span class="message">{emptyMessage}</span>
    </div>
  {/if}
</div>

<style>
  .chart-container {
    position: relative;
    width: 100%;
  }

  .chart-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--background);
    z-index: 5;
  }

  .loading-shimmer {
    width: 90%;
    height: 60%;
    max-height: 200px;
    background: linear-gradient(
      90deg,
      var(--muted) 25%,
      var(--background) 50%,
      var(--muted) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8px;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  .message {
    font-family: 'Basel', sans-serif;
    font-size: 15px;
    color: var(--muted-foreground);
  }

  .message.error {
    color: var(--color-bearish, #ef4444);
  }
</style>
