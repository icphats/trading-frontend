<script lang="ts">
  /**
   * SideDrawer - Reusable desktop side drawer with chevron close
   *
   * Features:
   * - Slides in from right with smooth animation
   * - Chevron close button on the left edge (Uniswap style)
   * - Configurable width with responsive breakpoints
   * - Gap from viewport edges
   *
   * Usage:
   * ```svelte
   * <SideDrawer
   *   open={isOpen}
   *   onClose={() => isOpen = false}
   * >
   *   <div>Content here</div>
   * </SideDrawer>
   * ```
   */

  import { fly } from "svelte/transition";
  import { cubicOut, quintOut } from "svelte/easing";

  interface Props {
    /** Whether the drawer is open */
    open: boolean;
    /** Called when the drawer should close */
    onClose: () => void;
    /** Content to render inside the drawer */
    children?: any;
    /** Width in pixels for large screens (default: 390) */
    widthLarge?: number;
    /** Width in pixels for medium screens (default: 320) */
    widthMedium?: number;
    /** Gap from viewport edge in pixels (default: 8) */
    margin?: number;
    /** Additional class for the drawer container */
    class?: string;
  }

  let {
    open,
    onClose,
    children,
    widthLarge = 390,
    widthMedium = 320,
    margin = 8,
    class: className = "",
  }: Props = $props();
</script>

{#if open}
  <div
    class="side-drawer-wrapper {className}"
    style:--drawer-width-lg="{widthLarge}px"
    style:--drawer-width-md="{widthMedium}px"
    style:--drawer-margin="{margin}px"
    in:fly={{ x: '100%', duration: 300, easing: quintOut }}
    out:fly={{ x: '100%', duration: 200, easing: cubicOut }}
  >
    <!-- Close chevron area (Uniswap style) -->
    <button
      class="close-area"
      onclick={onClose}
      aria-label="Close drawer"
    >
      <div class="chevron-icon">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="13 17 18 12 13 7"></polyline>
          <polyline points="6 17 11 12 6 7"></polyline>
        </svg>
      </div>
    </button>

    <!-- Drawer panel -->
    <div
      class="side-drawer"
      role="dialog"
      aria-modal="true"
    >
      <div class="side-drawer-scroll">
        {#if children}
          {@render children()}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .side-drawer-wrapper {
    position: fixed;
    top: var(--drawer-margin);
    right: var(--drawer-margin);
    bottom: var(--drawer-margin);
    display: flex;
    flex-direction: row;
    align-items: stretch;
  }

  .close-area {
    display: flex;
    align-items: center;
    padding: 1.5rem 0.75rem 1.5rem 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 150ms ease, transform 150ms ease, background-color 150ms ease;
    border-top-left-radius: var(--radius-xl);
    border-bottom-left-radius: var(--radius-xl);
  }

  .close-area:hover {
    opacity: 1;
    transform: translateX(4px);
    background-color: rgba(128, 128, 128, 0.08);
  }

  .chevron-icon {
    color: var(--muted-foreground);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .side-drawer {
    width: var(--drawer-width-lg);
    max-width: calc(100vw - 80px);
    height: 100%;
    background: var(--background);
    border-radius: var(--radius-xl);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-2xl);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    /* CRITICAL: Prevent flex items from exceeding container */
    min-height: 0;
  }

  /* Smaller width on medium screens */
  @media (max-width: 1280px) {
    .side-drawer {
      width: var(--drawer-width-md);
    }
  }

  .side-drawer-scroll {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain; /* Prevent scroll chaining to body */
    min-height: 0; /* CRITICAL: Required for flex children to scroll */
  }

  /* Custom scrollbar */
  .side-drawer-scroll::-webkit-scrollbar {
    width: 6px;
  }

  .side-drawer-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .side-drawer-scroll::-webkit-scrollbar-thumb {
    background: var(--muted-foreground);
    border-radius: 3px;
    opacity: 0.3;
  }

  .side-drawer-scroll::-webkit-scrollbar-thumb:hover {
    opacity: 0.5;
  }
</style>
