<script lang="ts">
  /**
   * SideBadge - Displays Buy/Sell side indicator
   *
   * @example
   * ```svelte
   * <SideBadge side="buy" />
   * <SideBadge side={{ buy: null }} />
   * ```
   */
  import Badge from '$lib/components/ui/Badge.svelte';

  interface Props {
    /** Side value - either string or variant object from backend */
    side: 'buy' | 'sell' | { buy: null } | { sell: null };
  }

  let { side }: Props = $props();

  const isBuy = $derived(side === 'buy' || (typeof side === 'object' && 'buy' in side));
</script>

<Badge variant={isBuy ? 'green' : 'red'}>{isBuy ? 'Buy' : 'Sell'}</Badge>
