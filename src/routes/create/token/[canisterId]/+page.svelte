<script lang="ts">
  import TokenManagePage from '$lib/components/create/token/TokenManagePage.svelte';
  import { page } from '$app/state';
  import { TokenDetailState } from '$lib/domain/tokens/state/token-detail.svelte';

  const canisterId = $derived(page.params.canisterId as string);

  const state = new TokenDetailState();

  $effect(() => {
    const id = canisterId;
    state.loadToken(id);
  });
</script>

{#if state.tokenError}
  <div class="resolve-state">
    <p class="error-text">{state.tokenError}</p>
    <p class="error-detail">Could not find token "{canisterId}"</p>
  </div>
{:else if state.isLoadingToken || !state.token}
  <div class="resolve-state">
    <div class="spinner"></div>
    <p class="loading-text">Loading token...</p>
  </div>
{:else}
  <TokenManagePage {state} {canisterId} />
{/if}

<style>
  .resolve-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 60vh;
    gap: 8px;
  }

  .error-text {
    color: var(--destructive);
    font-size: 18px;
    font-weight: 600;
  }

  .error-detail {
    color: var(--muted-foreground);
    font-size: 14px;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 2px solid transparent;
    border-bottom-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-text {
    color: var(--muted-foreground);
    margin-top: 8px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
