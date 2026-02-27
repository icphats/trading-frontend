<script lang="ts">
  import { formatToken, formatSigFig } from "$lib/utils/format.utils";
  import { tickToPrice } from "$lib/domain/markets/utils";
  import Row from "./Row.svelte";
  import type { UnifiedOrderBookRow } from "./orderbook.utils";

  interface Props {
    rows: UnifiedOrderBookRow[];
    tokenPrice: bigint;
    flashStates: Map<bigint, string>;
    totalLiquidity: bigint;
    type: "asks" | "bids";
    emptyMessage?: string;
    sizeTokenLogo?: string; // Logo URL (data URL or file path) for the size token
    tokenDecimals?: number; // Number of decimals for the size token (default 8)
    baseDecimals?: number; // Base token decimals for tick→price conversion
    quoteDecimals?: number; // Quote token decimals for tick→price conversion
  }

  let { rows = [], tokenPrice, flashStates, totalLiquidity, type, emptyMessage = `No ${type}`, sizeTokenLogo, tokenDecimals = 8, baseDecimals = 8, quoteDecimals = 8 }: Props = $props();

  const formatPriceDisplay = (row: UnifiedOrderBookRow): string => {
    // Use tick-based precision for price display
    if (row.tick !== undefined) {
      const price = tickToPrice(row.tick, baseDecimals, quoteDecimals);
      // Use formatSigFig for consistent 6 significant figures
      return formatSigFig(price, 5, { subscriptZeros: true });
    }

    // Fallback to usd_price - convert from E12 (12 decimal) bigint
    if (!row.usd_price) return "--";
    const price = Number(row.usd_price) / 1e12;
    return formatSigFig(price, 5, { subscriptZeros: true });
  };

  const formatTotal = (tokenPrice: bigint, amount: bigint): string => {
    if (!tokenPrice) return "--";
    // Calculate total USD value (price * amount)
    // tokenPrice is E12 (12 decimals), amount is in tokenDecimals
    // Result: price (12 dec) × amount (tokenDecimals) = value (12 + tokenDecimals decimals)
    let value = tokenPrice * amount;
    const totalDecimals = 12 + tokenDecimals; // tokenPrice decimals (E12) + token amount decimals
    return `$${formatToken({ value: value, unitName: totalDecimals, displayDecimals: 2 })}`;
  };

  // Calculate cumulative totals
  const rowsWithTotal = $derived(() => {
    let cumulative = 0n;
    const withTotals = rows.map((row, index) => {
      cumulative += row.amount;
      return { ...row, cumulativeAmount: cumulative, index };
    });

    // Reverse asks for display (lowest prices at bottom)
    return type === "asks" ? withTotals.reverse() : withTotals;
  });

  // Calculate depth as percentage of total liquidity
  const getDepthPercentage = (cumulative: bigint): number => {
    if (totalLiquidity === 0n) return 0;
    const percentage = (Number(cumulative) / Number(totalLiquidity)) * 100;
    return percentage;
  };

  const colorClass = $derived(type === "asks" ? "text-[color:var(--color-bearish)]" : "text-[color:var(--color-bullish)]");

  const depthColor = $derived(type === "asks" ? "#ef4444" : "#22c55e");
</script>

<div class="relative">
  {#each rowsWithTotal() as row (row.usd_price + "-" + row.index)}
    <Row
      col1={formatPriceDisplay(row)}
      col2={formatToken({ value: row.amount, unitName: tokenDecimals, short: true })}
      col3={formatTotal(tokenPrice, row.amount)}
      src2={sizeTokenLogo}
      col1Class="{colorClass} font-[number:var(--font-weight-price)]"
      col2Class="text-foreground"
      col3Class="text-muted-foreground"
      flashClass={flashStates.get(row.usd_price) || ""}
      depthPercentage={getDepthPercentage(row.cumulativeAmount)}
      {depthColor}
    />
  {:else}
    <div class="flex items-center justify-center py-8 text-xs text-muted-foreground">{emptyMessage}</div>
  {/each}
</div>
