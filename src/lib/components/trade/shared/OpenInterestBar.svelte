<script lang="ts">
  /**
   * OpenInterestBar Component
   *
   * Visualization of bid/ask liquidity distribution
   * Shows the balance between buy and sell liquidity in the order book
   */

  interface Props {
    openInterestLong: bigint;
    openInterestShort: bigint;
  }

  let { openInterestLong, openInterestShort }: Props = $props();

  let openInterestSum = $derived(Number(openInterestLong + openInterestShort));
  let longValue = $derived(Number(openInterestLong));
  let shortValue = $derived(Number(openInterestShort));

  let longPercentage = $derived(openInterestSum > 0 ? longValue / openInterestSum : 0);
  let shortPercentage = $derived(openInterestSum > 0 ? shortValue / openInterestSum : 0);
</script>

<div class="oi-bar-container">
  {#if openInterestSum > 0}
    <div class="oi-bar-track">
      <!-- Long/Bullish side (green) -->
      <div
        class="oi-bar-segment oi-bar-long"
        style="width: calc({(longPercentage * 100).toFixed(2)}% - 1px);"
      >
        {#if longPercentage > 0.05}
          <span class="oi-bar-label">
            {(longPercentage * 100).toFixed(1)}%
          </span>
        {/if}
      </div>

      <!-- Short/Bearish side (red) -->
      <div
        class="oi-bar-segment oi-bar-short"
        style="width: calc({(shortPercentage * 100).toFixed(2)}% - 1px);"
      >
        {#if shortPercentage > 0.05}
          <span class="oi-bar-label">
            {(shortPercentage * 100).toFixed(1)}%
          </span>
        {/if}
      </div>
    </div>
  {:else}
    <!-- No open interest state -->
    <div class="oi-bar-empty">
      <span class="text-xs" style="color: var(--muted-foreground);">No Open Interest</span>
    </div>
  {/if}
</div>

<style>
  /* Container */
  .oi-bar-container {
    position: relative;
    width: 100%;
    height: 28px;
    display: flex;
    align-items: center;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  /* Track */
  .oi-bar-track {
    position: relative;
    width: 100%;
    height: 18px;
    overflow: hidden;
    border-radius: var(--radius-lg);
    background: rgba(0, 0, 0, 0.05);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  /* Segment base styles */
  .oi-bar-segment {
    position: absolute;
    top: 0;
    height: 100%;
    display: flex;
    align-items: center;
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    backdrop-filter: blur(12px);
    transition: width var(--transition-flash) ease-out;
  }

  /* Long/Bullish segment (left-aligned) */
  .oi-bar-long {
    left: 0;
    justify-content: flex-start;
    border-right: 1px solid rgba(255, 255, 255, 0.2);
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--color-bullish) 60%, transparent),
      color-mix(in srgb, var(--color-bullish) 40%, transparent)
    );
  }

  /* Short/Bearish segment (right-aligned) */
  .oi-bar-short {
    right: 0;
    justify-content: flex-end;
    border-left: 1px solid rgba(255, 255, 255, 0.2);
    background: linear-gradient(
      270deg,
      color-mix(in srgb, var(--color-bearish) 60%, transparent),
      color-mix(in srgb, var(--color-bearish) 40%, transparent)
    );
  }

  /* Label */
  .oi-bar-label {
    font-family: var(--font-numeric);
    font-size: 0.75rem;
    font-weight: 700;
    color: white;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  }

  /* Empty state */
  .oi-bar-empty {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
