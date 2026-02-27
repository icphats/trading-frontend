<script lang="ts">
  import { formatPrice, formatVolume, formatTokenRatio, formatChange, getChangeClass } from '../core/chart.format';

  type DisplayMode = 'price' | 'volume' | 'ratio';

  interface Props {
    value: number;
    change: number;
    mode?: DisplayMode;
    token0Symbol?: string;
    token1Symbol?: string;
  }

  let {
    value,
    change,
    mode = 'price',
    token0Symbol = '',
    token1Symbol = '',
  }: Props = $props();

  const formattedValue = $derived(() => {
    switch (mode) {
      case 'volume':
        return formatVolume(value);
      case 'ratio':
        return formatTokenRatio(value);
      default:
        return formatPrice(value);
    }
  });

  const changeClass = $derived(getChangeClass(change));
</script>

<div class="price-overlay">
  <div class="price-value">{formattedValue()}</div>

  <span class="price-change {changeClass}">
    {formatChange(change)}
  </span>
</div>

<style>
  .price-overlay {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 4px;
    pointer-events: none;
  }

  .price-value {
    font-family: 'Basel', sans-serif;
    font-size: 36px;
    line-height: 44px;
    font-weight: 500;
    color: var(--foreground);
  }

  .price-change {
    font-family: 'Basel', sans-serif;
    font-size: 17px;
    line-height: 22px;
    font-weight: 485;
    padding: 4px 8px;
    border-radius: 8px;
    width: fit-content;
  }

  .price-change.positive {
    color: var(--color-bullish, #22c55e);
    background: rgba(34, 197, 94, 0.12);
  }

  .price-change.negative {
    color: var(--color-bearish, #ef4444);
    background: rgba(239, 68, 68, 0.12);
  }

  .price-change.neutral {
    color: var(--muted-foreground);
    background: var(--muted);
  }

  @media (max-width: 768px) {
    .price-value {
      font-size: 28px;
      line-height: 36px;
    }
  }
</style>
