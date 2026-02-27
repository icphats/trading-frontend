<script lang="ts">
  import type { Snippet } from "svelte";
  import type { MouseEventHandler } from "svelte/elements";

  export type ButtonVariant = "primary" | "secondary" | "danger";

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
    class?: string;
    onclick?: MouseEventHandler<HTMLButtonElement>;
    children: Snippet;
  }

  const {
    variant = "primary",
    size = "md",
    type = "button",
    disabled = false,
    loading = false,
    fullWidth = false,
    elevated = false,
    testId,
    ariaLabel,
    class: customClass = "",
    onclick,
    children,
  }: Props = $props();
</script>

<button
  class={`btn btn-${size} v-${variant} ${customClass}`}
  class:btn-loading={loading}
  class:btn-elevated={elevated}
  class:w-full={fullWidth}
  aria-label={ariaLabel}
  data-tid={testId}
  disabled={disabled || loading}
  {onclick}
  {type}
>
  <span class="btn-content" class:invisible={loading}>
    {@render children()}
  </span>
  {#if loading}
    <span class="btn-spinner" aria-hidden="true">
      <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    </span>
  {/if}
</button>

<style>
  /* ── Base ── */
  .btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-sans);
    font-weight: 500;
    border-radius: 6px;
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

  /* ── Sizes ── */
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
    min-width: 1.75rem;
  }

  /* ── Hierarchy Variants (all opaque) ── */

  /* Primary — solid branded purple, white text */
  .v-primary {
    background: var(--primary);
    color: #fff;
  }
  .v-primary:hover:not(:disabled) {
    background: oklch(from var(--primary) calc(l + 0.08) c h);
  }

  /* Secondary — neutral, visible on all surfaces */
  .v-secondary {
    background: var(--btn-secondary-bg);
    color: var(--foreground);
  }
  .v-secondary:hover:not(:disabled) {
    background: var(--btn-secondary-bg-hover);
  }

  /* Danger — solid red, white text, destructive counterpart to primary */
  .v-danger {
    background: var(--color-bearish);
    color: #fff;
  }
  .v-danger:hover:not(:disabled) {
    background: oklch(from var(--color-bearish) calc(l + 0.08) c h);
  }

  /* ── Loading ── */
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

  /* ── Width modifier ── */
  .w-full {
    width: 100%;
  }

  /* ── Elevated shadow ── */
  .btn-elevated {
    box-shadow: var(--shadow-elevated);
  }

  /* ── Numeric content ── */
  .btn :global(.numeric) {
    font-family: var(--font-numeric);
    font-weight: var(--font-weight-price);
  }
</style>
