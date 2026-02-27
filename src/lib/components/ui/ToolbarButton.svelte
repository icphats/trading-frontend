<script lang="ts">
  import type { Snippet } from "svelte";
  import type { MouseEventHandler } from "svelte/elements";

  interface Props {
    onclick?: MouseEventHandler<HTMLButtonElement>;
    ariaLabel?: string;
    disabled?: boolean;
    class?: string;
    children: Snippet;
  }

  const {
    onclick,
    ariaLabel,
    disabled = false,
    class: customClass = "",
    children,
  }: Props = $props();
</script>

<button
  class="toolbar-btn {customClass}"
  {onclick}
  {disabled}
  aria-label={ariaLabel}
>
  {@render children()}
</button>

<style>
  .toolbar-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--foreground);
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition:
      border-color 200ms ease-out,
      box-shadow 200ms ease-out;
    user-select: none;
  }

  .toolbar-btn:hover:not(:disabled) {
    border-color: oklch(from var(--border) l c h / 0.55);
    box-shadow: 0 0 8px oklch(from var(--border) l c h / 0.15);
  }

  .toolbar-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 767px) {
    .toolbar-btn {
      padding: 0.3rem 0.4rem;
      font-size: 0.6875rem;
    }
  }
</style>
