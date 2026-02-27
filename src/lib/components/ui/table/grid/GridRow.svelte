<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Whether this row is clickable */
    clickable?: boolean;
    /** Click handler */
    onclick?: () => void;
    /** Row content (GridCells) */
    children: Snippet;
  }

  let {
    clickable = false,
    onclick,
    children,
  }: Props = $props();
</script>

{#if clickable}
<div
  class="grid-row clickable"
  role="button"
  tabindex="0"
  onclick={onclick}
  onkeydown={(e) => {
    if (onclick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onclick();
    }
  }}
>
  {@render children()}
</div>
{:else}
<div class="grid-row">
  {@render children()}
</div>
{/if}

<style>
  .grid-row {
    display: grid;
    grid-template-columns: var(--grid-columns);
    align-items: center;
    border-bottom: 1px solid oklch(from var(--border) l c h / 0.3);
    transition: background-color 0ms;
  }

  .grid-row:last-child {
    border-bottom: none;
  }

  .grid-row:hover {
    background: var(--hover-overlay-subtle, rgba(255, 255, 255, 0.03));
  }

  .grid-row.clickable {
    cursor: pointer;
  }

  .grid-row.clickable:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: -2px;
  }
</style>
