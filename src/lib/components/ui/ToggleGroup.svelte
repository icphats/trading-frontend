<script lang="ts">
  import type { Snippet } from "svelte";
  import Logo from '$lib/components/ui/Logo.svelte';

  export type ToggleOption<T = string> = {
    value: T;
    label: string;
    /** Whether to show an icon/logo before the label (enables fallback icon when src is undefined) */
    showIcon?: boolean;
    /** Optional icon/logo URL - when undefined and showIcon is true, shows fallback icon */
    icon?: string;
    variant?: 'green' | 'red' | 'blue' | 'cyan' | 'orange' | 'purple' | 'gray' | 'yellow' | 'pink' | 'default';
    disabled?: boolean;
  };

  interface Props<T = string> {
    options: ToggleOption<T>[];
    value: T;
    onValueChange: (value: T) => void;
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    disabled?: boolean;
    class?: string;
    ariaLabel?: string;
  }

  let {
    options,
    value = $bindable(),
    onValueChange,
    size = 'md',
    fullWidth = false,
    disabled = false,
    class: customClass = '',
    ariaLabel = 'Toggle group'
  }: Props = $props();

  let containerRef: HTMLDivElement;

  // Calculate active index and variant
  const activeIndex = $derived(options.findIndex(opt => opt.value === value));
  const activeVariant = $derived(options[activeIndex]?.variant || 'default');

  // Update CSS custom properties for sliding background
  $effect(() => {
    if (containerRef && activeIndex >= 0) {
      const buttons = containerRef.querySelectorAll('button');
      const activeButton = buttons[activeIndex] as HTMLElement;

      if (activeButton) {
        const containerRect = containerRef.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();
        const offsetLeft = buttonRect.left - containerRect.left;
        const width = buttonRect.width;

        containerRef.style.setProperty('--slider-left', `${offsetLeft}px`);
        containerRef.style.setProperty('--slider-width', `${width}px`);
      }
    }
  });

  function handleClick(optionValue: typeof value) {
    if (!disabled) {
      value = optionValue;
      onValueChange?.(optionValue);
    }
  }

  function handleKeyDown(event: KeyboardEvent, index: number) {
    if (disabled) return;

    let newIndex = index;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        newIndex = index - 1;
        if (newIndex < 0) newIndex = options.length - 1;
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        newIndex = index + 1;
        if (newIndex >= options.length) newIndex = 0;
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = options.length - 1;
        break;
      default:
        return;
    }

    // Find next non-disabled option
    let attempts = 0;
    while (options[newIndex].disabled && attempts < options.length) {
      newIndex = (newIndex + 1) % options.length;
      attempts++;
    }

    if (!options[newIndex].disabled) {
      handleClick(options[newIndex].value);
      // Focus the new button
      const target = event.currentTarget as HTMLElement | null;
      const buttons = target?.parentElement?.querySelectorAll('button');
      buttons?.[newIndex]?.focus();
    }
  }
</script>

<div
  bind:this={containerRef}
  class={`toggle-group toggle-group-${size} ${fullWidth ? 'w-full' : ''} ${customClass}`}
  data-active-variant={activeVariant}
  role="radiogroup"
  aria-label={ariaLabel}
