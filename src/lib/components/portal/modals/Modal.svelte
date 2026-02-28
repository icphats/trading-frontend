<script lang="ts">
  /**
   * Modal Component
   *
   * Uses action-based portal pattern to preserve Svelte transitions.
   * The portal action moves DOM nodes while keeping them in Svelte's component tree,
   * allowing transitions to work correctly.
   */

  import { portal } from "$lib/components/portal/portal.action";
  import { focusTrap } from "./focusTrap";
  import { lockScroll, unlockScroll } from "./scroll-lock";
  import { modalState } from "$lib/state/portal/modal.state.svelte";
  import { fade, fly } from "svelte/transition";
  import { cubicOut, quintOut } from "svelte/easing";

  interface Props {
    open: boolean;
    onClose?: () => void;
    children?: any;
    title?: string;
    closeOnBackdrop?: boolean;
    closeOnEsc?: boolean;
    size?: "sm" | "md" | "lg" | "xl" | "full";
    headerBorder?: boolean;
    customClass?: string;
    showHeader?: boolean;
    /** Compact header styling (Uniswap-style) - tighter spacing */
    compactHeader?: boolean;
    /** Show back button in header (for multi-step flows) */
    showBack?: boolean;
    /** Callback when back button is clicked */
    onBack?: () => void;
    /** Add standard padding (p-4) to modal content area */
    contentPadding?: boolean;
  }

  let { open = $bindable(false), onClose, children, title, closeOnBackdrop = true, closeOnEsc = true, size = "md", headerBorder = true, customClass = "", showHeader = true, compactHeader = false, showBack = false, onBack, contentPadding = true }: Props = $props();

  const modalId = crypto.randomUUID();

  function handleClose() {
    open = false;
    onClose?.();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      handleClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (closeOnEsc && e.key === "Escape") {
      handleClose();
    }
  }

  // Register/unregister modal with portal (runs once on mount)
  $effect(() => {
    if (open) {
      modalState.open({
        id: modalId,
        title,
        // Don't pass onClose to portal - we handle close events ourselves
      });
    } else {
      modalState.close(modalId);
    }

    return () => {
      modalState.close(modalId);
    };
  });

  // Handle scroll lock and keyboard separately (also runs when open changes)
  $effect(() => {
    if (open) {
      lockScroll();
      document.addEventListener("keydown", handleKeydown);
    }

    return () => {
      unlockScroll();
      document.removeEventListener("keydown", handleKeydown);
    };
  });

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-full mx-4",
  };

  // Get dynamic z-index from portal state
  const currentLayer = $derived(modalState.getLayer(modalId));
  const zIndex = $derived(currentLayer?.zIndex || 200);
</script>

