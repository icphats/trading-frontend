<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import type { DropdownOption } from "./types";

  interface Props {
    options: DropdownOption<T>[];
    /** For single-select: the selected value. For multi-select: ignored (use values instead) */
    value?: T;
    /** For multi-select: array of selected values */
    values?: T[];
    /** For single-select: called when value changes */
    onValueChange?: (value: T) => void;
    /** For multi-select: called when a value is toggled */
    onToggle?: (value: T) => void;
    /** Enable multi-select mode (toggleable options) */
    multiSelect?: boolean;
    /** Custom trigger snippet - if not provided, uses default button with label */
    trigger?: Snippet<[{ open: boolean; selectedOption: DropdownOption<T> | undefined; selectedOptions: DropdownOption<T>[] }]>;
    /** Alignment of dropdown menu relative to trigger */
    align?: "left" | "right";
    /** Aria label for accessibility */
    ariaLabel?: string;
    /** Optional class for the wrapper */
    class?: string;
  }

  let {
    options,
    value = $bindable(),
    values = [],
    onValueChange,
    onToggle,
    multiSelect = false,
    trigger,
    align = "left",
    ariaLabel = "Select option",
    class: customClass = "",
  }: Props = $props();

  let open = $state(false);
  let wrapperEl: HTMLDivElement;

  const selectedOption = $derived(options.find((opt) => opt.value === value));
  const selectedOptions = $derived(options.filter((opt) => values.includes(opt.value)));

  function toggle() {
    open = !open;
  }

  function isSelected(optionValue: T): boolean {
    if (multiSelect) {
      return values.includes(optionValue);
    }
    return value === optionValue;
  }

  function select(option: DropdownOption<T>) {
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
    if (event.key === "Escape") {
      open = false;
    }
  }

  $effect(() => {
    if (!open) return;

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleKeydown);
    };
  });
</script>

<div class="dropdown-wrapper {customClass}" bind:this={wrapperEl}>
  <button
    class="dropdown-trigger"
    type="button"
    aria-label={ariaLabel}
    aria-haspopup={multiSelect ? "menu" : "listbox"}
    aria-expanded={open}
    onclick={toggle}
  >
    {#if trigger}
      {@render trigger({ open, selectedOption, selectedOptions })}
    {:else}
      <span class="dropdown-label">{selectedOption?.label ?? "Select"}</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="dropdown-chevron {open ? 'rotated' : ''}"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    {/if}
  </button>

  {#if open}
    <div class="dropdown-panel dropdown-menu {align === 'right' ? 'align-right' : ''}" role={multiSelect ? "menu" : "listbox"}>
      {#each options as option (option.value)}
        <button
          class="dropdown-option"
          class:active={isSelected(option.value)}
          class:disabled={option.disabled}
          type="button"
          role={multiSelect ? "menuitemcheckbox" : "option"}
          aria-checked={multiSelect ? isSelected(option.value) : undefined}
          aria-selected={!multiSelect ? isSelected(option.value) : undefined}
          aria-disabled={option.disabled}
          onclick={() => select(option)}
        >
          {#if option.icon}
            <span class="option-icon">
              {@render option.icon()}
            </span>
          {/if}
          <span class="option-label">{option.label}</span>
          {#if multiSelect}
            <svg
              class="check-icon"
              class:visible={isSelected(option.value)}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              width="14"
              height="14"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dropdown-wrapper {
    position: relative;
    display: inline-block;
  }

  .dropdown-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--foreground);
    cursor: pointer;
    transition:
      border-color 200ms ease-out,
      box-shadow 200ms ease-out;
  }

  .dropdown-trigger:hover {
    border-color: oklch(from var(--border) l c h / 0.55);
    box-shadow: 0 0 8px oklch(from var(--border) l c h / 0.15);
  }

  .dropdown-label {
    font-size: 0.75rem;
    font-weight: 500;
  }

  .dropdown-chevron {
    transition: transform 200ms ease-out;
  }

  .dropdown-chevron.rotated {
    transform: rotate(180deg);
  }

  .dropdown-menu {
    left: 0;
    min-width: 80px;
  }

  .dropdown-menu.align-right {
    left: auto;
    right: 0;
  }

  .dropdown-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: var(--background);
    border: none;
    text-align: left;
    font-size: 0.75rem;
    color: var(--foreground);
    cursor: pointer;
    transition: background-color 200ms ease-out;
    white-space: nowrap;
  }

  .dropdown-option:hover {
    background: var(--hover-overlay-strong);
  }

  .dropdown-option.active {
    background: var(--hover-overlay);
  }

  .dropdown-option.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .option-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .option-label {
    flex: 1;
  }

  .check-icon {
    flex-shrink: 0;
    visibility: hidden;
  }

  .check-icon.visible {
    visibility: visible;
  }

</style>
