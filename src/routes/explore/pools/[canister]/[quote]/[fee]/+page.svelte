<script lang="ts">
  import { page } from '$app/state';
  import PoolDetail from '$lib/components/explore/PoolDetail.svelte';

  const canister = $derived(page.params.canister);
  const quote = $derived(page.params.quote);
  const fee = $derived(Number(page.params.fee));
</script>

<PoolDetail {canister} {quote} {fee} />
