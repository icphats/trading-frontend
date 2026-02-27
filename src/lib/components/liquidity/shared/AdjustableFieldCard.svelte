<script lang="ts">
  import type { Snippet } from 'svelte';

  type Size = 'lg' | 'sm';

  interface Props {
    label?: string;
    value: string;
    placeholder?: string;
    inputSuffix?: string;
    disabled?: boolean;
    error?: string | null;
    size?: Size;
    showButtons?: boolean;
    onIncrement?: () => void;
    onDecrement?: () => void;
    onInput?: (e: Event) => void;
    onBlur?: () => void;
    onFocus?: () => void;
    onKeydown?: (e: KeyboardEvent) => void;
    footer?: Snippet;
  }

  let {
    label,
    value,
    placeholder = '0.0',
    inputSuffix,
    disabled = false,
    error = null,
    size = 'lg',
    showButtons = true,
    onIncrement,
    onDecrement,
    onInput,
    onBlur,
    onFocus,
    onKeydown,
    footer,
  }: Props = $props();
</script>

<div class="afc afc-size-{size}">
  {#if label}
    <span class="afc-label">{label}</span>
  {/if}
  <div class="afc-card" class:error class:disabled>
    <div class="afc-body">
      {#if showButtons}
        <button
          class="afc-btn"
          onclick={onDecrement}
          {disabled}
          aria-label="Decrease"
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      {/if}

      <div class="afc-input-wrap">
        <input
          type="text"
          inputmode="decimal"
          {value}
          {placeholder}
          {disabled}
          oninput={onInput}
          onblur={onBlur}
          onfocus={onFocus}
          onkeydown={onKeydown}
          class="afc-input"
          class:has-suffix={!!inputSuffix}
          class:no-buttons={!showButtons}
        />
        {#if inputSuffix}
          <span class="afc-suffix">{inputSuffix}</span>
        {/if}
      </div>

      {#if showButtons}
        <button
          class="afc-btn"
          onclick={onIncrement}
          {disabled}
          aria-label="Increase"
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      {/if}
    </div>

    {#if footer}
      <div class="afc-footer">
        {@render footer()}
      </div>
    {/if}

    {#if error}
      <div class="afc-error">{error}</div>
    {/if}
  </div>
</div>

<style>
  .afc {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .afc-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground);
  }

  /* Card */
  .afc-card {
    display: flex;
    flex-direction: column;
    background: var(--field);
    border: 1px solid transparent;
    border-radius: 20px;
    padding: 16px;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .afc-card:hover:not(.disabled) {
    background: var(--field-hover);
  }

  .afc-card:focus-within:not(.disabled) {
    background: var(--field-active);
    border-color: var(--field-border);
  }

  .afc-card.error {
    border-color: var(--destructive, #ef4444);
  }

  .afc-card.disabled {
    background: var(--field-disabled);
    opacity: 0.6;
    pointer-events: none;
  }

  /* Body */
  .afc-body {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Adjust buttons */
  .afc-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 12px;
    color: var(--foreground);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .afc-btn:hover:not(:disabled) {
    background: var(--muted);
    border-color: var(--foreground);
  }

  .afc-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .afc-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Input wrapper */
  .afc-input-wrap {
    flex: 1;
    min-width: 0;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Input */
  .afc-input {
    width: 100%;
    padding: 8px 0;
    background: transparent;
    border: none;
    outline: none;
    font-size: 24px;
    font-weight: 600;
    color: var(--foreground);
    text-align: center;
  }

  .afc-input::placeholder {
    color: var(--muted-foreground);
    opacity: 0.5;
  }

  .afc-input.has-suffix {
    width: auto;
    min-width: 40px;
  }

  .afc-input.no-buttons {
    text-align: left;
  }

  /* Suffix */
  .afc-suffix {
    font-size: 18px;
    font-weight: 600;
    color: var(--muted-foreground);
    margin-left: 2px;
  }

  /* Footer */
  .afc-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 8px;
  }

  /* Error */
  .afc-error {
    margin-top: 8px;
    padding: 8px;
    background: oklch(from var(--destructive) l c h / 0.1);
    border-radius: 8px;
    font-size: 12px;
    color: var(--destructive, #ef4444);
    text-align: center;
  }

  /* ======== SM size ======== */
  .afc-size-sm {
    gap: 4px;
  }

  .afc-size-sm .afc-label {
    font-size: 14px;
  }

  .afc-size-sm .afc-card {
    padding: 8px 10px;
    border-radius: 12px;
  }

  .afc-size-sm .afc-body {
    gap: 4px;
  }

  .afc-size-sm .afc-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
  }

  .afc-size-sm .afc-btn svg {
    width: 12px;
    height: 12px;
  }

  .afc-size-sm .afc-input {
    font-size: 18px;
    padding: 4px 0;
  }

  .afc-size-sm .afc-suffix {
    font-size: 14px;
  }

  .afc-size-sm .afc-footer {
    margin-top: 4px;
    gap: 6px;
  }

  .afc-size-sm .afc-error {
    margin-top: 4px;
    padding: 6px;
    font-size: 11px;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .afc-card {
      padding: 12px;
    }

    .afc-input {
      font-size: 20px;
    }

    .afc-btn {
      width: 32px;
      height: 32px;
    }
  }
</style>
