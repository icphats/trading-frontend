<script lang="ts">
  import { page } from "$app/stores";
  import TokenAnalytics from '$lib/components/tokens/TokenAnalytics.svelte';

  const canisterId = $derived($page.params.canisterId);
</script>

<TokenAnalytics {canisterId} />
