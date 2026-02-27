<script lang="ts">
  import type { Snippet } from 'svelte';
  import { browser } from '$app/environment';
  import ChartPill from './ChartPill.svelte';
  import ChartDropdown from './ChartDropdown.svelte';

  interface ChartToggleOption<T = string> {
    value: T;
    label?: string;
    icon?: Snippet;
    ariaLabel?: string;
  }

  interface Props<T = string> {
    options: ChartToggleOption<T>[];
    value: T;
    onValueChange?: (value: T) => void;
    ariaLabel?: string;
    /** Enable responsive mode - renders as dropdown on mobile (default: true) */
    responsive?: boolean;
  }

  const MOBILE_BREAKPOINT = 768;

  let {
    options,
    value = $bindable(),
    onValueChange,
    ariaLabel = 'Toggle group',
    responsive = true,
  }: Props = $props();

  // Track viewport width for responsive behavior
  let innerWidth = $state(browser ? window.innerWidth : 1024);
  let isMobile = $derived(responsive && innerWidth < MOBILE_BREAKPOINT);

  $effect(() => {
    if (!browser || !responsive) return;

    const handleResize = () => {
      innerWidth = window.innerWidth;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  function handleClick(optionValue: typeof value) {
    value = optionValue;
    onValueChange?.(optionValue);
  }

  // Get label for current value (for dropdown display)
  const currentLabel = $derived.by(() => {
    const selected = options.find(o => o.value === value);
    return selected?.label ?? selected?.ariaLabel ?? String(value);
  });

  // Convert options to dropdown format
  const dropdownOptions = $derived(
    options.map(o => ({
      value: o.value as string,
      label: o.label ?? o.ariaLabel ?? String(o.value),
    }))
  );
</script>

{#if isMobile}
  <!-- Mobile: Render as dropdown -->
  <ChartDropdown
    options={dropdownOptions}
    bind:value
    onValueChange={onValueChange}
    ariaLabel={ariaLabel}
  />
{:else}
  <!-- Desktop: Render as segmented control -->
  <div
    class="segmented-control"
    role="radiogroup"
    aria-label={ariaLabel}
  >
    {#each options as option}
      <ChartPill
        active={value === option.value}
        icon={option.icon}
        label={option.icon ? undefined : option.label}
        ariaLabel={option.ariaLabel ?? option.label}
        onclick={() => handleClick(option.value)}
      />
    {/each}
  </div>
{/if}

<style>
  .segmented-control {
    display: inline-flex;
    align-items: center;
    height: 34px;
    padding: 4px;
    gap: 4px;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: transparent;
  }

  /* Override ChartPill height inside segmented control */
  .segmented-control :global(.chart-pill) {
    height: 24px;
    padding: 0 8px;
  }
</style>
