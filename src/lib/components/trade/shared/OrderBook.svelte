<script lang="ts">
  import { formatToken, formatSigFig } from "$lib/utils/format.utils";
  import Row from "./Row.svelte";
  import OrderSide from "./OrderSide.svelte";
  import OpenInterestBar from "./OpenInterestBar.svelte";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { pricingService } from "$lib/domain/tokens";
  import { getOrderBookTokenUsdPrice } from "$lib/domain/tokens/utils";
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import type { UnifiedOrderBookResponse } from "./orderbook.utils";

  // ✅ Accept book data and market instance
  interface Props {
    book: UnifiedOrderBookResponse;
    market: SpotMarket;
    overrideTokenLogo?: string;
    overrideTokenSymbol?: string;
    overrideTokenDecimals?: number;
    /** Which token's amounts are displayed (for USD calculation) */
    selectedTokenType?: 'base' | 'quote';
  }

  let { book, market, overrideTokenLogo, overrideTokenSymbol, overrideTokenDecimals, selectedTokenType = 'base' }: Props = $props();

  // Derive base and quote for spot markets
  let base = $derived.by(() => {
    if (market.tokens?.[0]) {
      return entityStore.getToken(market.tokens[0].toString());
    }
    return undefined;
  });

  let quote = $derived.by(() => {
    if (market.tokens?.[1]) {
      return entityStore.getToken(market.tokens[1].toString());
    }
    return undefined;
  });

  // Get token logo URL for size column
  let sizeTokenLogo = $derived.by(() => {
    // Use override if provided (for spot token switching)
    if (overrideTokenLogo !== undefined) {
      return overrideTokenLogo;
    }
    // Use canonical logo from token (data URL or file path)
    return base?.logo ?? undefined;
  });

  // Get token symbol for size column header
  let sizeTokenSymbol = $derived.by(() => {
    // Use override if provided (for spot token switching)
    if (overrideTokenSymbol !== undefined) {
      return overrideTokenSymbol;
    }
    return base?.displaySymbol ?? "";
  });

  // Get token decimals for proper formatting
  let sizeTokenDecimals = $derived.by(() => {
    // Use override if provided (for spot token switching)
    if (overrideTokenDecimals !== undefined) {
      return overrideTokenDecimals;
    }
    return base?.decimals ?? 8;
  });

  // Get token price for USD conversion using midpoint and quote token
  // IMPORTANT: Read all reactive deps BEFORE early returns to establish dependency
  let tokenUsdPrice = $derived.by(() => {
    // Read reactive ICP price FIRST (establishes dependency even if we return early)
    const icpPrice = pricingService.icpUsdPrice;

    if (!midpoint || midpoint === 0) return 0n;

    const usdPrice = getOrderBookTokenUsdPrice(
      selectedTokenType,
      midpoint,
      market.activeQuoteToken,
      icpPrice
    );
    return usdPrice ?? 0n;
  });

  // Price to use for total calculation
  let totalPrice = $derived(tokenUsdPrice);

  // Price header label
  const priceHeaderLabel = "Price";

  // Derive midpoint from E12 price (canonical display format - no floating-point loss)
  let midpoint = $derived.by(() => {
    if (book.referencePriceE12 === 0n) return 0;
    return Number(book.referencePriceE12) / 1e12;
  });

  // Flash animation state
  let flashStates = $state(new Map<bigint, string>());
  let prevBidsMap = new Map<bigint, bigint>();
  let prevAsksMap = new Map<bigint, bigint>();
  let prevBookHash = "";

  // Track changes and trigger flashes
  $effect.pre(() => {
    // Create a simple hash of the book data to detect actual changes
    const currentHash = JSON.stringify(book.long.map((r) => ({ rate: r.usd_price.toString(), amount: r.amount.toString() }))) + JSON.stringify(book.short.map((r) => ({ rate: r.usd_price.toString(), amount: r.amount.toString() })));

    // Skip if no actual changes to the book data
    if (currentHash === prevBookHash) return;
    prevBookHash = currentHash;

    // Store previous state before update
    const newPrevBids = new Map<bigint, bigint>();
    const newPrevAsks = new Map<bigint, bigint>();

    book.long.forEach((row) => {
      newPrevBids.set(row.usd_price, row.amount);
    });

    book.short.forEach((row) => {
      newPrevAsks.set(row.usd_price, row.amount);
    });

    // Compare with previous state and set flash classes
    book.long.forEach((row) => {
      const prevAmount = prevBidsMap.get(row.usd_price);
      if (prevAmount === undefined && prevBidsMap.size > 0) {
        // New entry - flash green for new bid
        flashStates.set(row.usd_price, "flash-green");
        setTimeout(() => {
          flashStates.delete(row.usd_price);
          flashStates = flashStates; // Trigger reactivity
        }, 500);
      } else if (prevAmount !== undefined && prevAmount !== row.amount) {
        // Existing entry changed - flash green
        flashStates.set(row.usd_price, "flash-green");
        setTimeout(() => {
          flashStates.delete(row.usd_price);
          flashStates = flashStates; // Trigger reactivity
        }, 500);
      }
    });

    book.short.forEach((row) => {
      const prevAmount = prevAsksMap.get(row.usd_price);
      if (prevAmount === undefined && prevAsksMap.size > 0) {
        // New entry - flash red for new ask
        flashStates.set(row.usd_price, "flash-red");
        setTimeout(() => {
          flashStates.delete(row.usd_price);
          flashStates = flashStates; // Trigger reactivity
        }, 500);
      } else if (prevAmount !== undefined && prevAmount !== row.amount) {
        // Existing entry changed - flash red
        flashStates.set(row.usd_price, "flash-red");
        setTimeout(() => {
          flashStates.delete(row.usd_price);
          flashStates = flashStates; // Trigger reactivity
        }, 500);
      }
    });

    // Update previous state maps
    prevBidsMap = newPrevBids;
    prevAsksMap = newPrevAsks;
  });

  // Format midpoint with 6 significant figures
  const midpointFormatted = $derived.by(() => {
    return formatSigFig(midpoint);
  });

  // Calculate total liquidity for depth visualization (sum of both sides)
  const totalLiquidity = $derived(() => {
    let askTotal = 0n;
    let bidTotal = 0n;

    book.short.forEach((row) => (askTotal += row.amount));
    book.long.forEach((row) => (bidTotal += row.amount));

    return askTotal + bidTotal;
  });

  // Calculate bid/ask liquidity for the liquidity bar
  let openInterestLong = $derived.by(() => {
    // Sum all bid liquidity (total amount available to buy)
    return book.long.reduce((sum, row) => sum + row.amount, 0n);
  });

  let openInterestShort = $derived.by(() => {
    // Sum all ask liquidity (total amount available to sell)
    return book.short.reduce((sum, row) => sum + row.amount, 0n);
  });
