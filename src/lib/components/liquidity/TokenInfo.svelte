<script lang="ts">
  import Logo from '$lib/components/ui/Logo.svelte';
  import { bigIntToString } from '$lib/utils/format.utils';
  import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';

  interface Props {
    currencyAmount: bigint;
    ledgerCanisterId: string;
    currencyUSDAmount?: bigint | null;
  }

  let { currencyAmount, ledgerCanisterId, currencyUSDAmount }: Props = $props();

  // Get token info from entityStore (reactive)
  const token = $derived(entityStore.getToken(ledgerCanisterId));

  // Format the token amount
  const formattedAmount = $derived.by(() => {
    if (!token) return '0';
    return bigIntToString(currencyAmount, token.decimals);
  });

  // Format USD value
  const formattedUSD = $derived.by(() => {
    if (!token) return null;

    // Use provided USD amount if available
    if (currencyUSDAmount !== undefined && currencyUSDAmount !== null) {
      const usdValue = bigIntToString(currencyUSDAmount, 12); // USD prices are E12 (12 decimals)
      return `$${usdValue}`;
    }

    // Otherwise calculate from token price
    const price = token.priceUsd;
    if (!price || price === 0n) return null;

    // Convert token amount to USD
    // price is E12 (12 decimals per 06-Precision.md), token amount is in token decimals
    const tokenAmountInBase = Number(currencyAmount) / Math.pow(10, token.decimals);
    const priceInUSD = Number(price) / 1e12;
    const usdValue = tokenAmountInBase * priceInUSD;

    if (usdValue < 0.01) {
      return '<$0.01';
    } else if (usdValue >= 1000000) {
      return `$${(usdValue / 1000000).toFixed(2)}M`;
    } else if (usdValue >= 1000) {
      return `$${(usdValue / 1000).toFixed(2)}K`;
    } else {
      return `$${usdValue.toFixed(2)}`;
    }
  });
</script>

<div class="token-info">
  {#if token}
    <div class="token-icon-wrapper">
      <Logo src={token.logo ?? undefined} alt={token.displaySymbol} size="lg" circle={true} />
    </div>
    <div class="token-details">
      <div class="token-amount">
        {formattedAmount}
      </div>
      <div class="token-row">
        <span class="token-symbol">{token.displaySymbol}</span>
        {#if formattedUSD}
          <span class="token-usd">{formattedUSD}</span>
        {/if}
      </div>
    </div>
  {:else}
    <div class="token-loading">Loading token info...</div>
  {/if}
</div>

<style>
  .token-info {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--muted);
    border-radius: var(--radius-md);
  }

  .token-icon-wrapper {
    flex-shrink: 0;
  }

  .token-details {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .token-amount {
    font-size: 2rem;
    font-weight: 600;
    font-family: var(--font-numeric);
    color: var(--foreground);
    line-height: 1;
  }

  .token-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .token-symbol {
    font-size: 1rem;
    font-weight: 500;
    color: var(--foreground);
  }

  .token-usd {
    font-size: 0.875rem;
    color: var(--muted-foreground);
  }

  .token-loading {
    font-size: 0.875rem;
    color: var(--muted-foreground);
    text-align: center;
  }
</style>
