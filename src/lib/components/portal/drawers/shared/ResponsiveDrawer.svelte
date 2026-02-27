<script lang="ts">
  /**
   * ResponsiveDrawer - Responsive drawer that adapts to screen size
   *
   * Follows Uniswap's pattern:
   * - Mobile: Bottom sheet (slides up) with drag-to-dismiss
   * - Desktop: Side drawer (slides from right with chevron close)
   *
   * Uses action-based portal pattern to preserve Svelte transitions.
   *
   * Usage:
   * ```svelte
   * <ResponsiveDrawer
   *   open={isOpen}
   *   onClose={() => isOpen = false}
   * >
   *   <div>Your content</div>
   * </ResponsiveDrawer>
   * ```
   */

  import { browser } from "$app/environment";
  import { portal } from "$lib/components/portal/portal.action";
  import { focusTrap } from "$lib/components/portal/modals/focusTrap";
  import { lockScroll, unlockScroll } from "$lib/components/portal/modals/scroll-lock";
  import { fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import BottomSheet from "./BottomSheet.svelte";
  import SideDrawer from "./SideDrawer.svelte";

  interface Props {
    /** Whether the drawer is open */
    open: boolean;
    /** Called when the drawer should close */
    onClose: () => void;
    /** Content to render */
    children?: any;
    /** Mobile breakpoint in pixels (default: 768) */
    mobileBreakpoint?: number;
    /** Close when clicking backdrop (default: true) */
    closeOnBackdrop?: boolean;
    /** Close on Escape key (default: true) */
    closeOnEsc?: boolean;
    /** BottomSheet max height (default: 90vh) */
    bottomSheetMaxHeight?: string;
    /** SideDrawer width for large screens (default: 390) */
    sideDrawerWidthLarge?: number;
    /** SideDrawer width for medium screens (default: 320) */
    sideDrawerWidthMedium?: number;
    /** Additional class for the backdrop */
    backdropClass?: string;
  }

  let {
    open,
    onClose,
    children,
    mobileBreakpoint = 768,
    closeOnBackdrop = true,
    closeOnEsc = true,
    bottomSheetMaxHeight = "90vh",
    sideDrawerWidthLarge = 390,
    sideDrawerWidthMedium = 320,
    backdropClass = "",
  }: Props = $props();

  // Responsive state
  let innerWidth = $state(browser ? window.innerWidth : 1024);
  let isMobile = $derived(innerWidth < mobileBreakpoint);

  // Track window resize
  $effect(() => {
    if (!browser) return;

    const handleResize = () => {
      innerWidth = window.innerWidth;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  // Escape key handler
  function handleKeydown(e: KeyboardEvent) {
    if (closeOnEsc && e.key === 'Escape' && open) {
      e.preventDefault();
      onClose();
    }
  }

  // Scroll lock and keyboard
  $effect(() => {
    if (open) {
      lockScroll();
      document.addEventListener('keydown', handleKeydown);
    }

    return () => {
      unlockScroll();
      document.removeEventListener('keydown', handleKeydown);
    };
  });

  function handleBackdropClick(e: MouseEvent) {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  }
</script>

{#if open}
  <div use:portal={'#portal-root'} class="portal-container">
    <!-- Backdrop -->
    <div
      class="drawer-backdrop {backdropClass}"
      onclick={handleBackdropClick}
      onkeydown={(e) => e.key === 'Enter' && handleBackdropClick(e as unknown as MouseEvent)}
      role="button"
      tabindex="-1"
      aria-label="Close drawer"
      transition:fade={{ duration: 200, easing: cubicOut }}
    >
      {#if isMobile}
        <!-- Mobile: Bottom Sheet -->
        <div use:focusTrap>
          <BottomSheet
            {open}
            onClose={onClose}
            maxHeight={bottomSheetMaxHeight}
          >
            {#if children}
              {@render children()}
            {/if}
          </BottomSheet>
        </div>
      {:else}
        <!-- Desktop: Side Drawer -->
        <div use:focusTrap>
          <SideDrawer
            {open}
            onClose={onClose}
            widthLarge={sideDrawerWidthLarge}
            widthMedium={sideDrawerWidthMedium}
          >
            {#if children}
              {@render children()}
            {/if}
          </SideDrawer>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Portal container - invisible wrapper */
  .portal-container {
    display: contents;
  }

  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background: var(--backdrop-overlay);
    backdrop-filter: blur(4px);
    z-index: 200;
  }
</style>