</script>

<div class="orderbook-container text-foreground">
  <!-- Column Headers -->
  <div>
    <Row col1={priceHeaderLabel} col2={sizeTokenSymbol} col3="USD" col1Class="text-xs text-muted-foreground" col2Class="text-xs text-muted-foreground" col3Class="text-xs text-muted-foreground" hoverEffect={false} />
  </div>

  <!-- Asks Section -->
  <div class="orderbook-asks">
    <OrderSide rows={book.short} tokenPrice={totalPrice} {flashStates} totalLiquidity={totalLiquidity()} type="asks" emptyMessage="No asks" {sizeTokenLogo} tokenDecimals={sizeTokenDecimals} baseDecimals={market.baseTokenDecimals} quoteDecimals={market.quoteTokenDecimals} />
  </div>

  <!-- Buy/Sell Pressure Bar and Midpoint -->
  <div class="orderbook-midpoint px-3 py-2.5">
    <div class="flex items-center justify-between">
      <!-- Midpoint Display -->
      <div class="flex items-center gap-1">
        <span class="text-lg font-[family-name:var(--font-numeric)] font-bold text-foreground">
          {midpoint ? midpointFormatted : "--"}
        </span>
      </div>
    </div>
  </div>

  <!-- Bids Section -->
  <div class="orderbook-bids">
    <OrderSide rows={book.long} tokenPrice={totalPrice} {flashStates} totalLiquidity={totalLiquidity()} type="bids" emptyMessage="No bids" {sizeTokenLogo} tokenDecimals={sizeTokenDecimals} baseDecimals={market.baseTokenDecimals} quoteDecimals={market.quoteTokenDecimals} />
  </div>

  <!-- Liquidity Distribution Bar (shows bid/ask liquidity balance) - hidden to save space -->
  <!-- <OpenInterestBar {openInterestLong} {openInterestShort} /> -->
</div>

<style>
  /* Flexible height layout for orderbook - adapts to container */
  .orderbook-container {
    height: 100%; /* Fill parent container */
    display: flex;
    flex-direction: column;
    min-height: 0; /* Critical: allows flex children to shrink */
  }

  .orderbook-asks {
    flex: 1; /* Take equal share of available space */
    min-height: 0; /* Allow shrinking below content size */
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end; /* Align to bottom */
  }

  .orderbook-bids {
    flex: 1; /* Take equal share of available space */
    min-height: 0; /* Allow shrinking below content size */
    overflow: hidden;
  }

  .orderbook-midpoint {
    height: 36px; /* Slightly reduced for mobile */
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  /* Flash animations */
  :global(.flash-green) {
    animation: flashGreen 0.5s ease-out;
  }

  :global(.flash-red) {
    animation: flashRed 0.5s ease-out;
  }

  @keyframes flashGreen {
    0% {
      background-color: rgba(34, 197, 94, 0.4);
    }
    100% {
      background-color: transparent;
    }
  }

  @keyframes flashRed {
    0% {
      background-color: rgba(239, 68, 68, 0.4);
    }
    100% {
      background-color: transparent;
    }
  }
</style>
