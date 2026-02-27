<script lang="ts">
  import { EmptyState } from '$lib/components/ui';
  import type { PortfolioNft } from '../types';
  import { pageHeader } from '$lib/components/portfolio/page-header.svelte';

  // Configure page header
  pageHeader.reset();
  pageHeader.mode = 'nfts';
  pageHeader.sectionLabel = 'NFTs Value';
  pageHeader.showValue = true;
  pageHeader.filterType = 'search';
  pageHeader.searchPlaceholder = 'Search NFTs';
  pageHeader.searchValue = '';

  // TODO: Wire up to real data
  let nfts: PortfolioNft[] = $state([]);
  let isLoading = $state(false);
  let search = $derived(pageHeader.searchValue);

  const nftCount = $derived(nfts.length);

  // Push reactive values to page header
  $effect(() => {
    pageHeader.totalValue = 0;
    pageHeader.change24h = 0;
    pageHeader.change24hPercent = 0;
    pageHeader.count = nftCount;
    pageHeader.countLabel = 'NFTs';
  });

  const filteredNfts = $derived(() => {
    if (!search) return nfts;
    const query = search.toLowerCase();
    return nfts.filter(n =>
      n.name.toLowerCase().includes(query) ||
      n.collection.toLowerCase().includes(query)
    );
  });
</script>

<div class="nfts-page">
  <!-- NFT Grid -->
  {#if isLoading}
    <div class="nfts-grid">
      {#each Array(8) as _}
        <div class="nft-card skeleton-card">
          <div class="skeleton skeleton-image"></div>
          <div class="skeleton-info">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-collection"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if filteredNfts().length === 0}
    {#if search}
      <EmptyState
        title="No results found"
        description="Try a different search term"
      />
    {:else}
      <EmptyState
        title="No NFTs yet"
        description="Your NFT collection will appear here"
      />
    {/if}
  {:else}
    <div class="nfts-grid">
      {#each filteredNfts() as nft (nft.id)}
        <div class="nft-card">
          <div class="nft-image-wrapper">
            {#if nft.image}
              <img src={nft.image} alt={nft.name} class="nft-image" />
            {:else}
              <div class="nft-image-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="m21 15-5-5L5 21"/>
                </svg>
              </div>
            {/if}
          </div>
          <div class="nft-info">
            <span class="nft-name">{nft.name}</span>
            <span class="nft-collection">{nft.collection}</span>
            {#if nft.floorPrice !== undefined}
              <span class="nft-floor">Floor: ${nft.floorPrice.toFixed(2)}</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .nfts-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
    flex: 1;
    min-height: 0;
  }

  .nfts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    align-content: start;
  }

  .nft-card {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: all 0.15s ease;
    cursor: pointer;
  }

  .nft-card:hover {
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
  }

  .nft-image-wrapper {
    aspect-ratio: 1;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.05);
  }

  .nft-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .nft-image-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted-foreground);
    opacity: 0.5;
  }

  .nft-info {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .nft-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nft-collection {
    font-size: 12px;
    color: var(--muted-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nft-floor {
    font-size: 12px;
    font-family: var(--font-sans);
    font-weight: var(--font-weight-book);
    color: var(--muted-foreground);
    margin-top: 4px;
  }

  .skeleton-card {
    display: flex;
    flex-direction: column;
  }

  .skeleton {
    background: rgba(255, 255, 255, 0.1);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-image {
    aspect-ratio: 1;
  }

  .skeleton-info {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .skeleton-title {
    height: 16px;
    border-radius: var(--radius-sm);
    width: 80%;
  }

  .skeleton-collection {
    height: 14px;
    border-radius: var(--radius-sm);
    width: 60%;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @media (max-width: 640px) {
    .nfts-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
