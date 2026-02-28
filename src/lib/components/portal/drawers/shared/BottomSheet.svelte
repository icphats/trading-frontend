<script lang="ts">
  /**
   * BottomSheet - Reusable mobile bottom sheet with drag-to-dismiss
   *
   * Features:
   * - Drag-to-dismiss with threshold and velocity detection
   * - Touch and mouse support
   * - Smooth snap-back animation
   * - Configurable close thresholds
   *
   * Usage:
   * ```svelte
   * <BottomSheet
   *   open={isOpen}
   *   onClose={() => isOpen = false}
   * >
   *   <div>Content here</div>
   * </BottomSheet>
   * ```
   */

  import { fly } from "svelte/transition";
  import { cubicOut, quintOut } from "svelte/easing";

  interface Props {
    /** Whether the sheet is open */
    open: boolean;
    /** Called when the sheet should close */
    onClose: () => void;
    /** Content to render inside the sheet */
    children?: any;
    /** Max height as CSS value (default: 90vh) */
    maxHeight?: string;
    /** Percentage of sheet height to drag before closing (default: 0.3 = 30%) */
    closeThreshold?: number;
    /** Velocity threshold for fast swipe close in px/ms (default: 0.5) */
    velocityThreshold?: number;
    /** Whether to show the drag handle (default: true) */
    showHandle?: boolean;
    /** Additional class for the sheet container */
    class?: string;
  }

  let {
    open,
    onClose,
    children,
    maxHeight = "90vh",
    closeThreshold = 0.3,
    velocityThreshold = 0.5,
    showHandle = true,
    class: className = "",
  }: Props = $props();

  // Drag state
  let isDragging = $state(false);
  let dragStartY = $state(0);
  let dragStartTime = $state(0);
  let dragCurrentY = $state(0);
  let sheetHeight = $state(0);
  let sheetEl = $state<HTMLDivElement | null>(null);

  // Calculate drag offset (only allow dragging down, not up)
  let dragOffset = $derived(isDragging ? Math.max(0, dragCurrentY - dragStartY) : 0);

  // ============================================
  // Drag-to-dismiss handlers
  // ============================================

  function getEventY(e: MouseEvent | TouchEvent): number {
    if ('touches' in e) {
      return e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY ?? 0;
    }
    return e.clientY;
  }

  function handleDragStart(e: MouseEvent | TouchEvent) {
    // Only handle primary button for mouse
    if ('button' in e && e.button !== 0) return;

    isDragging = true;
    dragStartY = getEventY(e);
    dragCurrentY = dragStartY;
    dragStartTime = Date.now();

    // Capture sheet height for threshold calculation
    if (sheetEl) {
      sheetHeight = sheetEl.offsetHeight;
    }

    // Add move/end listeners to window for better tracking
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
  }

  function handleDragMove(e: MouseEvent | TouchEvent) {
    if (!isDragging) return;

    // Prevent scrolling while dragging
    e.preventDefault();

    dragCurrentY = getEventY(e);
  }

  function handleDragEnd(e: MouseEvent | TouchEvent) {
    if (!isDragging) return;

    // Calculate velocity (px/ms)
    const dragDuration = Date.now() - dragStartTime;
    const dragDistance = dragCurrentY - dragStartY;
    const velocity = dragDuration > 0 ? dragDistance / dragDuration : 0;

    // Determine if we should close
    const pastThreshold = sheetHeight > 0 && dragDistance > sheetHeight * closeThreshold;
    const fastSwipe = velocity > velocityThreshold && dragDistance > 50;

    // Clean up
    isDragging = false;
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
    window.removeEventListener('touchmove', handleDragMove);
    window.removeEventListener('touchend', handleDragEnd);

    if (pastThreshold || fastSwipe) {
      onClose();
    }

    // Reset drag state
    dragStartY = 0;
    dragCurrentY = 0;
    dragStartTime = 0;
  }
</script>

{#if open}
  <div
    bind:this={sheetEl}
    class="bottom-sheet {className}"
    class:dragging={isDragging}
    style:max-height={maxHeight}
    style:transform={dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined}
    role="dialog"
    aria-modal="true"
    in:fly={{ y: '100%', duration: 300, easing: quintOut }}
    out:fly={{ y: '100%', duration: 200, easing: cubicOut }}
  >
    {#if showHandle}
      <!-- Drag handle -->
      <div
        class="bottom-sheet-handle"
        class:dragging={isDragging}
        onmousedown={handleDragStart}
        ontouchstart={handleDragStart}
        role="slider"
        aria-label="Drag to dismiss"
        aria-valuenow={dragOffset}
        tabindex="0"
      >
        <div class="handle-bar"></div>
      </div>
    {/if}

    <div class="bottom-sheet-content">
      {#if children}
        {@render children()}
      {/if}
    </div>
  </div>
{/if}

<style>
  .bottom-sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--background);
    border-top-left-radius: var(--radius-xl);
    border-top-right-radius: var(--radius-xl);
    border: 1px solid var(--border);
    border-bottom: none;
    box-shadow: var(--shadow-2xl);
    display: flex;
    flex-direction: column;
    /* Allow content to scroll, but clip rounded corners */
    overflow: hidden;
    /* Smooth snap-back when not dragging */
    transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1);
    /* CRITICAL: Prevent flex items from exceeding container */
    min-height: 0;
  }

  /* Disable transition during drag for immediate feedback */
  .bottom-sheet.dragging {
    transition: none;
  }

  .bottom-sheet-handle {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 8px 0;
    flex-shrink: 0;
    cursor: grab;
    touch-action: none;
    user-select: none;
    width: 100%;
  }

  .bottom-sheet-handle:active {
    cursor: grabbing;
  }

  .handle-bar {
    width: 32px;
    height: 4px;
    background: var(--muted-foreground);
    border-radius: 9999px;
    opacity: 0.5;
    transition: opacity 0.15s ease, background-color 0.15s ease;
  }

  .bottom-sheet-handle:hover .handle-bar {
    opacity: 0.7;
  }

  .bottom-sheet-handle:active .handle-bar,
  .bottom-sheet-handle.dragging .handle-bar {
    opacity: 1;
    background: var(--foreground);
  }

  .bottom-sheet-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain; /* Prevent scroll chaining to body */
    min-height: 0; /* CRITICAL: Required for flex children to scroll */
  }

  /* Custom scrollbar */
  .bottom-sheet-content::-webkit-scrollbar {
    width: 6px;
  }

  .bottom-sheet-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .bottom-sheet-content::-webkit-scrollbar-thumb {
    background: var(--muted-foreground);
    border-radius: 3px;
    opacity: 0.3;
  }
</style>
