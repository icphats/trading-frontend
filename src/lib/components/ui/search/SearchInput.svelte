<script lang="ts">
  /**
   * SearchInput - Unified search input with clear button
   *
   * Usage:
   * <SearchInput
   *   bind:value={searchQuery}
   *   placeholder="Search tokens..."
   *   autofocus
   * />
   */

  interface Props {
    value: string;
    placeholder?: string;
    autofocus?: boolean;
    size?: 'sm' | 'md';
    variant?: 'panel' | 'inline';
    onClear?: () => void;
  }

  let {
    value = $bindable(''),
    placeholder = 'Search...',
    autofocus = false,
    size = 'md',
    variant = 'panel',
    onClear,
  }: Props = $props();

  let inputRef: HTMLInputElement;

  function handleClear() {
    value = '';
    onClear?.();
    inputRef?.focus();
  }

  export function focus() {
    inputRef?.focus();
  }
</script>

<div class="search-input-container" class:size-sm={size === 'sm'} class:size-md={size === 'md'} class:variant-panel={variant === 'panel'} class:variant-inline={variant === 'inline'}>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="search-icon"
  >
    <circle cx="11" cy="11" r="8"></circle>
    <path d="m21 21-4.35-4.35"></path>
  </svg>

  <!-- svelte-ignore a11y_autofocus -->
  <input
    bind:this={inputRef}
    bind:value
    type="text"
    class="search-input"
    {placeholder}
    {autofocus}
  />

  {#if value}
    <button class="clear-button" onclick={handleClear} aria-label="Clear search">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  {/if}
</div>

<style>
  .search-input-container {
    display: flex;
    align-items: center;
    gap: 12px;
    transition:
      border-color 200ms ease-out,
      box-shadow 200ms ease-out;
  }

  .size-sm {
    padding: 8px 10px;
    gap: 8px;
  }

  .size-md {
    padding: 16px;
    gap: 12px;
  }

  /* Panel variant (default) — border-bottom only, top-corner radius */
  .variant-panel {
    background: var(--background);
    border-bottom: 1px solid var(--border);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }

  .variant-panel:hover {
    border-bottom-color: oklch(from var(--border) l c h / 0.55);
  }

  .variant-panel:focus-within {
    border-bottom-color: oklch(from var(--border) l c h / 0.7);
    box-shadow: 0 0 12px oklch(from var(--border) l c h / 0.15);
  }

  /* Inline variant — pill-shaped, full border */
  .variant-inline {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 20px;
  }

  .variant-inline:hover {
    border-color: var(--border-hover);
  }

  .variant-inline:focus-within {
    border-color: var(--border-hover);
    box-shadow: none;
  }

  .search-icon {
    color: var(--muted-foreground);
    flex-shrink: 0;
  }

  .size-sm .search-icon {
    width: 14px;
    height: 14px;
  }

  .size-md .search-icon {
    width: 20px;
    height: 20px;
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-weight: var(--font-weight-book, 485);
    color: var(--foreground);
    font-family: var(--font-sans);
  }

  .size-sm .search-input {
    font-size: 13px;
  }

  .size-md .search-input {
    font-size: 16px;
  }

  .search-input::placeholder {
    color: var(--muted-foreground);
  }

  .clear-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--muted);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: var(--muted-foreground);
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .size-sm .clear-button {
    width: 20px;
    height: 20px;
  }

  .size-sm .clear-button svg {
    width: 12px;
    height: 12px;
  }

  .size-md .clear-button {
    width: 24px;
    height: 24px;
  }

  .size-md .clear-button svg {
    width: 14px;
    height: 14px;
  }

  .clear-button:hover {
    background: oklch(from var(--muted) calc(l * 1.1) c h);
    color: var(--foreground);
  }
</style>
