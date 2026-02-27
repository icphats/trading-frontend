<script lang="ts">
  import type { Snippet } from "svelte";
  import type { MouseEventHandler } from "svelte/elements";

  export type ButtonVariant =
    | "green"
    | "red"
    | "blue"
    | "cyan"
    | "orange"
    | "purple"
    | "gray"
    | "yellow"
    | "pink";

  type ButtonSize = "sm" | "md" | "lg" | "xl" | "icon";

  interface Props {
    variant?: ButtonVariant;
    size?: ButtonSize;
    type?: "submit" | "reset" | "button";
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
    elevated?: boolean;
    testId?: string;
    ariaLabel?: string;
    class?: string; // For custom overrides
    onclick?: MouseEventHandler<HTMLButtonElement>;
    children: Snippet;
  }

  const { variant = "purple", size = "md", type = "button", disabled = false, loading = false, fullWidth = false, elevated = false, testId, ariaLabel, class: customClass = "", onclick, children }: Props = $props();
</script>

<button class={`btn btn-${variant} btn-${size} ${customClass}`} class:btn-loading={loading} class:btn-elevated={elevated} class:w-full={fullWidth} aria-label={ariaLabel} data-tid={testId} disabled={disabled || loading} {onclick} {type}>
  <span class="btn-content" class:invisible={loading}>
    {@render children()}
  </span>
  {#if loading}
    <span class="btn-spinner" aria-hidden="true">
      <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </span>
  {/if}
</button>

<style>
  /* Base button styles */
  .btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-sans);
    font-weight: 500;
    border-radius: var(--radius-md);
    transition: all var(--transition-price);
    outline: none;
    border: none;
    cursor: pointer;
  }

  .btn:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Size variants */
  .btn-sm {
    padding: var(--spacing-ticker) calc(var(--spacing-ticker) * 3);
    font-size: var(--font-size-orderbook);
  }

  .btn-md {
    padding: var(--spacing-table-cell) calc(var(--spacing-table-cell) * 2.5);
    font-size: 1rem;
  }

  .btn-lg {
    padding: calc(var(--spacing-table-cell) * 1.5) calc(var(--spacing-table-cell) * 3);
    font-size: 1.125rem;
  }

  .btn-xl {
    padding: 0.875rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    min-width: 120px;
    height: 48px;
  }

  .btn-icon {
    padding: 0.375rem;
    aspect-ratio: 1;
    min-width: 1.75rem; /* 28px */
  }

  /* Color variants - translucent pattern */
  .btn-green {
    background-color: oklch(from var(--color-green) l c h / 0.15);
    color: var(--color-green);
  }
  .btn-green:hover:not(:disabled) {
    background-color: oklch(from var(--color-green) l c h / 0.25);
  }

  .btn-red {
    background-color: oklch(from var(--color-red) l c h / 0.15);
    color: var(--color-red);
  }
  .btn-red:hover:not(:disabled) {
    background-color: oklch(from var(--color-red) l c h / 0.25);
  }

  .btn-blue {
    background-color: oklch(from var(--color-blue) l c h / 0.15);
    color: var(--color-blue);
  }
  .btn-blue:hover:not(:disabled) {
    background-color: oklch(from var(--color-blue) l c h / 0.25);
  }

  .btn-cyan {
    background-color: oklch(from var(--color-cyan) l c h / 0.15);
    color: var(--color-cyan);
  }
  .btn-cyan:hover:not(:disabled) {
    background-color: oklch(from var(--color-cyan) l c h / 0.25);
  }

  .btn-orange {
    background-color: oklch(from var(--color-orange) l c h / 0.15);
    color: var(--color-orange);
  }
  .btn-orange:hover:not(:disabled) {
    background-color: oklch(from var(--color-orange) l c h / 0.25);
  }

  .btn-purple {
    background-color: oklch(from var(--color-purple) l c h / 0.15);
    color: var(--color-purple);
  }
  .btn-purple:hover:not(:disabled) {
    background-color: oklch(from var(--color-purple) l c h / 0.25);
  }

  .btn-gray {
    background-color: oklch(from var(--color-gray) l c h / 0.15);
    color: var(--foreground);
  }
  .btn-gray:hover:not(:disabled) {
    background-color: oklch(from var(--color-gray) l c h / 0.25);
  }

  .btn-yellow {
    background-color: oklch(from var(--color-yellow) l c h / 0.15);
    color: var(--color-yellow);
  }
  .btn-yellow:hover:not(:disabled) {
    background-color: oklch(from var(--color-yellow) l c h / 0.25);
  }

  .btn-pink {
    background-color: oklch(from var(--color-pink) l c h / 0.15);
    color: var(--color-pink);
  }
  .btn-pink:hover:not(:disabled) {
    background-color: oklch(from var(--color-pink) l c h / 0.25);
  }

  /* Loading state */
  .btn-loading {
    cursor: wait;
  }

  .btn-content {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-spinner {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Width modifier */
  .w-full {
    width: 100%;
  }

  /* Elevated shadow */
  .btn-elevated {
    box-shadow: var(--shadow-elevated);
  }

  /* Ensure numeric content uses monospace font */
  .btn :global(.numeric) {
    font-family: var(--font-numeric);
    font-weight: var(--font-weight-price);
  }
</style>
