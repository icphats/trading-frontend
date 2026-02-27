<script lang="ts">
  import Logo from "$lib/components/ui/Logo.svelte";

  let {
    symbol,
    balance,
    usdValue,
    logo,
    onclick,
  }: {
    symbol: string;
    balance: string;
    usdValue?: string;
    logo?: string;
    onclick?: () => void;
  } = $props();
</script>

<button class="token-balance-row" onclick={onclick} type="button">
  <div class="left">
    <Logo src={logo} alt={symbol} size="xs" circle={true} />
    <span class="symbol">{symbol}</span>
  </div>
  <div class="right">
    <div class="amounts">
      <span class="balance">{balance}</span>
      {#if usdValue}
        <span class="usd">{usdValue}</span>
      {/if}
    </div>
    <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  </div>
</button>

<style>
  .token-balance-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    width: 100%;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .token-balance-row:hover {
    background: var(--muted);
  }

  .token-balance-row:active {
    background: var(--accent);
  }

  .left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .symbol {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--foreground);
  }

  .right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .amounts {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.125rem;
    text-align: right;
  }

  .balance {
    font-size: 0.8125rem;
    font-weight: 600;
    font-family: var(--font-sans);
    color: var(--foreground);
  }

  .usd {
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }

  .chevron {
    color: var(--muted-foreground);
    flex-shrink: 0;
  }
</style>
