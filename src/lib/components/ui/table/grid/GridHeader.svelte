<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Header content (GridCells) */
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="grid-header">
  {@render children()}
</div>

<style>
  .grid-header {
    display: grid;
    grid-template-columns: var(--grid-columns);
    align-items: center;
    background: var(--table-header-bg, var(--background));
    border-radius: var(--radius-sm);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  /* Header cells get muted styling */
  .grid-header :global(.grid-cell) {
    color: var(--muted-foreground);
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 8px 10px;
  }
</style>
