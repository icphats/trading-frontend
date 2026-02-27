<script lang="ts">
  /**
   * StatusBadge - Displays status indicator for orders/triggers
   *
   * @example
   * ```svelte
   * <StatusBadge status="filled" />
   * <StatusBadge status={{ active: null }} />
   * ```
   */
  import Badge, { type BadgeVariant } from '$lib/components/ui/Badge.svelte';

  interface Props {
    /** Status value - string or variant object from backend */
    status:
      | 'active'
      | 'pending'
      | 'filled'
      | 'partial'
      | 'cancelled'
      | 'triggered'
      | 'modified'
      | 'failed'
      | 'complete'
      | { active: null }
      | { pending: null }
      | { filled: null }
      | { partial: null }
      | { cancelled: null }
      | { triggered: null };
  }

  let { status }: Props = $props();

  const statusKey = $derived.by(() => {
    if (typeof status === 'string') return status;
    if ('active' in status) return 'active';
    if ('pending' in status) return 'pending';
    if ('filled' in status) return 'filled';
    if ('partial' in status) return 'partial';
    if ('cancelled' in status) return 'cancelled';
    if ('triggered' in status) return 'triggered';
    return 'unknown';
  });

  const label = $derived(statusKey.charAt(0).toUpperCase() + statusKey.slice(1));

  const variant = $derived.by<BadgeVariant>(() => {
    switch (statusKey) {
      case 'filled':
      case 'triggered':
        return 'green';
      case 'partial':
      case 'modified':
        return 'orange';
      case 'failed':
        return 'red';
      case 'complete':
        return 'green';
      case 'cancelled':
        return 'gray';
      case 'active':
      case 'pending':
      default:
        return 'gray';
    }
  });
</script>

<Badge {variant}>{label}</Badge>
