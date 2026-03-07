<script lang="ts">
  /**
   * ActivityTypeBadge - Displays activity type with category-based color coding
   *
   * Category Colors:
   * - Orders (blue): swap, order_filled, order_partial, order_cancelled, order_modified
   * - Triggers (purple): trigger_fired, trigger_cancelled
   * - LP (green): lp_opened, lp_increased, lp_decreased, lp_closed, lp_fees_collected, lp_locked, lp_transferred
   * - Transfers (gray): transfer_in, transfer_out
   */
  import type { ActivityType } from '$lib/actors/services/spot.service';
  import Badge, { type BadgeVariant } from '$lib/components/ui/Badge.svelte';
  import {
    getActivityTypeLabel,
    getActivityCategory,
  } from '$lib/utils/activity.utils';

  interface Props {
    /** Activity type variant from backend */
    type: ActivityType;
  }

  let { type }: Props = $props();

  const label = $derived(getActivityTypeLabel(type));
  const category = $derived(getActivityCategory(type));

  const variant = $derived.by<BadgeVariant>(() => {
    switch (category) {
      case 'order': return 'blue';
      case 'trigger': return 'purple';
      case 'lp': return 'green';
      case 'transfer':
      default: return 'gray';
    }
  });
</script>

<Badge {variant}>{label}</Badge>
