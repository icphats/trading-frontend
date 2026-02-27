<script lang="ts">
  /**
   * EmptyState - Empty/loading/error states for lists
   *
   * Usage:
   * <EmptyState message="No results found" hint="Try a different search" />
   * <EmptyState variant="loading" message="Loading tokens..." />
   * <EmptyState variant="error" message="Failed to load" />
   *
   * Legacy props (title/description) are aliased to message/hint for backwards compatibility
   */

  interface Props {
    variant?: 'empty' | 'loading' | 'error';
    message?: string;
    hint?: string;
    // Legacy prop aliases
    title?: string;
    description?: string;
  }

  let { variant = 'empty', message, hint, title, description }: Props = $props();

  // Support legacy props
  const displayMessage = $derived(message ?? title ?? '');
  const displayHint = $derived(hint ?? description);
</script>

<div class="empty-state" class:loading={variant === 'loading'} class:error={variant === 'error'}>
  {#if variant === 'loading'}
    <div class="loading-spinner"></div>
  {:else if variant === 'error'}
    <svg class="error-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  {/if}

  <p class="empty-message">{displayMessage}</p>

  {#if displayHint}
    <p class="empty-hint">{displayHint}</p>
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    text-align: center;
    gap: 8px;
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 4px;
  }

  .error-icon {
    color: var(--color-bearish, #ef4444);
    margin-bottom: 4px;
  }

  .empty-message {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground);
    margin: 0;
  }

  .empty-state.loading .empty-message,
  .empty-state.error .empty-message {
    color: var(--muted-foreground);
  }

  .empty-hint {
    font-size: 12px;
    color: var(--muted-foreground);
    margin: 0;
    opacity: 0.8;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
