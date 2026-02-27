<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    size?: 'sm' | 'md' | 'lg';
    message?: Snippet;
    class?: string;
  }

  let { size = 'lg', message, class: className = '' }: Props = $props();

  const sizeClasses = {
    sm: 'w-4 h-4 border',
    md: 'w-6 h-6 border-2',
    lg: 'w-12 h-12 border-2',
  };
</script>

<div class="spinner-container {className}">
  <div class="spinner {sizeClasses[size]}"></div>
  {#if message}
    <div class="spinner-message">
      {@render message()}
    </div>
  {/if}
</div>

<style>
  .spinner-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }

  .spinner {
    border-color: var(--primary);
    border-top-color: transparent;
    border-radius: 9999px;
    animation: spin 1s linear infinite;
  }

  .spinner-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
