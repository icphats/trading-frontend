<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { indexerRepository, tokenItemToUpsert } from '$lib/repositories/indexer.repository';
  import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
  import { normalizeTokenSymbol } from '$lib/domain/markets';
  import { formatTokenPrice, formatPercentChange, fromDecimals } from '$lib/utils/format.utils';
  import { bpsToPercent } from '$lib/domain/markets/utils/math';
  import Logo from '$lib/components/ui/Logo.svelte';
  import { api } from '$lib/actors/api.svelte';
  import type { TokenListItem } from 'declarations/indexer/indexer.did';

  interface TokenDisplay {
    name: string;
    symbol: string;
    price: number;
    change24h: number;
    ledger: string;
    logo: string | null;
  }

  let tokens = $state<TokenDisplay[]>([]);
  let isLoading = $state(true);

  function transformTokens(items: TokenListItem[]): TokenDisplay[] {
    return items.map((item) => {
      const ledgerId = item.token_ledger.toString();
      const token = entityStore.getToken(ledgerId);
      return {
        name: item.name || item.symbol,
        symbol: item.symbol,
        price: fromDecimals(item.current_price_usd_e12, 12),
        change24h: bpsToPercent(item.price_change_24h_bps),
        ledger: ledgerId,
        logo: token?.logo ?? null
      };
    });
  }

  async function loadTokens(): Promise<void> {
    isLoading = true;

    // Fetch only 4 tokens for the landing page
    const result = await indexerRepository.getTokens(4n, undefined, false);

    if ('ok' in result) {
      // Populate entityStore with normalized data
      const upserts = result.ok.data.map(tokenItemToUpsert);
      entityStore.upsertTokens(upserts);

      tokens = transformTokens(result.ok.data);
    }

    isLoading = false;
  }

  function navigateToToken(ledger: string) {
    const token = entityStore.getToken(ledger);
    const symbol = token ? normalizeTokenSymbol(token.displaySymbol) : ledger;
    goto(`/explore/tokens/${symbol}`);
  }

  // Track if we've already fetched
  let hasFetched = $state(false);

  // Load tokens when indexer becomes available
  $effect(() => {
    if (api.indexer && !hasFetched) {
      hasFetched = true;
      untrack(() => {
        loadTokens();
      });
    }
  });
</script>

