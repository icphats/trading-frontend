<script lang="ts">
  type Size = 'lg' | 'md' | 'sm';

  interface Props {
    /** Display label for the input */
    label?: string;
    /** Current input value */
    value: string;
    /** Placeholder text */
    placeholder?: string;
    /** Error message to display */
    error?: string;
    /** Callback when value changes */
    onValueChange?: (value: string) => void;
    /** Whether the input is disabled */
    disabled?: boolean;
    /** Size variant: lg (36px), md (24px), sm (18px) */
    size?: Size;
    /** Read-only display mode */
    readonly?: boolean;
    /** Input type (text, password, etc.) */
    type?: 'text' | 'password';
    /** Whether to show copy button */
    showCopy?: boolean;
    /** Hint text below input */
    hint?: string;
    /** Whether to use monospace font */
    monospace?: boolean;
  }

  let {
    label,
    value = $bindable(""),
    placeholder = "",
    error,
    onValueChange,
    disabled = false,
    size = 'lg',
    readonly = false,
    type = 'text',
    showCopy = false,
    hint,
    monospace = false,
  }: Props = $props();

  let isCopied = $state(false);

  // Handle input changes
  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value;
    onValueChange?.(target.value);
  }

  // Handle copy to clipboard
  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      isCopied = true;
      setTimeout(() => {
        isCopied = false;
      }, 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  // Generate unique ID for accessibility
  const inputId = `text-input-${Math.random().toString(36).slice(2, 9)}`;
</script>

<div class="text-input-container text-size-{size}">
  <!-- Label (optional) -->
  {#if label}
    <label for={inputId} class="text-input-label">{label}</label>
  {/if}

  <!-- Main Input Card -->
  <div
    class="text-input-card"
    class:text-input-error={!!error}
    class:text-input-disabled={disabled}
    class:text-input-readonly={readonly}
  >
    <!-- Input Row -->
    <div class="text-input-row">
      <input
        id={inputId}
        {type}
        {placeholder}
        disabled={disabled || readonly}
        {value}
        oninput={handleInput}
        class="text-input-field"
        class:monospace
      />

      <!-- Copy Button (optional) -->
      {#if showCopy && value}
        <button
          type="button"
          class="text-copy-btn"
          onclick={handleCopy}
          title={isCopied ? 'Copied!' : 'Copy'}
        >
          {#if isCopied}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          {:else}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          {/if}
        </button>
      {/if}
    </div>

    <!-- Hint Row (optional) -->
    {#if hint}
      <div class="text-hint-row">
        <span class="text-hint">{hint}</span>
      </div>
    {/if}
  </div>

  <!-- Error Message -->
  {#if error}
    <p class="text-error-message">{error}</p>
  {/if}
</div>

<style>
  .text-input-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .text-input-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground);
  }

  .text-input-card {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 16px;
    background: var(--field);
    border: 1px solid transparent;
    border-radius: 20px;
    gap: 8px;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .text-input-card:hover:not(.text-input-disabled):not(.text-input-readonly):not(:focus-within) {
    background: var(--field-hover);
  }

  .text-input-card:focus-within:not(.text-input-disabled):not(.text-input-readonly) {
    background: var(--field-active);
    border-color: var(--field-border);
  }

  .text-input-card.text-input-error {
    outline: 1px solid var(--destructive);
  }

  .text-input-card.text-input-disabled {
    background: var(--field-disabled);
    cursor: not-allowed;
  }

  .text-input-card.text-input-readonly {
    opacity: 0.8;
    background: var(--muted);
  }

  /* Input Row */
  .text-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .text-input-field {
    flex: 1;
    min-width: 0;
    padding: 0;
    font-size: 18px;
    font-weight: 400;
    font-family: var(--font-sans);
    color: var(--foreground);
    background: transparent;
    border: none;
    outline: none;
  }

  .text-input-field.monospace {
    font-family: var(--font-mono);
    font-size: 14px;
  }

  .text-input-field::placeholder {
    color: var(--muted-foreground);
    opacity: 0.4;
  }

  .text-input-field:disabled {
    cursor: not-allowed;
  }

  /* Copy Button */
  .text-copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    background: var(--surface-2, var(--background));
    border: 1px solid var(--surface-3, var(--border));
    border-radius: 8px;
    cursor: pointer;
    color: var(--muted-foreground);
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .text-copy-btn:hover {
    background: var(--surface-3, var(--muted));
    color: var(--foreground);
  }

  /* Hint Row */
  .text-hint-row {
    display: flex;
    align-items: center;
  }

  .text-hint {
    font-size: 13px;
    color: var(--muted-foreground);
  }

  /* Error Message */
  .text-error-message {
    font-size: 13px;
    color: var(--destructive);
    margin: 0;
  }

  /* ========================================
     SIZE VARIANTS
     ======================================== */

  /* Medium size (md) */
  .text-size-md .text-input-card {
    padding: 12px;
    border-radius: 16px;
    gap: 6px;
  }

  .text-size-md .text-input-field {
    font-size: 16px;
  }

  .text-size-md .text-input-field.monospace {
    font-size: 13px;
  }

  .text-size-md .text-input-label {
    font-size: 12px;
  }

  .text-size-md .text-hint {
    font-size: 11px;
  }

  .text-size-md .text-error-message {
    font-size: 11px;
  }

  .text-size-md .text-copy-btn {
    padding: 4px;
  }

  .text-size-md .text-copy-btn svg {
    width: 14px;
    height: 14px;
  }

  /* Small size (sm) */
  .text-size-sm .text-input-card {
    padding: 8px 10px;
    border-radius: 12px;
    gap: 4px;
  }

  .text-size-sm .text-input-field {
    font-size: 14px;
  }

  .text-size-sm .text-input-field.monospace {
    font-size: 12px;
  }

  .text-size-sm .text-input-label {
    font-size: 11px;
  }

  .text-size-sm .text-hint {
    font-size: 10px;
  }

  .text-size-sm .text-error-message {
    font-size: 10px;
  }

  .text-size-sm .text-copy-btn {
    padding: 3px;
  }

  .text-size-sm .text-copy-btn svg {
    width: 12px;
    height: 12px;
  }
</style>
