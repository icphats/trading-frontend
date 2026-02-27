<script lang="ts">
  interface Props {
    delta: number;
    size?: 'sm' | 'md';
  }

  let { delta, size = 'sm' }: Props = $props();

  const isPositive = $derived(delta > 0);
  const isNegative = $derived(delta < 0);
</script>

{#if isPositive}
  <svg
    class="delta-arrow up {size}"
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M6 2L10 8H2L6 2Z" fill="currentColor" />
  </svg>
{:else if isNegative}
  <svg
    class="delta-arrow down {size}"
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M6 10L2 4H10L6 10Z" fill="currentColor" />
  </svg>
{/if}

<style>
  .delta-arrow {
    flex-shrink: 0;
  }

  .delta-arrow.sm {
    width: 10px;
    height: 10px;
  }

  .delta-arrow.md {
    width: 12px;
    height: 12px;
  }

  .delta-arrow.up {
    color: var(--color-bullish, #22c55e);
  }

  .delta-arrow.down {
    color: var(--color-bearish, #ef4444);
  }
</style>
