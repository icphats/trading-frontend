<script lang="ts">
  /**
   * LinksSection - Container for CanisterLink items
   *
   * Matches Uniswap's Links section structure from PoolDetails page.
   * Displays a "Links" header and a list of CanisterLink items.
   */
  import CanisterLink from './CanisterLink.svelte';

  export interface LinkItem {
    canisterId: string;
    label: string;
    tokenLogos?: (string | null | undefined)[];
    tokenSymbols?: string[];
    href?: string;
  }

  interface Props {
    links: LinkItem[];
  }

  let { links }: Props = $props();
</script>

<div class="links-section">
  <h3 class="links-header">Links</h3>
  <div class="links-container">
    {#each links as link (link.canisterId + link.label)}
      <CanisterLink
        canisterId={link.canisterId}
        label={link.label}
        tokenLogos={link.tokenLogos}
        tokenSymbols={link.tokenSymbols}
        href={link.href}
      />
    {/each}
  </div>
</div>

<style>
  .links-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .links-header {
    font-family: 'Basel', sans-serif;
    font-size: 18px;
    line-height: 24px;
    font-weight: 500;
    color: var(--foreground);
    margin: 0;
  }

  .links-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
</style>
