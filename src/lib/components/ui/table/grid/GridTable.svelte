<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** CSS grid-template-columns value (e.g., "60px 100px 1fr 1fr 80px 100px") */
    columns: string;
    /** Maximum height before scrolling (ignored when flex is true) */
    maxHeight?: string;
    /** Minimum width for the inner grid — enables horizontal scroll when container is narrower */
    minWidth?: string;
    /** When true, uses flex: 1 + min-height: 0 to fill available flex space instead of max-height */
    flex?: boolean;
    /** Optional class for the container */
    class?: string;
    /** Table content */
    children: Snippet;
  }

  let {
    columns,
    maxHeight = "none",
    minWidth,
    flex = false,
    class: className = "",
    children,
  }: Props = $props();
</script>

<div
  class="grid-table {className}"
  class:grid-table-flex={flex}
  style="--max-height: {maxHeight};"
>
  <div
    class="grid-inner"
    style="--grid-columns: {columns};{minWidth ? ` --min-width: ${minWidth};` : ''}"
  >
    {@render children()}
  </div>
</div>

<style>
  .grid-table {
    overflow-x: auto;
    overflow-y: auto;
    max-height: var(--max-height);
  }

  .grid-table-flex {
    flex: 1;
    min-height: 0;
    max-height: none;
  }

  .grid-inner {
    min-width: var(--min-width, auto);
  }
</style>