{#if open}
  <!--
    The portal action moves this div to #portal-root while keeping it in Svelte's
    component tree. This allows transitions to work correctly.
  -->
  <div use:portal={'#portal-root'} class="portal-container">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-2"
      style="background: var(--backdrop-overlay); z-index: {zIndex};"
      onclick={handleBackdropClick}
      onkeydown={(e) => e.key === 'Enter' && handleBackdropClick(e as unknown as MouseEvent)}
      role="button"
      tabindex="-1"
      aria-label="Close modal"
      transition:fade={{ duration: 200, easing: cubicOut }}
    >
      <!-- Modal Content -->
      <div
        class="rounded-[var(--radius-lg)] w-full flex flex-col {sizeClasses[size]} {customClass}"
        style="background: var(--background); border: 1px solid var(--border); box-shadow: var(--shadow-2xl); max-height: 70vh;"
        use:focusTrap
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        in:fly={{ y: 20, opacity: 0, duration: 300, easing: quintOut }}
        out:fly={{ y: 10, duration: 150, easing: cubicOut }}
      >
        {#if showHeader && title}
          <div class="modal-header {compactHeader ? 'modal-header-compact' : 'modal-header-default'} {headerBorder ? 'border-b border-border' : ''}">
            <!-- Back button or spacer -->
            {#if showBack && onBack}
              <button onclick={onBack} class="modal-back-btn {compactHeader ? 'modal-btn-compact' : ''}" aria-label="Go back">
                <svg width={compactHeader ? 24 : 20} height={compactHeader ? 24 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            {:else}
              <div class="modal-header-spacer"></div>
            {/if}

            <h2 id="modal-title" class="modal-title {compactHeader ? 'modal-title-compact' : ''}">{title}</h2>

            <button onclick={handleClose} class="modal-close-btn {compactHeader ? 'modal-btn-compact' : ''}" aria-label="Close modal">
              <svg width={compactHeader ? 24 : 20} height={compactHeader ? 24 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        {/if}

        <div class="text-card-foreground flex-1 overflow-auto {contentPadding ? 'p-4' : ''}">
          {#if children}
            {@render children()}
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Portal container - invisible wrapper */
  .portal-container {
    display: contents;
  }

  /* Modal Header - Base */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  /* Header spacer (when no back button) */
  .modal-header-spacer {
    width: 32px;
  }

  /* Default header (legacy) */
  .modal-header-default {
    padding: 0.5rem 1rem;
  }

  /* Compact header (Uniswap-style) */
  .modal-header-compact {
    padding: 1rem 1rem 0.75rem 1rem;
  }

  /* Modal Title - Base */
  .modal-title {
    color: var(--card-foreground);
    margin: 0;
  }

  /* Default title */
  .modal-header-default .modal-title {
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1.5;
  }

  /* Compact title (Uniswap subheading1 style: 18px/24px, book weight) */
  .modal-title-compact {
    font-size: 1.125rem;
    font-weight: 400;
    line-height: 1.5rem;
  }

  /* Modal Header Buttons - Base */
  .modal-close-btn,
  .modal-back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--muted-foreground);
    transition: color 150ms ease, background-color 150ms ease;
    border-radius: 0.375rem;
  }

  .modal-close-btn:hover,
  .modal-back-btn:hover {
    color: var(--card-foreground);
    background-color: var(--hover-overlay);
  }

  /* Default button size */
  .modal-header-default .modal-close-btn,
  .modal-header-default .modal-back-btn {
    padding: 0.25rem;
  }

  /* Compact button size (Uniswap-style) */
  .modal-btn-compact {
    padding: 0.375rem;
    border-radius: 0.5rem;
  }

  .modal-btn-compact:hover {
    background-color: var(--muted);
  }

  /* ============================================
   * Shared Modal Content Classes
   * Use :global() to make available to child components
   * ============================================ */

  /* Base modal body - standard padding and flex layout */
  :global(.modal-body) {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* Search-list modal body - search input + scrollable list, no gap */
  :global(.modal-search-body) {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
  }

  /* Scrollable list area inside search-list modals */
  :global(.modal-search-list) {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.25rem 0;
  }

  :global(.modal-search-list)::-webkit-scrollbar {
    width: 4px;
  }

  :global(.modal-search-list)::-webkit-scrollbar-track {
    background: transparent;
  }

  :global(.modal-search-list)::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 2px;
  }

  :global(.modal-search-list)::-webkit-scrollbar-thumb:hover {
    background: var(--muted-foreground);
  }

  /* State containers for loading/error states */
  :global(.modal-state) {
    padding: 2rem 1rem;
    text-align: center;
  }

  :global(.modal-state-text) {
    font-size: 0.875rem;
    color: var(--muted-foreground);
    margin: 0;
  }

  :global(.modal-state-text.error) {
    color: var(--destructive);
  }

  /* Form section with label */
  :global(.modal-form-section) {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  :global(.modal-form-label) {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--foreground);
  }

  /* Details section with title */
  :global(.modal-details) {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  :global(.modal-details-title) {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
    margin: 0;
    padding: 0 1rem;
  }

  /* Panel with border outline (for grouped content) */
  :global(.modal-panel) {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* Detail rows (label + value) */
  :global(.modal-detail-row) {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  :global(.modal-detail-label) {
    font-size: 0.8125rem;
    color: var(--muted-foreground);
  }

  :global(.modal-detail-value) {
    font-size: 0.8125rem;
    font-weight: 500;
    font-family: var(--font-mono);
    color: var(--foreground);
  }

  /* Info banner (informational callout) */
  :global(.modal-info-banner) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: oklch(from var(--primary) l c h / 0.1);
    border: 1px solid oklch(from var(--primary) l c h / 0.2);
    border-radius: var(--radius-md);
    font-size: 0.75rem;
    color: var(--foreground);
  }

  :global(.modal-info-icon) {
    flex-shrink: 0;
    color: var(--primary);
  }

  /* Error callout */
  :global(.modal-error) {
    padding: 0.75rem;
    background: oklch(from var(--destructive) l c h / 0.1);
    border: 1px solid var(--destructive);
    border-radius: var(--radius-sm);
    text-align: center;
  }

  :global(.modal-error p) {
    margin: 0;
    font-size: 0.75rem;
    color: var(--destructive);
  }

  /* Action buttons row */
  :global(.modal-actions) {
    display: flex;
    gap: 0.5rem;
    padding-top: 0.5rem;
  }

  /* Separator line */
  :global(.modal-separator) {
    border: none;
    border-top: 1px solid var(--border);
    margin: 0.5rem 0;
  }

  /* Empty state */
  :global(.modal-empty) {
    padding: 2rem;
    text-align: center;
  }

  :global(.modal-empty p) {
    color: var(--muted-foreground);
    font-size: 0.875rem;
    margin: 0;
  }

  /* Success state */
  :global(.modal-success) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem 1rem;
  }

  :global(.modal-success-icon) {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: oklch(from var(--color-connected) l c h / 0.15);
    color: var(--color-connected);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: bold;
  }

  :global(.modal-success-title) {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
    color: var(--color-connected);
  }
</style>
