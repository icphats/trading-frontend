<script lang="ts">
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import Logo from "$lib/components/ui/Logo.svelte";
  import { formatToken, formatUSD } from "$lib/utils/format.utils";

  interface Props {
    canisterId: string;
  }

  let { canisterId }: Props = $props();

  // Get token from entity store
  let token = $derived(entityStore.getToken(canisterId));

  // Formatted values
  let formattedBalance = $derived(
    token ? formatToken({ value: token.totalSupply ?? 0n, displayDecimals: 2, commas: true }) : "0"
  );
</script>

<div class="token-analytics-page">
  {#if token}
    <div class="token-header">
      <div class="token-info">
        <Logo src={token.logo ?? undefined} alt={token.displaySymbol} size="lg" circle={true} />
        <div class="token-details">
          <h1 class="token-name">{token.displayName}</h1>
          <p class="token-symbol">{token.displaySymbol}</p>
          <p class="token-canister">{canisterId}</p>
        </div>
      </div>

      <div class="token-stats">
        <div class="stat-card">
          <span class="stat-label">Balance</span>
          <span class="stat-value">{formattedBalance} {token.displaySymbol}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Price</span>
          <span class="stat-value">{formatUSD(Number(token.priceUsd) / 1e12)}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Value</span>
          <span class="stat-value">{formatUSD(Number(token.tvl) / 1e6)}</span>
        </div>
      </div>
    </div>

    <div class="analytics-grid">
      <!-- Token Analytics Sections - To be implemented -->
      <div class="analytics-section">
        <h2>Price History</h2>
        <p class="placeholder">Chart coming soon...</p>
      </div>

      <div class="analytics-section">
        <h2>Transaction History</h2>
        <p class="placeholder">Transaction list coming soon...</p>
      </div>

      <div class="analytics-section">
        <h2>Market Info</h2>
        <p class="placeholder">Market data coming soon...</p>
      </div>
    </div>
  {:else}
    <div class="error-state">
      <h2>Token Not Found</h2>
      <p>Unable to load token information for canister: {canisterId}</p>
    </div>
  {/if}
</div>

<style>
  .token-analytics-page {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .token-header {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 2rem;
    margin-bottom: 2rem;
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .token-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .token-name {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--foreground);
    margin: 0;
  }

  .token-symbol {
    font-size: 1rem;
    color: var(--muted-foreground);
    margin: 0;
  }

  .token-canister {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    font-family: monospace;
    margin: 0;
  }

  .token-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--foreground);
  }

  .analytics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1.5rem;
  }

  .analytics-section {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
  }

  .analytics-section h2 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--foreground);
    margin: 0 0 1rem 0;
  }

  .placeholder {
    color: var(--muted-foreground);
    font-size: 0.875rem;
    text-align: center;
    padding: 2rem;
  }

  .error-state {
    text-align: center;
    padding: 4rem 2rem;
  }

  .error-state h2 {
    font-size: 1.5rem;
    color: var(--foreground);
    margin-bottom: 0.5rem;
  }

  .error-state p {
    color: var(--muted-foreground);
    font-size: 0.875rem;
  }

  @media (max-width: 768px) {
    .token-analytics-page {
      padding: 1rem;
    }

    .token-header {
      padding: 1.5rem;
    }

    .analytics-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
