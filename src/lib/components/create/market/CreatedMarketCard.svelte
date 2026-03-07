<script lang="ts">
  import { goto } from "$app/navigation";
  import type { CreatedMarketEntry } from "$lib/domain/markets/state/created-markets.svelte";
  import CopyableId from "$lib/components/ui/CopyableId.svelte";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";

  interface Props {
    market: CreatedMarketEntry;
  }

  let { market }: Props = $props();

  let createdDate = $derived(
    new Date(Number(market.startedAt / 1_000_000n)).toLocaleDateString()
  );

  let tradeHref = $derived(`/trade/${market.symbol.replace("/", "-")}`);

  function handleTrade() {
    goto(tradeHref);
  }
</script>

<div
  class="block bg-[var(--background)] border border-[var(--border)] rounded-2xl p-5 space-y-4 text-inherit transition-colors hover:border-[var(--border-hover)]"
>
  <div class="flex items-center gap-3">
    <div class="min-w-0">
      <div class="font-semibold truncate text-lg">{market.symbol}</div>
      <div class="text-sm text-[color:var(--muted-foreground)]">Spot Market</div>
    </div>
  </div>

  <div class="space-y-2 text-sm">
    <div class="flex justify-between">
      <span class="text-[color:var(--muted-foreground)]">Canister ID</span>
      <CopyableId id={market.canisterId} variant="inline" mono />
    </div>
    <div class="flex justify-between">
      <span class="text-[color:var(--muted-foreground)]">Created</span>
      <span>{createdDate}</span>
    </div>
  </div>

  <div class="flex gap-2">
    <ButtonV2 variant="primary" size="sm" fullWidth onclick={handleTrade}>
      Trade
    </ButtonV2>
  </div>
</div>
