<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Content alignment */
    align?: "left" | "center" | "right";
    /** Compact mode (smaller padding & font) */
    compact?: boolean;
    /** Cell content */
    children?: Snippet;
  }

  let {
    align = "left",
    compact = false,
    children,
  }: Props = $props();
</script>

<div
  class="grid-cell"
  class:compact
  class:align-left={align === "left"}
  class:align-center={align === "center"}
  class:align-right={align === "right"}
>
  {#if children}
    {@render children()}
  {/if}
</div>

<style>
  .grid-cell {
    display: flex;
    align-items: center;
    padding: 12px 10px;
    font-size: 14px;
    font-weight: 485;
    font-variant-numeric: tabular-nums lining-nums;
    overflow: hidden;
    white-space: nowrap;
    color: var(--foreground);
  }

  .grid-cell.compact {
    padding: 8px 10px;
    font-size: 13px;
  }

  /* Alignment */
  .grid-cell.align-left {
    justify-content: flex-start;
  }

  .grid-cell.align-center {
    justify-content: center;
  }

  .grid-cell.align-right {
    justify-content: flex-end;
  }
</style>
