<script lang="ts">
  /**
   * PortalTarget - Renders portal children directly
   *
   * This component is mounted into the portal root by Portal.svelte
   * using Svelte's mount() API, ensuring transitions work correctly.
   */

  import type { Snippet } from "svelte";

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();
</script>

{#if children}
  {@render children()}
{/if}
