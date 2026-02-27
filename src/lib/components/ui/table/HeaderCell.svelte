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
    /** Default label (used when no children provided) */
    label?: string;
    /** Whether this column is sortable */
    sortable?: boolean;
    /** Current sort direction (null = not sorted) */
    sortDirection?: "asc" | "desc" | null;
    /** Called when header is clicked (for sorting) */
    onSort?: () => void;
    /** Whether this cell is pinned (sticky) */
    pinned?: boolean;
    /** Left offset for pinned columns */
    pinnedOffset?: number;
    /** Whether this is the last pinned column (shows border) */
    lastPinned?: boolean;
    /** Compact mode for dropdowns/smaller tables (smaller padding & font) */
    compact?: boolean;
    /** Cell content (optional - overrides label if provided) */
    children?: Snippet;
  }

  let {
    width,
    minWidth,
    maxWidth,
    grow = false,
    align = "right",
    label,
    sortable = false,
    sortDirection = null,
    onSort,
    pinned = false,
    pinnedOffset = 0,
    lastPinned = false,
    compact = false,
    children,
  }: Props = $props();

  let isActive = $derived(sortDirection !== null);

  let style = $derived.by(() => {
    const styles: string[] = [];

    if (width) styles.push(`width: ${width}px`);
    if (minWidth) styles.push(`min-width: ${minWidth}px`);
    if (maxWidth) styles.push(`max-width: ${maxWidth}px`);
    if (grow) styles.push("flex-grow: 1");
    if (pinned) {
      styles.push(`position: sticky`);
      styles.push(`left: ${pinnedOffset}px`);
      styles.push(`z-index: var(--z-table-pinned-header, 20)`);
      styles.push(`background: var(--table-header-bg)`);
    }
    if (lastPinned) {
      styles.push(`border-right: 1px solid var(--border)`);
    }

    return styles.join("; ");
  });

  function handleClick() {
    if (sortable && onSort) {
      onSort();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (sortable && onSort && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onSort();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="header-cell"
  class:sortable
  class:compact
  class:active={isActive}
  class:align-left={align === "left"}
  class:align-center={align === "center"}
  class:align-right={align === "right"}
  class:pinned
  role="columnheader"
  tabindex={sortable ? 0 : -1}
  aria-sort={sortDirection === "asc"
    ? "ascending"
    : sortDirection === "desc"
      ? "descending"
      : "none"}
  onclick={handleClick}
  onkeydown={handleKeyDown}
  {style}
>
  <div class="header-content">
    {#if sortable}
      <span
        class="sort-arrow"
        class:asc={sortDirection === "asc"}
        class:desc={sortDirection === "desc"}
        class:visible={isActive}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 5L12 19M12 19L18 13M12 19L6 13"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    {/if}
    <span class="header-text" class:active={isActive}>
      {#if children}
        {@render children()}
      {:else}
        {label ?? ''}
      {/if}
    </span>
  </div>
</div>

<style>
  .header-cell {
    display: flex;
    align-items: center;
    padding: 12px;
    background: var(--table-header-bg);
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    user-select: none;
    height: 100%;
  }

  .header-cell.sortable {
    cursor: pointer;
    transition: opacity 0.1s ease-in-out;
  }

  .header-cell.sortable:hover {
    opacity: 0.7;
  }

  /* Compact mode (for dropdowns/smaller tables) */
  .header-cell.compact {
    padding: 8px 10px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .header-cell.compact .sort-arrow svg {
    width: 10px;
    height: 10px;
  }

  /* Alignment */
  .header-cell.align-left {
    justify-content: flex-start;
  }

  .header-cell.align-center {
    justify-content: center;
  }

  .header-cell.align-right {
    justify-content: flex-end;
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header-text {
    color: var(--muted-foreground);
    transition: color 0.1s ease-in-out;
  }

  .header-text.active {
    color: var(--foreground);
  }

  /* Sort arrow */
  .sort-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--foreground);
    opacity: 0;
    transition:
      opacity 0.08s ease-in-out,
      transform 0.15s ease-in-out;
  }

  .header-cell.sortable:hover .sort-arrow {
    opacity: 0.5;
  }

  .sort-arrow.visible {
    opacity: 1;
  }

  .sort-arrow.asc {
    transform: rotate(180deg);
  }

  .sort-arrow.desc {
    transform: rotate(0deg);
  }
</style>
