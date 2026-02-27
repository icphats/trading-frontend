<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="create-container">
  {@render children?.()}
</div>

<style>
  /* Canonical container - single source of truth for /create/ routes */
  .create-container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px 50px 48px;
  }

  /* Progressive padding reduction (Uniswap pattern: 50px → 24px → 16px) */
  @media (max-width: 1024px) {
    .create-container {
      padding: 24px 24px 48px;
    }
  }

  @media (max-width: 768px) {
    .create-container {
      padding: 16px;
    }
  }
</style>
