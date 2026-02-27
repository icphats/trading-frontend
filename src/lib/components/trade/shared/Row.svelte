<script lang="ts">
  import Logo from "$lib/components/ui/Logo.svelte";

  interface Props {
    col1: string;
    col2: string;
    col3: string;
    src1?: string;
    src2?: string;
    src3?: string;
    col1Class?: string;
    col2Class?: string;
    col3Class?: string;
    flashClass?: string;
    depthPercentage?: number;
    depthColor?: string;
    hoverEffect?: boolean;
  }

  let { col1, col2, col3, src1, src2, src3, col1Class = "", col2Class = "", col3Class = "", flashClass = "", depthPercentage = 0, depthColor = "", hoverEffect = true }: Props = $props();
</script>

<div class="group relative my-[2px] {hoverEffect ? 'hover:bg-muted/50' : ''} transition-colors duration-[var(--transition-price)] {flashClass}">
  {#if depthPercentage > 0}
    <!-- Depth Bar Background (for OrderBook) -->
    <div class="absolute inset-0 pointer-events-none" style="background-color: {depthColor}25; width: {depthPercentage}%;"></div>
  {/if}
  <!-- Row Data -->
  <div class="relative grid grid-cols-3 items-center px-3 py-[var(--spacing-orderbook)] text-[length:var(--font-size-orderbook)] font-[family-name:var(--font-numeric)]">
    <div class={col1Class}>
      {#if src1}
        <div class="flex items-center gap-1">
          <span>{col1}</span>
          <Logo src={src1} alt={col1} size="xxxs" circle={true} />
        </div>
      {:else}
        {col1}
      {/if}
    </div>
    <div class="{col2Class} text-right">
      {#if src2}
        <div class="flex items-center justify-end gap-1">
          <span>{col2}</span>
          <Logo src={src2} alt={col2} size="xxxs" circle={true} />
        </div>
      {:else}
        {col2}
      {/if}
    </div>
    <div class="{col3Class} text-right">
      {#if src3}
        <div class="flex items-center justify-end gap-1">
          <span>{col3}</span>
          <Logo src={src3} alt={col3} size="xxxs" circle={true} />
        </div>
      {:else}
        {col3}
      {/if}
    </div>
  </div>
</div>
