<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Cell width in pixels */
    width?: number;
    /** Minimum width in pixels */
    minWidth?: number;
    /** Maximum width in pixels */
    maxWidth?: number;
    /** Whether the cell should grow to fill available space */
    grow?: boolean;
    /** Content alignment */
    align?: "left" | "center" | "right";
    /** Whether this is a header cell */
    header?: boolean;
    /** Whether this cell is pinned (sticky) */
    pinned?: boolean;
    /** Left offset for pinned columns */
    pinnedOffset?: number;
    /** Whether this is the last pinned column (shows border) */
    lastPinned?: boolean;
    /** Whether to show loading skeleton */
    loading?: boolean;
    /** Compact mode for dropdowns/smaller tables (smaller padding & font) */
    compact?: boolean;
    /** Cell content (optional - can be empty) */
    children?: Snippet;
  }

  let {
    width,
    minWidth,
    maxWidth,
    grow = false,
    align = "right",
    header = false,
    pinned = false,
    pinnedOffset = 0,
    lastPinned = false,
    loading = false,
    compact = false,
    children,
  }: Props = $props();

  let style = $derived.by(() => {
    const styles: string[] = [];

    if (width) styles.push(`width: ${width}px`);
    if (minWidth) styles.push(`min-width: ${minWidth}px`);
    if (maxWidth) styles.push(`max-width: ${maxWidth}px`);
    if (grow) styles.push("flex-grow: 1");
    if (pinned) {
      styles.push(`position: sticky`);
      styles.push(`left: ${pinnedOffset}px`);
      styles.push(`z-index: var(--z-table-pinned-cell, 5)`);
    }
    if (lastPinned) {
      styles.push(`border-right: 1px solid var(--border)`);
    }

    return styles.join("; ");
  });
</script>

<div
  class="table-cell"
  class:header
  class:compact
  class:align-left={align === "left"}
  class:align-center={align === "center"}
  class:align-right={align === "right"}
  class:pinned
  {style}
>
  {#if loading}
    <div class="loading-skeleton"></div>
  {:else}
    {@render children?.()}
  {/if}
</div>

<style>
  .table-cell {
    display: flex;
    align-items: center;
    padding: 16px 12px;
    font-variant-numeric: lining-nums tabular-nums;
    overflow: hidden;
    height: 100%;
  }

  /* Header cell styling */
  .table-cell.header {
    padding: 12px;
    color: var(--muted-foreground);
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    user-select: none;
  }

  /* Data cell styling */
  .table-cell:not(.header) {
    color: var(--foreground);
    font-size: 14px;
    font-weight: 485;
  }

  /* Compact mode (for dropdowns/smaller tables) */
  .table-cell.compact {
    padding: 8px 10px;
    font-size: 13px;
  }

  .table-cell.compact.header {
    padding: 8px 10px;
    font-size: 11px;
  }

  /* Alignment */
  .table-cell.align-left {
    justify-content: flex-start;
  }

  .table-cell.align-center {
    justify-content: center;
  }

  .table-cell.align-right {
    justify-content: flex-end;
  }

  /* Pinned cell - solid background to prevent overlap when scrolling */
  .table-cell.pinned {
    background: var(--background);
    transition: background-color 0ms;
  }

  :global(.data-table-row:hover) .table-cell.pinned:not(.header) {
    background: linear-gradient(
        var(--hover-overlay-subtle, rgba(255, 255, 255, 0.03)),
        var(--hover-overlay-subtle, rgba(255, 255, 255, 0.03))
      ),
      var(--background);
  }

  /* Loading skeleton */
  .loading-skeleton {
    width: 75%;
    height: 16px;
    background: var(--muted);
    border-radius: 4px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .table-cell {
      padding: 12px;
    }

    .table-cell:not(.header) {
      font-size: 14px;
    }
  }
</style>
