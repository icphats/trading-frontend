<script lang="ts">
  /**
   * Toast Component
   *
   * Purely presentational — lifecycle (auto-dismiss timers) is managed by ToastState.
   * Uses action-based portal pattern to preserve Svelte transitions.
   */

  import { portal } from '$lib/components/portal/portal.action';
  import type { Snippet } from 'svelte';
  import type { ToastData } from '$lib/state/portal/types';

  interface Props {
    message?: string;
    content?: Snippet;
    type?: 'info' | 'success' | 'warning' | 'error' | 'loading';
    duration?: number;
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
    zIndex?: number;
    onClose?: () => void;
    data?: ToastData;
    stackOffset?: number;
  }

  let {
    message,
    content,
    type = 'info',
    duration = 0,
    position = 'bottom-right',
    zIndex = 300,
    onClose,
    data,
    stackOffset = 0
  }: Props = $props();

  let progress = $state(100);

  // Derive background and border colors based on type + side context
  let bgColor = $derived.by(() => {
    if (type === 'error') return 'var(--color-bearish)';
    return 'var(--muted)';
  });

  let borderColor = $derived.by(() => {
    if (type === 'error') return 'var(--color-bearish)';
    if (type === 'success') return 'var(--color-bullish)';
    if (type === 'warning') return 'var(--color-warning)';
    if (type === 'info') return 'var(--primary)';
    return 'transparent'; // loading — transparent border reserves space, prevents shift on state change
  });

  // Text color: white on full-color bg (error only), foreground on muted
  let textColor = $derived(
    type === 'error' ? 'white' : 'var(--foreground)'
  );

  // Compute offset style based on position
  let offsetStyle = $derived.by(() => {
    if (!stackOffset) return '';
    if (position.startsWith('top')) {
      return `top: calc(1rem + ${stackOffset}px);`;
    }
    return `bottom: calc(1rem + ${stackOffset}px);`;
  });

  let positionClasses = $derived.by(() => {
    const base: Record<string, string> = {
      'top-right': 'right-4',
      'top-left': 'left-4',
      'bottom-right': 'right-4',
      'bottom-left': 'left-4',
      'top-center': 'left-1/2 -translate-x-1/2',
      'bottom-center': 'left-1/2 -translate-x-1/2'
    };
    // Default vertical position (when no stackOffset override)
    const vertical: Record<string, string> = {
      'top-right': 'top-4',
      'top-left': 'top-4',
      'bottom-right': 'bottom-4',
      'bottom-left': 'bottom-4',
      'top-center': 'top-4',
      'bottom-center': 'bottom-4'
    };
    // If stackOffset is set, the inline style handles vertical positioning
    if (stackOffset) return base[position] || 'right-4';
    return `${vertical[position] || 'bottom-4'} ${base[position] || 'right-4'}`;
  });

  // Progress bar animation only (visual, no dismiss logic)
  $effect(() => {
    if (duration > 0) {
      progress = 100;
      const startTime = Date.now();

      const interval = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        progress = Math.max(0, 100 - (elapsed / duration) * 100);
        if (progress <= 0) clearInterval(interval);
      }, 16);

      return () => clearInterval(interval);
    }
  });
</script>

<div use:portal={'#portal-root'} class="portal-container">
  <div
    class="toast-container fixed {positionClasses} min-w-64 max-w-md animate-slide-in overflow-hidden"
    style="z-index: {zIndex}; background-color: {bgColor}; border-radius: var(--radius-sm); box-shadow: var(--shadow-elevated); border: 1px solid {borderColor}; color: {textColor}; transition: top 0.3s ease, bottom 0.3s ease; {offsetStyle}"
    role="alert"
  >
    <div class="flex items-center gap-3 px-4 py-3">
      <div class="flex-1 flex items-center gap-3 min-w-0">
        {#if data?.type === 'order' && data.logo}
          <img src={data.logo} alt={data.symbol} class="order-logo" />
        {/if}
        {#if message}
          <p class="text-sm font-medium break-words">{message}</p>
        {:else if content}
          {@render content()}
        {/if}
      </div>
      {#if type === 'loading'}
        <div class="loading-spinner" style="border-color: color-mix(in srgb, {textColor} 30%, transparent); border-top-color: {textColor};"></div>
      {:else}
        <button
          onclick={() => onClose?.()}
          class="toast-close-btn"
          style="transition: color var(--transition-hover);"
          aria-label="Close"
        >
          x
        </button>
      {/if}
    </div>

    {#if duration > 0}
      <div
        class="timer-fill"
        style="width: {progress}%; background-color: {borderColor};"
      ></div>
    {/if}
  </div>
</div>

<style>
  /* Portal container - invisible wrapper */
  .portal-container {
    display: contents;
  }

  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateY(-1rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .animate-slide-in {
    animation: slide-in var(--transition-hover) ease-out;
  }

  .loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    flex-shrink: 0;
  }

  .timer-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    opacity: 0.1;
    pointer-events: none;
    transition: width 100ms linear;
  }

  .toast-close-btn {
    flex-shrink: 0;
    opacity: 0.6;
  }

  .toast-close-btn:hover {
    opacity: 1;
  }

  .order-logo {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>
