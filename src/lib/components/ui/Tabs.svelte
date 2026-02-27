<script lang="ts">
  import type { Snippet } from "svelte";

  type TabItem = {
    id: string;
    label: string;
  };

  interface Props {
    tabs: TabItem[];
    activeTab?: string;
    onTabChange?: (tabId: string) => void;
    /** Content to render below tabs. Optional - if not provided, only tab bar is rendered. */
    children?: Snippet<[string]>;
    /** Compact mode reduces tab bar height */
    compact?: boolean;
  }

  const {
    tabs,
    activeTab,
    onTabChange,
    children,
    compact = false
  }: Props = $props();

  // Internal state for uncontrolled mode
  let internalActiveTab = $state<string>('');

  // Initialize and sync internal state from props
  $effect.pre(() => {
    if (!internalActiveTab) {
      internalActiveTab = activeTab || tabs[0]?.id || '';
    }
    if (activeTab !== undefined) {
      internalActiveTab = activeTab;
    }
  });

  // Use the prop if provided (controlled), otherwise use internal state (uncontrolled)
  let currentTab = $derived(activeTab ?? internalActiveTab);

  const handleTabClick = (tabId: string) => {
    // Update internal state for uncontrolled mode
    internalActiveTab = tabId;
    // Call the callback if provided
    onTabChange?.(tabId);
  };
</script>

<div class="flex flex-col h-full">
  <!-- Tab Navigation - scrolls horizontally when tabs overflow -->
  <div class="tabs-nav shrink-0 border-b border-border">
    <div class="flex" class:h-10={!compact} class:h-9={compact}>
      {#each tabs as tab}
        <button
          class="tab-button relative flex items-center justify-center h-full px-4 bg-transparent border-none text-sm font-semibold cursor-pointer transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:z-10 {currentTab === tab.id
            ? 'text-foreground bg-transparent'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'}"
          onclick={() => handleTabClick(tab.id)}
        >
          <span class="flex items-center gap-2 tracking-wide">{tab.label}</span>
          {#if currentTab === tab.id}
            <div class="absolute bottom-0 left-0 right-0 h-px bg-primary animate-slideIn"></div>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <!-- Content Area (only rendered if children snippet provided) -->
  {#if children}
    <div class="flex-1 overflow-hidden">
      {@render children(currentTab)}
    </div>
  {/if}
</div>

<style>
  /* Horizontal scroll for tabs when they overflow */
  .tabs-nav {
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  /* Hide scrollbar but keep functionality */
  .tabs-nav::-webkit-scrollbar {
    display: none;
  }
  .tabs-nav {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  /* Tab buttons - don't shrink, allow overflow for scrolling */
  .tab-button {
    flex: 1 0 auto; /* Grow to fill space, don't shrink, auto basis */
    min-width: max-content; /* Never smaller than content */
    white-space: nowrap;
  }

  @keyframes slideIn {
    from {
      transform: scaleX(0);
      opacity: 0;
    }
    to {
      transform: scaleX(1);
      opacity: 1;
    }
  }

  .animate-slideIn {
    animation: slideIn 200ms ease;
  }
</style>
