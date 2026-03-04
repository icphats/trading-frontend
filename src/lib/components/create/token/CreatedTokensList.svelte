<script lang="ts">
  import type { NormalizedToken } from "$lib/types/entity.types";
  import CreatedTokenCard from "./CreatedTokenCard.svelte";

  interface Props {
    tokens: NormalizedToken[];
  }

  let { tokens }: Props = $props();
</script>

<div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));">
  {#each tokens as token (token.canisterId)}
    <CreatedTokenCard {token} />
  {/each}
</div>
