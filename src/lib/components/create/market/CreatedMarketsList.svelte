<script lang="ts">
  import type { CreatedMarketEntry } from "$lib/domain/markets/state/created-markets.svelte";
  import CreatedMarketCard from "./CreatedMarketCard.svelte";

  interface Props {
    markets: CreatedMarketEntry[];
  }

  let { markets }: Props = $props();
</script>

<div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));">
  {#each markets as market (market.id)}
    <CreatedMarketCard {market} />
  {/each}
</div>
