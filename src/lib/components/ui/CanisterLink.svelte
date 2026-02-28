<script lang="ts">
  /**
   * CanisterLink - Uniswap-style link row with copy and explorer functionality
   *
   * Matches Uniswap's PoolDetailsLink styling:
   * - Pill-shaped buttons with border-radius: 20px
   * - Shortened address with copy icon
   * - Explorer link button
   *
   * Reference: interface/apps/web/src/components/Pools/PoolDetails/PoolDetailsLink.tsx
   */
  import Logo from './Logo.svelte';
  import TokenPairLogo from './TokenPairLogo.svelte';
  import CopyableId from './CopyableId.svelte';
  import { getCanisterExplorerUrl } from '$lib/utils/explorer.utils';

  interface Props {
    canisterId: string;
    label: string;
    tokenLogos?: (string | null | undefined)[];
    tokenSymbols?: string[];
    href?: string;
  }

  let {
    canisterId,
    label,
    tokenLogos = [],
    tokenSymbols = [],
    href
  }: Props = $props();

  const explorerUrl = $derived(getCanisterExplorerUrl(canisterId));
  const isPool = $derived(tokenLogos.length === 2);
  const displaySymbol = $derived(
    tokenSymbols.length === 2
      ? `${tokenSymbols[0]} / ${tokenSymbols[1]}`
      : tokenSymbols[0] ?? ''
  );
</script>

<div class="canister-link">
  <!-- Left side: Logo(s) + Label -->
  {#snippet tokenContent()}
    {#if isPool && tokenLogos[0] && tokenLogos[1]}
      <TokenPairLogo
        baseLogo={tokenLogos[0]}
        quoteLogo={tokenLogos[1]}
        baseSymbol={tokenSymbols[0] ?? ''}
        quoteSymbol={tokenSymbols[1] ?? ''}
        size="xxs"
      />
    {:else if tokenLogos[0]}
      <Logo src={tokenLogos[0]} alt={tokenSymbols[0] ?? label} size="xxs" circle={true} />
    {/if}
    <span class="label">{label}</span>
    {#if displaySymbol}
      <span class="symbol">{displaySymbol}</span>
    {/if}
  {/snippet}

  {#if href}
    <a class="token-info" {href}>
      {@render tokenContent()}
    </a>
  {:else}
    <div class="token-info">
      {@render tokenContent()}
    </div>
  {/if}

  <!-- Right side: Copy pill + Explorer pill -->
  <div class="buttons-row">
    <CopyableId id={canisterId} variant="pill" />

    <!-- Explorer Link Pill -->
    <a
      class="explorer-pill"
      href={explorerUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="View on IC Dashboard"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </svg>
    </a>
  </div>
</div>

<style>
  .canister-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  /* Left side: Logo + Label + Symbol */
  .token-info {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex-shrink: 1;
    text-decoration: none;
    color: inherit;
  }

  a.token-info:hover .label {
    color: var(--primary);
  }

  .label {
    font-family: 'Basel', sans-serif;
    font-size: 14px;
    font-weight: 485;
    line-height: 18px;
    color: var(--foreground);
    white-space: nowrap;
  }

  .symbol {
    font-family: 'Basel', sans-serif;
    font-size: 14px;
    font-weight: 485;
    line-height: 18px;
    color: var(--muted-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Right side: Buttons */
  .buttons-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  /* Explorer pill - matches Uniswap's ExplorerWrapper */
  .explorer-pill {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border-radius: 20px;
    background-color: var(--muted);
    color: var(--foreground);
    text-decoration: none;
    transition: opacity 150ms ease;
  }

  .explorer-pill:hover {
    opacity: 0.8;
  }

  .explorer-pill:active {
    opacity: 0.6;
  }

  /* Responsive */
  @media (max-width: 480px) {
    .symbol {
      display: none;
    }
  }
</style>
