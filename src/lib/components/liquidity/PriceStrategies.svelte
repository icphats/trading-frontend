<script lang="ts" module>
  export const PriceStrategy = {
    STABLE: 'STABLE',
    WIDE: 'WIDE',
    ONE_SIDED_LOWER: 'ONE_SIDED_LOWER',
    ONE_SIDED_UPPER: 'ONE_SIDED_UPPER',
    FULL_RANGE: 'FULL_RANGE',
    CUSTOM: 'CUSTOM'
  } as const;

  export type PriceStrategyType = typeof PriceStrategy[keyof typeof PriceStrategy];
</script>

<script lang="ts">
  import { tickToPrice, priceToTick } from '$lib/domain/markets/utils';
  import { getTickBoundsForSpacing } from '$lib/domain/markets/utils/ticks';

  interface StrategyConfig {
    key: PriceStrategyType;
    title: string;
    display: string;
    description: string;
  }

  interface Props {
    /** Current price for calculations */
    currentPrice: number;
    /** Current tick */
    currentTick: number;
    /** Token0 decimals */
    baseDecimals?: number;
    /** Token1 decimals */
    quoteDecimals?: number;
    /** Tick spacing */
    tickSpacing?: number;
    /** Currently selected min price */
    minPrice?: number;
    /** Currently selected max price */
    maxPrice?: number;
    /** Callback when strategy is selected */
    onStrategySelect: (tickLower: number, tickUpper: number, strategy: PriceStrategyType) => void;
    /** Whether the component is disabled */
    disabled?: boolean;
    /** Loading state */
    isLoading?: boolean;
  }

  let {
    currentPrice,
    currentTick,
    baseDecimals = 8,
    quoteDecimals = 8,
    tickSpacing = 60,
    minPrice,
    maxPrice,
    onStrategySelect,
    disabled = false,
    isLoading = false
  }: Props = $props();

  const PRICE_TOLERANCE = 0.01; // 1% tolerance for detecting current strategy

  const strategies: StrategyConfig[] = [
    {
      key: PriceStrategy.STABLE,
      title: 'Stable',
      display: '± 3 ticks',
      description: 'For correlated pairs like stablecoins. Very concentrated.'
    },
    {
      key: PriceStrategy.WIDE,
      title: 'Wide',
      display: '-50% — +100%',
      description: 'Broad range for volatile pairs. Lower capital efficiency but less management.'
    },
    {
      key: PriceStrategy.FULL_RANGE,
      title: 'Full Range',
      display: '0 — ∞',
      description: 'Cover all prices. Maximum simplicity, lowest capital efficiency.'
    },
    {
      key: PriceStrategy.ONE_SIDED_LOWER,
      title: 'Below Current',
      display: '-50%',
      description: 'Only earn fees when price drops. Useful for accumulating.'
    },
    {
      key: PriceStrategy.ONE_SIDED_UPPER,
      title: 'Above Current',
      display: '+100%',
      description: 'Only earn fees when price rises. Useful for taking profits.'
    }
  ];

  // Calculate prices for a given strategy
  function calculateStrategyPrices(strategy: PriceStrategyType): { minPrice: number; maxPrice: number } {
    switch (strategy) {
      case PriceStrategy.STABLE: {
        // ±3 ticks from current
        const tickLower = currentTick - (tickSpacing * 3);
        const tickUpper = currentTick + (tickSpacing * 3);
        return {
          minPrice: tickToPrice(tickLower, baseDecimals, quoteDecimals),
          maxPrice: tickToPrice(tickUpper, baseDecimals, quoteDecimals)
        };
      }
      case PriceStrategy.WIDE:
        return {
          minPrice: currentPrice * 0.5,
          maxPrice: currentPrice * 2
        };
      case PriceStrategy.ONE_SIDED_LOWER: {
        // From -50% to just below current
        const tickBelowCurrent = currentTick - tickSpacing;
        return {
          minPrice: currentPrice * 0.5,
          maxPrice: tickToPrice(tickBelowCurrent, baseDecimals, quoteDecimals)
        };
      }
      case PriceStrategy.ONE_SIDED_UPPER: {
        // From just above current to +100%
        const tickAboveCurrent = currentTick + tickSpacing;
        return {
          minPrice: tickToPrice(tickAboveCurrent, baseDecimals, quoteDecimals),
          maxPrice: currentPrice * 2
        };
      }
      case PriceStrategy.FULL_RANGE: {
        const bounds = getTickBoundsForSpacing(tickSpacing);
        return {
          minPrice: tickToPrice(bounds.min, baseDecimals, quoteDecimals),
          maxPrice: tickToPrice(bounds.max, baseDecimals, quoteDecimals)
        };
      }
      default:
        return { minPrice: currentPrice, maxPrice: currentPrice };
    }
  }

  // Detect which strategy matches current selection
  const detectedStrategy = $derived.by((): PriceStrategyType | null => {
    if (!minPrice || !maxPrice) return null;

    for (const strategy of strategies) {
      const expected = calculateStrategyPrices(strategy.key);

      const minDiff = Math.abs(minPrice - expected.minPrice) / expected.minPrice;
      const maxDiff = Math.abs(maxPrice - expected.maxPrice) / expected.maxPrice;

      if (minDiff <= PRICE_TOLERANCE && maxDiff <= PRICE_TOLERANCE) {
        return strategy.key;
      }
    }

    return PriceStrategy.CUSTOM;
  });

  // Handle strategy selection
  function handleSelectStrategy(strategy: PriceStrategyType) {
    if (disabled || isLoading) return;
    if (strategy === detectedStrategy) return;

    const prices = calculateStrategyPrices(strategy);
    const tickLower = priceToTick(prices.minPrice, baseDecimals, quoteDecimals, tickSpacing);
    const tickUpper = priceToTick(prices.maxPrice, baseDecimals, quoteDecimals, tickSpacing);

    onStrategySelect(tickLower, tickUpper, strategy);
  }