>
  {#each options as option, index}
    <button
      type="button"
      class={`toggle-option toggle-option-${size}`}
      class:toggle-option-active={value === option.value}
      class:has-icon={option.showIcon}
      data-state={value === option.value ? 'active' : 'inactive'}
      data-variant={option.variant || 'default'}
      aria-checked={value === option.value}
      role="radio"
      disabled={disabled || option.disabled}
      onclick={() => handleClick(option.value)}
      onkeydown={(e) => handleKeyDown(e, index)}
      tabindex={value === option.value ? 0 : -1}
    >
      {#if option.showIcon}
        <Logo src={option.icon} alt={option.label} size="xxxs" />
      {/if}
      {option.label}
    </button>
  {/each}
</div>

<style>
  /* Base toggle group container */
  .toggle-group {
    display: inline-flex;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 4px;
    gap: 0;
    position: relative;
    isolation: isolate;
  }

  /* Sliding background indicator */
  .toggle-group::before {
    content: '';
    position: absolute;
    top: 4px;
    left: var(--slider-left, 4px);
    width: var(--slider-width, 0);
    height: calc(100% - 8px);
    background: var(--muted);
    border-radius: calc(var(--radius-lg) - 4px);
    transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 0;
    pointer-events: none;
  }

  /* Variant-specific background colors */
  .toggle-group[data-active-variant="green"]::before {
    background: oklch(from var(--color-green) l c h / 0.15);
  }

  .toggle-group[data-active-variant="red"]::before {
    background: oklch(from var(--color-red) l c h / 0.15);
  }

  .toggle-group[data-active-variant="blue"]::before {
    background: oklch(from var(--color-blue) l c h / 0.15);
  }

  .toggle-group[data-active-variant="cyan"]::before {
    background: oklch(from var(--color-cyan) l c h / 0.15);
  }

  .toggle-group[data-active-variant="orange"]::before {
    background: oklch(from var(--color-orange) l c h / 0.15);
  }

  .toggle-group[data-active-variant="purple"]::before {
    background: oklch(from var(--color-purple) l c h / 0.15);
  }

  .toggle-group[data-active-variant="gray"]::before {
    background: oklch(from var(--color-gray) l c h / 0.15);
  }

  .toggle-group[data-active-variant="yellow"]::before {
    background: oklch(from var(--color-yellow) l c h / 0.15);
  }

  .toggle-group[data-active-variant="pink"]::before {
    background: oklch(from var(--color-pink) l c h / 0.15);
  }

  .toggle-group.w-full {
    width: 100%;
  }

  /* Size variants for group */
  .toggle-group-sm {
    padding: 3px;
  }

  .toggle-group-sm::before {
    top: 3px;
    height: calc(100% - 6px);
  }

  .toggle-group-md {
    padding: 4px;
  }

  .toggle-group-md::before {
    top: 4px;
    height: calc(100% - 8px);
  }

  .toggle-group-lg {
    padding: 5px;
  }

  .toggle-group-lg::before {
    top: 5px;
    height: calc(100% - 10px);
  }

  /* Base toggle option */
  .toggle-option {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: var(--muted-foreground);
    border: none;
    border-radius: calc(var(--radius-lg) - 4px);
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    z-index: 1;
    outline: none;
    user-select: none;
  }

  /* Full width mode - options fill available space equally */
  .toggle-group.w-full .toggle-option {
    flex: 1;
  }

  /* Size variants for options */
  .toggle-option-sm {
    padding: var(--spacing-ticker) calc(var(--spacing-ticker) * 3);
    font-size: var(--font-size-orderbook);
    min-height: 1.75rem;
  }

  .toggle-option-md {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    min-height: 30px;
  }

  .toggle-option-lg {
    padding: calc(var(--spacing-table-cell) * 1.5) calc(var(--spacing-table-cell) * 3);
    font-size: 1rem;
    min-height: 2.75rem;
  }

  /* Active state - text color only (background handled by ::before) */
  .toggle-option[data-state="active"][data-variant="default"] {
    background: transparent;
    color: var(--foreground);
    z-index: 2;
  }

  .toggle-option[data-state="active"][data-variant="green"] {
    background: transparent;
    color: var(--color-green);
    z-index: 2;
  }

  .toggle-option[data-state="active"][data-variant="red"] {
    background: transparent;
    color: var(--color-red);
    z-index: 2;
  }

  .toggle-option[data-state="active"][data-variant="blue"] {
    background: transparent;
    color: var(--color-blue);
    z-index: 2;
  }

  .toggle-option[data-state="active"][data-variant="cyan"] {
    background: transparent;
    color: var(--color-cyan);
    z-index: 2;
  }

  .toggle-option[data-state="active"][data-variant="orange"] {
    background: transparent;
    color: var(--color-orange);
    z-index: 2;
  }

  .toggle-option[data-state="active"][data-variant="purple"] {
    background: transparent;
    color: var(--color-purple);
    z-index: 2;
  }

  .toggle-option[data-state="active"][data-variant="gray"] {
    background: transparent;
    color: var(--color-gray);
    z-index: 2;
  }

  .toggle-option[data-state="active"][data-variant="yellow"] {
    background: transparent;
    color: var(--color-yellow);
    z-index: 2;
  }

  .toggle-option[data-state="active"][data-variant="pink"] {
    background: transparent;
    color: var(--color-pink);
    z-index: 2;
  }

  /* Hover states */
  .toggle-option:hover:not([data-state="active"]):not(:disabled) {
    color: var(--foreground);
    background: oklch(from var(--muted) l c h / 0.5);
    z-index: 1;
  }

  /* Focus states */
  .toggle-option:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
    z-index: 3;
  }

  /* Disabled states */
  .toggle-option:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toggle-group:has(.toggle-option:disabled:not([data-state="active"])) {
    opacity: 0.8;
  }

  /* Add subtle pressed effect */
  .toggle-option:active:not(:disabled) {
    transform: scale(0.97);
    transition: transform 100ms ease;
  }

  /* Ensure text doesn't wrap */
  .toggle-option {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Icon styles - Logo component handles sizing internally */
  .toggle-option.has-icon {
    gap: 6px;
  }

  /* Dark mode adjustments handled automatically via CSS variables */
</style>