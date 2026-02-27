<script lang="ts">
  import Logo from '$lib/components/ui/Logo.svelte';
  import { bigIntToString } from '$lib/utils/format.utils';

  interface TokenInfo {
    symbol: string;
    displaySymbol: string;
    logo?: string | null;
    decimals: number;
  }

  interface Props {
    token: TokenInfo;
    amount: bigint;
    usdValue?: string;
  }

  let { token, amount, usdValue }: Props = $props();

  const formattedAmount = $derived(bigIntToString(amount, token.decimals));
</script>

<div class="token-amount-display">
  <Logo src={token.logo ?? undefined} alt={token.displaySymbol} size="md" circle={true} />
  <div class="amount-section">
    <span class="amount">{formattedAmount} {token.displaySymbol}</span>
    {#if usdValue}
      <span class="usd">${usdValue}</span>
    {/if}
  </div>
</div>

<style>
  .token-amount-display {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .amount-section {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .amount {
    font-size: 1.25rem;
    font-weight: 600;
    font-family: var(--font-numeric);
    color: var(--foreground);
  }

  .usd {
    font-size: 0.875rem;
    color: var(--muted-foreground);
  }
</style>
