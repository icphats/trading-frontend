<script lang="ts">
  /**
   * Drawer Component
   *
   * Uses action-based portal pattern to preserve Svelte transitions.
   * The portal action moves DOM nodes while keeping them in Svelte's component tree,
   * allowing transitions to work correctly.
   */

  import { portal } from "$lib/components/portal/portal.action";
  import { focusTrap } from "../modals/focusTrap";
  import { lockScroll, unlockScroll } from "../modals/scroll-lock";
  import { drawerState } from "$lib/state/portal/drawer.state.svelte";
  import { fade, fly } from "svelte/transition";
  import { cubicOut, quintOut } from "svelte/easing";

  interface Props {
    open: boolean;
    onClose?: () => void;
    children?: any;
    title?: string;
    closeOnBackdrop?: boolean;
    closeOnEsc?: boolean;
    position?: "left" | "right";
    size?: "sm" | "md" | "lg" | "xl";
    showHeader?: boolean;
    customClass?: string;
  }

  let {
    open = $bindable(false),
    onClose,
    children,
    title,
    closeOnBackdrop = true,
    closeOnEsc = true,
    position = "right",
    size = "md",
    showHeader = true,
    customClass = "",
  }: Props = $props();

  const drawerId = crypto.randomUUID();

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

  // Register/unregister drawer with portal
  $effect(() => {
    if (open) {
      drawerState.open({
        id: drawerId,
        title,
        position,
      });
    } else {
      drawerState.close(drawerId);
    }

    return () => {
      drawerState.close(drawerId);
    };
  });

  // Handle scroll lock and keyboard
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
    sm: "max-w-xs",
    md: "max-w-sm",
    lg: "max-w-md",
    xl: "max-w-lg",
  };

  const currentLayer = $derived(drawerState.getLayer(drawerId));
  const zIndex = $derived(currentLayer?.zIndex || 250);

  const flyParams = $derived(
    position === "right"
      ? { x: "100%", duration: 300, easing: quintOut }
      : { x: "-100%", duration: 300, easing: quintOut }
  );
</script>

{#if open}
  <!--
    The portal action moves this div to #portal-root while keeping it in Svelte's
    component tree. This allows transitions to work correctly.
  -->
  <div use:portal={'#portal-root'} class="portal-container">
    <!-- Backdrop -->
    <div
      class="drawer-backdrop"
      style="z-index: {zIndex};"
      onclick={handleBackdropClick}
      onkeydown={(e) => e.key === 'Enter' && handleBackdropClick(e as unknown as MouseEvent)}
      role="button"
      tabindex="-1"
      aria-label="Close drawer"
      transition:fade={{ duration: 200, easing: cubicOut }}
    >
      <!-- Drawer Panel -->
      <div
        class="drawer-panel {position} {sizeClasses[size]} {customClass}"
        use:focusTrap
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "drawer-title" : undefined}
        in:fly={flyParams}
        out:fly={{ ...flyParams, duration: 200, easing: cubicOut }}
      >
        {#if showHeader && title}
          <div class="drawer-header">
            <h2 id="drawer-title" class="drawer-title">{title}</h2>
            <button
              onclick={handleClose}
              class="drawer-close-btn"
              aria-label="Close drawer"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        {/if}

        <div class="drawer-content">
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

  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background: var(--backdrop-overlay);
    backdrop-filter: blur(4px);
    display: flex;
  }

  .drawer-panel {
    position: fixed;
    top: 0;
    bottom: 0;
    width: 100%;
    background: var(--background);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-2xl);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .drawer-panel.right {
    right: 0;
    border-left: 1px solid var(--border);
    border-right: none;
    border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  }

  .drawer-panel.left {
    left: 0;
    border-right: 1px solid var(--border);
    border-left: none;
    border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .drawer-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--foreground);
    margin: 0;
  }

  .drawer-close-btn {
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
    border-radius: var(--radius-sm);
  }

  .drawer-close-btn:hover {
    color: var(--foreground);
    background-color: var(--hover-overlay);
  }

  .drawer-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* Global drawer utilities */
  :global(.drawer-body) {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  :global(.drawer-section) {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  :global(.drawer-section-title) {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
  }
</style>