</script>

<div class="price-strategies">
  <span class="label">Common Strategies</span>

  <div class="strategies-grid">
    {#if isLoading}
      {#each [1, 2, 3, 4, 5] as i}
        <div class="strategy-card skeleton">
          <div class="skeleton-bar"></div>
        </div>
      {/each}
    {:else}
      {#each strategies as strategy}
        <button
          class="strategy-card"
          class:selected={strategy.key === detectedStrategy}
          class:disabled
          onclick={() => handleSelectStrategy(strategy.key)}
          {disabled}
        >
          <span class="strategy-title">{strategy.title}</span>
          <span class="strategy-display">{strategy.display}</span>
        </button>
      {/each}
    {/if}
  </div>
</div>

<style>
  .price-strategies {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .label {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground);
  }

  .strategies-grid {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .strategies-grid::-webkit-scrollbar {
    display: none;
  }

  .strategy-card {
    flex: 0 0 auto;
    min-width: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 6px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .strategy-card:hover:not(.disabled):not(.selected) {
    background: var(--muted);
  }

  .strategy-card.selected {
    border-color: var(--ring);
  }

  .strategy-card.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .strategy-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--foreground);
  }

  .strategy-display {
    font-size: 11px;
    font-weight: 500;
    color: var(--muted-foreground);
  }

  /* Skeleton loading */
  .strategy-card.skeleton {
    cursor: default;
    pointer-events: none;
    min-width: 80px;
    height: 48px;
  }

  .skeleton-bar {
    background: var(--muted);
    border-radius: 4px;
    width: 60%;
    height: 12px;
    animation: shimmer 1.5s infinite;
  }

  @keyframes shimmer {
    0% { opacity: 0.5; }
    50% { opacity: 0.8; }
    100% { opacity: 0.5; }
  }
</style>
