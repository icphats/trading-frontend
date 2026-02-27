<script lang="ts">
  /**
   * TypeBadge - Displays order/trigger type indicator
   *
   * For trigger types ({above}/{below}), `side` is required to determine color.
   *
   * @example
   * ```svelte
   * <TypeBadge type={{ above: null }} side={{ buy: null }} />
   * <TypeBadge type="market" />
   * ```
   */
  import Badge, { type BadgeVariant } from '$lib/components/ui/Badge.svelte';

  interface Props {
    /** Type value - string or variant object from backend */
    type:
      | 'market'
      | 'limit'
      | { above: null }
      | { below: null };
    /** Side (required when type is a trigger variant — determines color) */
    side?: { buy: null } | { sell: null };
  }

  let { type, side }: Props = $props();

  const isTrigger = $derived(typeof type === 'object');

  const label = $derived.by(() => {
    if (typeof type === 'object') {
      return 'above' in type ? 'Above' : 'Below';
    }
    if (type === 'market') return 'Market';
    if (type === 'limit') return 'Limit';
    return '?';
  });

  const variant = $derived.by<BadgeVariant>(() => {
    if (isTrigger && side) {
      return 'buy' in side ? 'green' : 'red';
    }
    return 'gray';
  });
</script>

<Badge {variant}>{label}</Badge>
