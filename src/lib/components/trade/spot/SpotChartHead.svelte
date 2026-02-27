<script lang="ts">
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import { formatToken, formatSigFig } from "$lib/utils/format.utils";
  import { calculateMarketCap } from "$lib/utils/market-cap.utils";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";

  interface Props {
    spot: SpotMarket;
    infoOpen?: boolean;
    onInfoToggle?: () => void;
  }

  let { spot, infoOpen = false, onInfoToggle }: Props = $props();

  // Price: Use spotPrice (derived from tick - single source of truth)
  const formattedPrice = $derived.by(() => {
    if (spot.spotPrice === 0) return "—";
    return formatSigFig(spot.spotPrice, 5, { subscriptZeros: true });
  });

  // 24h Price Change: Already a float percentage (flat field)
  const priceChange24h = $derived(spot.priceChange24h);

  const formattedPriceChange = $derived.by(() => {
    const change = spot.priceChange24h;
    if (change === 0) return "—";
    const sign = change > 0 ? "+" : "";
    return `${sign}${change.toFixed(2)}%`;
  });

  const isPositiveChange = $derived(priceChange24h > 0);
  const isNegativeChange = $derived(priceChange24h < 0);

  // 24h Volume: Format from E6 USD to human-readable with short suffix
  const formattedVolume = $derived.by(() => {
    if (spot.volume24hUsd === 0n) return "—";
    return formatToken({
      value: spot.volume24hUsd,
      unitName: 6,
      short: true,
    });
  });

  // Pool Depth: live (routed) pools only, base + quote combined
  const formattedPoolDepth = $derived.by(() => {
    const total = spot.poolDepthBaseUsdE6 + spot.poolDepthQuoteUsdE6;
    if (total === 0n) return "—";
    return formatToken({ value: total, unitName: 6, short: true });
  });

  // Market Cap: Uses entityStore as single source of truth
  // - priceUsd comes from indexer (consistent with MarketSelection & Explore pages)
  // - totalSupply fetched during market hydration
  const marketCap = $derived.by(() => {
    const baseLedger = spot.tokens?.[0]?.toString();
    if (!baseLedger) return null;

    const token = entityStore.getToken(baseLedger);
    if (!token?.totalSupply || !token.priceUsd || token.priceUsd === 0n) {
      return null;
    }

    // Use entityStore.priceUsd (from indexer) for consistency across all views
    return calculateMarketCap(token.totalSupply, token.priceUsd, token.decimals);
  });

  // Book Depth: Sum of base + quote book depth in USD (E6)
  const formattedBookDepth = $derived.by(() => {
    const total = spot.bookDepthBaseUsdE6 + spot.bookDepthQuoteUsdE6;
    if (total === 0n) return "—";
    return formatToken({ value: total, unitName: 6, short: true });
  });

  // Market Cap: Format from number to human-readable with short suffix
  const formattedMarketCap = $derived.by(() => {
    if (marketCap === null || marketCap === 0) return "—";
    // Convert to bigint with 8 decimals for formatToken
    const mcapE8 = BigInt(Math.round(marketCap * 1e8));
    return formatToken({
      value: mcapE8,
      unitName: 8,
      short: true,
    });
  });
</script>

<div class="h-full">
  <div class="flex items-center h-full font-[var(--font-numeric)]">
    <!-- Market Data Container -->
    <div class="flex-1 overflow-x-auto">
      <div class="flex items-center gap-8 px-4 min-w-max">
        <!-- Last Trade -->
        <div class="flex flex-col py-2 flex-shrink-0">
          <span class="text-sm text-muted-foreground tracking-wider whitespace-nowrap">Last Trade</span>
          <span class="text-sm text-foreground font-medium font-[var(--font-numeric)] whitespace-nowrap">
            {formattedPrice}
          </span>
        </div>

        <!-- 24h Change -->
        <div class="flex flex-col py-2 flex-shrink-0">
          <span class="text-sm text-muted-foreground tracking-wider whitespace-nowrap">24h Change</span>
          <span
            class="text-sm font-medium font-[var(--font-numeric)] whitespace-nowrap"
            class:text-[var(--color-bullish)]={isPositiveChange}
            class:text-[var(--color-bearish)]={isNegativeChange}
            class:text-foreground={!isPositiveChange && !isNegativeChange}
          >
            {formattedPriceChange}
          </span>
        </div>

        <!-- 24h Volume -->
        <div class="flex flex-col py-2 flex-shrink-0">
          <span class="text-sm text-muted-foreground tracking-wider whitespace-nowrap">24h Volume</span>
          <span class="text-sm text-foreground font-medium font-[var(--font-numeric)] whitespace-nowrap">
            ${formattedVolume}
          </span>
        </div>

        <!-- Book Depth -->
        <div class="flex flex-col py-2 flex-shrink-0">
          <span class="text-sm text-muted-foreground tracking-wider whitespace-nowrap">Book Depth</span>
          <span class="text-sm text-foreground font-medium font-[var(--font-numeric)] whitespace-nowrap">
            ${formattedBookDepth}
          </span>
        </div>

        <!-- Pool Depth -->
        <div class="flex flex-col py-2 flex-shrink-0">
          <span class="text-sm text-muted-foreground tracking-wider whitespace-nowrap">Pool Depth</span>
          <span class="text-sm text-foreground font-medium font-[var(--font-numeric)] whitespace-nowrap">
            ${formattedPoolDepth}
          </span>
        </div>

        <!-- Market Cap -->
        <div class="flex flex-col py-2 flex-shrink-0">
          <span class="text-sm text-muted-foreground tracking-wider whitespace-nowrap">Market Cap</span>
          <span class="text-sm text-foreground font-medium font-[var(--font-numeric)] whitespace-nowrap">
            ${formattedMarketCap}
          </span>
        </div>
      </div>
    </div>

    <!-- Info Toggle -->
    <div class="info-toggle-area">
      <button
        class="info-toggle-btn"
        class:active={infoOpen}
        onclick={() => onInfoToggle?.()}
        title="Market Info"
        aria-label="Toggle Market Info"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
        >
          <line x1="3" y1="13" x2="3" y2="9" />
          <line x1="8" y1="13" x2="8" y2="5" />
          <line x1="13" y1="13" x2="13" y2="2" />
        </svg>
      </button>
    </div>
  </div>
</div>

<style>
  .info-toggle-area {
    display: flex;
    align-items: center;
    margin-right: 0.5rem;
    flex-shrink: 0;
  }

  .info-toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--muted-foreground);
    transition: color 0.15s ease;
  }

  .info-toggle-btn:hover {
    color: var(--foreground);
  }

  .info-toggle-btn.active {
    color: var(--foreground);
    background-color: var(--muted);
  }
</style>
