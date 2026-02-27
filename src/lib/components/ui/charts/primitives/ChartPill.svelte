<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Whether this pill is currently active/selected */
    active?: boolean;
    /** Icon snippet (optional) */
    icon?: Snippet;
    /** Label text (optional) */
    label?: string;
    /** Click handler */
    onclick?: () => void;
    /** Aria label for accessibility */
    ariaLabel?: string;
    /** HTML button type */
    type?: 'button' | 'submit' | 'reset';
    /** Additional CSS class */
    class?: string;
  }

  let {
    active = false,
    icon,
    label,
    onclick,
    ariaLabel,
    type = 'button',
    class: customClass = '',
  }: Props = $props();
</script>

<button
  {type}
  class="chart-pill {customClass}"
  class:active
  aria-label={ariaLabel ?? label}
  aria-pressed={active}
  {onclick}
>
  {#if icon}
    {@render icon()}
  {/if}
  {#if label}
    <span class="pill-label">{label}</span>
  {/if}
</button>

<style>
  .chart-pill {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 34px;
    padding: 0 12px;
    background: transparent;
    border: none;
    border-radius: 20px;
    color: var(--muted-foreground);
    cursor: pointer;
    transition: all 100ms ease-out;
    font-family: 'Basel', sans-serif;
    font-size: 14px;
    font-weight: 535;
    white-space: nowrap;
    user-select: none;
  }

  .chart-pill:hover {
    color: var(--foreground);
  }

  .chart-pill.active {
    color: var(--foreground);
    background: var(--control-active);
  }

  .chart-pill:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  .pill-label {
    line-height: 1;
  }
</style>
