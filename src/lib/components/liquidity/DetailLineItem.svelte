<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string | Snippet;
    value: string | Snippet;
  }

  let { label, value }: Props = $props();
</script>

<div class="detail-line">
  <span class="detail-label">
    {#if typeof label === 'string'}
      {label}
    {:else}
      {@render label()}
    {/if}
  </span>
  <span class="detail-value">
    {#if typeof value === 'string'}
      {value}
    {:else}
      {@render value()}
    {/if}
  </span>
</div>

<style>
  .detail-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
  }

  .detail-label {
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }

  .detail-value {
    font-size: 0.75rem;
    color: var(--foreground);
    font-family: var(--font-numeric);
  }
</style>
