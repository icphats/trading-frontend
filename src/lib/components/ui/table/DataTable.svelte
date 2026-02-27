<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";

  interface Props {
    /** Array of data items to render */
    data: T[];
    /** Loading state */
    loading?: boolean;
    /** Error message */
    error?: string | null;
    /** Called when more items should be loaded */
    loadMore?: () => void;
    /** Whether there are more items to load */
    hasMore?: boolean;
    /** Whether currently loading more items */
    loadingMore?: boolean;
    /** Max width of the table container */
    maxWidth?: number;
    /** Header row snippet */
    header: Snippet;
    /** Row renderer snippet - receives item and index */
    row: Snippet<[item: T, index: number]>;
    /** Empty state message */
    emptyMessage?: string;
    /** Callback when a row is clicked */
    onRowClick?: (item: T, index: number) => void;
    /** Whether rows are clickable */
    clickableRows?: boolean;
  }

  let {
    data,
    loading = false,
    error = null,
    loadMore,
    hasMore = false,
    loadingMore = false,
    maxWidth = 1200,
    header,
    row,
    emptyMessage = "No data found",
    onRowClick,
    clickableRows = false,
  }: Props = $props();

  let sentinelEl: HTMLDivElement | null = $state(null);
  let observer: IntersectionObserver | null = null;

  // Scroll synchronization
  let headerContainer: HTMLDivElement | null = $state(null);
  let bodyContainer: HTMLDivElement | null = $state(null);

  onMount(() => {
    return () => {
      observer?.disconnect();
    };
  });

  // Set up IntersectionObserver for infinite scroll
  $effect(() => {
    if (!sentinelEl || !loadMore) return;

    observer?.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(sentinelEl);
  });

  // Synchronize scroll between header and body
  function handleBodyScroll() {
    if (headerContainer && bodyContainer) {
      headerContainer.scrollLeft = bodyContainer.scrollLeft;
    }
  }

  function handleHeaderScroll() {
    if (headerContainer && bodyContainer) {
      bodyContainer.scrollLeft = headerContainer.scrollLeft;
    }
  }

  function handleRowClick(item: T, index: number) {
    if (clickableRows && onRowClick) {
      onRowClick(item, index);
    }
  }

  function handleKeyDown(event: KeyboardEvent, item: T, index: number) {
    if (
      clickableRows &&
      onRowClick &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      onRowClick(item, index);
    }
  }
</script>

<div class="data-table-container" style="max-width: {maxWidth}px;">
  {#if loading}
    <div class="data-table-loading">
      <span class="loading-text">Loading...</span>
    </div>
  {:else if error}
    <div class="data-table-error">
      <span class="error-text">{error}</span>
    </div>
  {:else if data.length === 0}
    <div class="data-table-empty">
      <span class="empty-text">{emptyMessage}</span>
    </div>
  {:else}
    <!-- Header Container (Sticky) -->
    <div class="data-table-header-container">
      <!-- Spacer element: blocks rows scrolling underneath -->
      <div class="header-spacer"></div>
      <!-- Border wrapper: stays 100% width, contains scrollable content -->
      <div
        class="data-table-header-border"
        bind:this={headerContainer}
        onscroll={handleHeaderScroll}
      >
        <div class="data-table-header-row">
          {@render header()}
        </div>
      </div>
    </div>

    <!-- Body Container (Scrollable) -->
    <div
      class="data-table-body-container"
      bind:this={bodyContainer}
      onscroll={handleBodyScroll}
    >
      <div class="data-table-content-wrapper">
        <div class="data-table-body">
          {#each data as item, index (index)}
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <div
              class="data-table-row"
              class:clickable={clickableRows}
              role={clickableRows ? "row" : "listitem"}
              tabindex={clickableRows ? 0 : -1}
              onclick={() => handleRowClick(item, index)}
              onkeydown={(e) => handleKeyDown(e, item, index)}
            >
              {@render row(item, index)}
            </div>
          {/each}
        </div>
      </div>

      <!-- Infinite scroll sentinel -->
      {#if hasMore && loadMore}
        <div bind:this={sentinelEl} class="scroll-sentinel">
          {#if loadingMore}
            <div class="loading-more-indicator">
              <span>Loading more...</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .data-table-container {
    width: 100%;
    margin: 20px auto 0;
    position: relative;
    /* No border here - borders are on header-row and body-container separately */
    /* This allows sticky header to work without border detachment */
    display: flex;
    flex-direction: column;
  }

  .data-table-content-wrapper {
    min-width: 100%;
    width: fit-content;
    display: flex;
    flex-direction: column;
  }

  .data-table-loading,
  .data-table-error,
  .data-table-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 16px;
  }

  .loading-text,
  .empty-text {
    font-size: 14px;
    color: var(--muted-foreground);
  }

  .error-text {
    font-size: 14px;
    color: var(--destructive);
  }

  /* Header Spacer - blocks rows scrolling underneath, OUTSIDE the border */
  .header-spacer {
    height: 12px;
    background: var(--background);
    width: 100%;
  }

  /* Header Container - sticky wrapper, no border here */
  .data-table-header-container {
    position: sticky;
    top: var(--navbar-height, 56px);
    z-index: var(--z-table-header, 10);
    background: var(--background);
    width: 100%;
  }

  /* Header border wrapper - 100% width, has border, hides scrollbar */
  .data-table-header-border {
    width: 100%;
    overflow-x: hidden; /* Hide scrollbar, synced via JS */
    border: 1px solid var(--border);
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    background: var(--background);
  }

  /* Header Row */
  .data-table-header-row {
    display: flex;
    align-items: center;
    min-width: 100%;
    width: fit-content; /* Expands for horizontal scroll sync */
  }

  /* Body Container */
  .data-table-body-container {
    overflow-x: auto; /* Allow horizontal scrolling */
    width: 100%;
    overscroll-behavior-x: contain;
    /* Border continues from header - no top border, rounded bottom corners */
    border: 1px solid var(--border);
    border-top: none;
    border-bottom-left-radius: 16px;
    border-bottom-right-radius: 16px;
  }

  /* Data Rows */
  .data-table-body {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .data-table-row {
    display: flex;
    align-items: center;
    width: 100%;
    height: 56px;
    transition: background-color 0ms;
    border-bottom: 1px solid var(--border);
  }

  .data-table-row:last-child {
    border-bottom: none;
  }

  .data-table-row:hover {
    background: var(--hover-overlay-subtle, rgba(255, 255, 255, 0.03));
  }

  /* Last row respects bottom border radius */
  .data-table-row:last-child:hover {
    border-bottom-left-radius: 16px;
    border-bottom-right-radius: 16px;
  }

  .data-table-row.clickable {
    cursor: pointer;
  }

  .data-table-row.clickable:active {
    background: var(--active-overlay, rgba(255, 255, 255, 0.1));
  }

  /* Infinite scroll */
  .scroll-sentinel {
    height: 1px;
    width: 100%;
  }

  .loading-more-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    color: var(--muted-foreground);
    font-size: 14px;
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .data-table-row {
      height: 48px;
    }
  }
</style>
