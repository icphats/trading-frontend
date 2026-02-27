<script lang="ts" generics="T extends string">
  interface ChartDropdownOption<T> {
    value: T;
    label: string;
    disabled?: boolean;
  }

  interface Props {
    options: ChartDropdownOption<T>[];
    /** For single-select: the selected value */
    value?: T;
    /** For multi-select: array of selected values */
    values?: T[];
    /** For single-select: called when value changes */
    onValueChange?: (value: T) => void;
    /** For multi-select: called when a value is toggled */
    onToggle?: (value: T) => void;
    /** Enable multi-select mode (default: false) */
    multiSelect?: boolean;
    /** Label text for the trigger button */
    label?: string;
    /** Aria label for accessibility */
    ariaLabel?: string;
  }

  let {
    options,
    value = $bindable(),
    values = [],
    onValueChange,
    onToggle,
    multiSelect = false,
    label,
    ariaLabel = 'Select options'
  }: Props = $props();

  let open = $state(false);
  let wrapperEl: HTMLDivElement;

  // Derive display label from selected value (for single-select without explicit label)
  const displayLabel = $derived.by(() => {
    if (label) return label;
    if (!multiSelect && value) {
      const selected = options.find(o => o.value === value);
      return selected?.label ?? 'Select';
    }
    return 'Select';
  });

  function toggle() {
    open = !open;
  }

  function isSelected(optionValue: T): boolean {
    if (multiSelect) {
      return values.includes(optionValue);
    }
    return value === optionValue;
  }

  function handleSelect(option: ChartDropdownOption<T>) {
    if (option.disabled) return;

    if (multiSelect) {
      onToggle?.(option.value);
      // Don't close on multi-select
    } else {
      value = option.value;
      onValueChange?.(option.value);
      open = false;
    }
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!wrapperEl?.contains(target)) {
      open = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      open = false;
    }
  }

  $effect(() => {
    if (!open) return;

    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

{#snippet chevronIcon()}
  <svg
    class="trigger-chevron"
    class:rotated={open}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    width="14"
    height="14"
  >
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
{/snippet}

<div class="chart-dropdown" bind:this={wrapperEl}>
  <button
    type="button"
    class="trigger-btn"
    class:open
    aria-label={ariaLabel}
    aria-haspopup={multiSelect ? "menu" : "listbox"}
    aria-expanded={open}
    onclick={toggle}
  >
    <span class="trigger-label">{displayLabel}</span>
    {@render chevronIcon()}
  </button>

  {#if open}
    <div class="dropdown-menu" role={multiSelect ? "menu" : "listbox"}>
      {#each options as option (option.value)}
        <button
          type="button"
          class="dropdown-option"
          class:active={isSelected(option.value)}
          class:disabled={option.disabled}
          role={multiSelect ? "menuitemcheckbox" : "option"}
          aria-checked={multiSelect ? isSelected(option.value) : undefined}
          aria-selected={!multiSelect ? isSelected(option.value) : undefined}
          aria-disabled={option.disabled}
          disabled={option.disabled}
          onclick={() => handleSelect(option)}
        >
          {option.label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .chart-dropdown {
    position: relative;
    display: inline-flex;
  }

  /* Trigger - matches ChartPill / ExploreChart styling */
  .trigger-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 34px;
    padding: 0 12px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 20px;
    color: var(--muted-foreground);
    cursor: pointer;
    transition: all 100ms ease-out;
    font-family: 'Basel', sans-serif;
    font-size: 14px;
    font-weight: 535;
    white-space: nowrap;
  }

  .trigger-btn:hover {
    color: var(--foreground);
  }

  .trigger-btn.open {
    color: var(--foreground);
  }

  .trigger-btn:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  .trigger-label {
    line-height: 1;
  }

  .trigger-chevron {
    transition: transform 150ms ease-out;
    color: var(--muted-foreground);
  }

  .trigger-chevron.rotated {
    transform: rotate(180deg);
  }

  /* Dropdown menu - matches ExploreChart */
  .dropdown-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    min-width: 130px;
    z-index: 50;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 4px;
    box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1);
    animation: dropdownFade 150ms ease-out;
  }

  .dropdown-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 12px 8px;
    background: transparent;
    border: none;
    border-radius: 8px;
    text-align: left;
    font-family: 'Basel', sans-serif;
    font-size: 14px;
    font-weight: 485;
    color: var(--foreground);
    cursor: pointer;
    transition: background-color 100ms ease-out;
  }

  .dropdown-option:hover:not(:disabled) {
    background: var(--muted);
  }

  .dropdown-option.active::after {
    content: '\2713';
    color: var(--primary);
    font-size: 16px;
  }

  .dropdown-option.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @keyframes dropdownFade {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