<a href="/explore/tokens" class="swap-card">
  <div class="card-content">
    <!-- Header Pill -->
    <div class="pill">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
      <span>Web App</span>
    </div>

    <!-- Title -->
    <h3 class="subtitle">Explore. Swap. Repeat.</h3>

    <!-- Description -->
    <p class="description">
      Discover, research, manage, and swap crypto — all with no fees. Explore ICP tokens.
    </p>

    <!-- CTA Button -->
    <div class="card-button">
      <span>Explore Tokens</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </div>
  </div>

  <!-- Token Rows -->
  <div class="tokens-showcase">
    {#if isLoading}
      {#each Array(4) as _}
        <div class="token-row skeleton">
          <div class="token-info">
            <div class="skeleton-icon"></div>
            <div class="skeleton-text"></div>
          </div>
          <div class="token-price-info">
            <div class="skeleton-price"></div>
          </div>
        </div>
      {/each}
    {:else}
      {#each tokens as token}
        <button
          class="token-row"
          onclick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigateToToken(token.ledger);
          }}
        >
          <div class="token-info">
            <Logo
              src={token.logo ?? undefined}
              alt={token.symbol}
              size="sm"
              circle={true}
            />
            <div class="token-names">
              <span class="token-name">{token.name}</span>
              <span class="token-symbol">{token.symbol}</span>
            </div>
          </div>
          <div class="token-price-info">
            <span class="token-price">{formatTokenPrice(token.price)}</span>
            <span class="token-change" class:positive={token.change24h >= 0} class:negative={token.change24h < 0}>
              {#if token.change24h >= 0}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4l-8 8h5v8h6v-8h5z" />
                </svg>
              {:else}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 20l8-8h-5v-8h-6v8h-5z" />
                </svg>
              {/if}
              {formatPercentChange(token.change24h)}
            </span>
          </div>
        </button>
      {/each}
    {/if}
  </div>
</a>

<style>
  .swap-card {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    border-radius: 32px;
    overflow: hidden;
    background: oklch(from #2ABDFF l c h / 0.12);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    text-decoration: none;
    cursor: pointer;
  }

  .swap-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
  }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 3rem;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    width: fit-content;
    background: oklch(from #2ABDFF l c h / 0.2);
    border-radius: 20px;
    color: #2ABDFF;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .pill svg {
    width: 20px;
    height: 20px;
  }

  .subtitle {
    margin: 1rem 0 0 0;
    font-size: 2rem;
    font-weight: 500;
    line-height: 1.2;
    color: #2ABDFF;
  }

  .description {
    margin: 0.5rem 0 0 0;
    font-size: 1.25rem;
    line-height: 1.5;
    color: #2ABDFF;
    opacity: 0.85;
    max-width: 400px;
  }

  .card-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1.5rem;
    padding: 0.75rem 1.25rem;
    background: var(--card);
    border-radius: 24px;
    color: var(--foreground);
    font-size: 0.9375rem;
    font-weight: 500;
    width: fit-content;
    transition: background 0.15s ease, transform 0.15s ease;
  }

  .swap-card:hover .card-button {
    background: var(--muted);
    transform: scale(1.02);
  }

  /* Token Rows */
  .tokens-showcase {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0 2rem 2rem;
  }

  .token-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    background: var(--card);
    border: none;
    border-radius: 20px;
    transition: background 0.15s ease, transform 0.15s ease;
    cursor: pointer;
    text-align: left;
    width: 100%;
  }

  .token-row:hover {
    background: var(--muted);
    transform: scale(1.02);
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .token-names {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .token-name {
    font-size: 1rem;
    font-weight: 500;
    color: var(--foreground);
    display: none;
  }

  .token-symbol {
    font-size: 1rem;
    font-weight: 500;
    color: var(--muted-foreground);
  }

  .token-price-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .token-price {
    font-size: 1rem;
    font-weight: 500;
    color: var(--foreground);
  }

  .token-change {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .token-change.positive {
    color: var(--color-bullish, #22c55e);
  }

  .token-change.negative {
    color: var(--color-bearish, #ef4444);
  }

  /* Skeleton loading */
  .token-row.skeleton {
    pointer-events: none;
  }

  .skeleton-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--muted);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-text {
    width: 80px;
    height: 16px;
    border-radius: 4px;
    background: var(--muted);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-price {
    width: 60px;
    height: 16px;
    border-radius: 4px;
    background: var(--muted);
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.8; }
  }

  /* Show full name on larger screens */
  @media (min-width: 1024px) {
    .token-name {
      display: block;
    }

    .token-symbol {
      font-size: 0.875rem;
    }
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .card-content {
      padding: 2rem;
    }

    .subtitle {
      font-size: 1.75rem;
    }

    .description {
      font-size: 1.125rem;
    }

    .tokens-showcase {
      padding: 0 1.5rem 1.5rem;
    }

    .token-row {
      padding: 0.875rem 1rem;
    }

    .skeleton-icon {
      width: 32px;
      height: 32px;
    }
  }

  @media (max-width: 640px) {
    .card-content {
      padding: 1.5rem;
    }

    .subtitle {
      font-size: 1.5rem;
    }

    .description {
      font-size: 1rem;
    }

    .tokens-showcase {
      padding: 0 1.5rem 1.5rem;
      gap: 0.375rem;
    }

    .token-row {
      padding: 0.75rem;
      border-radius: 16px;
    }

    .skeleton-icon {
      width: 28px;
      height: 28px;
    }

    .token-price-info {
      gap: 0.5rem;
    }

    .token-change {
      display: none;
    }
  }
</style>
