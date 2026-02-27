<script lang="ts">
  import Logo from '$lib/components/ui/Logo.svelte';
  import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';

  interface Props {
    ledger: string;
  }

  let { ledger }: Props = $props();

  // Read directly from entityStore (the single source of truth)
  const token = $derived(entityStore.getToken(ledger));
</script>

<div class="token-header">
  {#if !token}
    <div class="token-header-skeleton">
      <div class="skeleton-logo"></div>
      <div class="skeleton-content">
        <div class="skeleton-text skeleton-name"></div>
        <div class="skeleton-text skeleton-price"></div>
      </div>
    </div>
  {:else}
    <!-- Token Identity (price is shown in chart overlay) -->
    <div class="token-identity">
      <Logo src={token.logo ?? undefined} alt={token.displaySymbol} size="md" circle={true} />
      <div class="token-name-group">
        <h1 class="token-name">{token.displayName}</h1>
        <span class="token-symbol">{token.displaySymbol}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .token-header {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 20px;
  }

  /* Token Identity */
  .token-identity {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .token-name-group {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .token-name {
    font-family: 'Basel', sans-serif;
    font-size: 28px;
    line-height: 36px;
    font-weight: 500;
    color: var(--foreground);
    margin: 0;
  }

  .token-symbol {
    font-family: 'Basel', sans-serif;
    font-size: 28px;
    line-height: 36px;
    font-weight: 485;
    color: var(--muted-foreground);
    text-transform: uppercase;
  }

  /* Loading skeleton */
  .token-header-skeleton {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .skeleton-logo {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--muted);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .skeleton-text {
    border-radius: 8px;
    background: var(--muted);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-name {
    width: 180px;
    height: 32px;
  }

  .skeleton-price {
    width: 120px;
    height: 40px;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .token-name,
    .token-symbol {
      font-size: 20px;
      line-height: 26px;
    }
  }
</style>
