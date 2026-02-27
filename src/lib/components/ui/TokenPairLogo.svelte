<script lang="ts">
  import Logo from "./Logo.svelte";
  import type { LogoSize } from "$lib/types/components";

  interface Props {
    token0Logo?: string;
    token1Logo?: string;
    token0Symbol: string;
    token1Symbol: string;
    size?: LogoSize;
    ring?: boolean;
  }

  let { token0Logo, token1Logo, token0Symbol, token1Symbol, size = "xs", ring = false }: Props = $props();

  // Size mapping for proper overlap
  const sizeConfig = {
    xxxs: { container: 24, logo: 16, offset: 10 },
    xxs: { container: 28, logo: 20, offset: 12 },
    xs: { container: 36, logo: 24, offset: 16 },
    sm: { container: 44, logo: 32, offset: 20 },
    md: { container: 60, logo: 40, offset: 28 },
    lg: { container: 76, logo: 56, offset: 36 },
    xl: { container: 92, logo: 72, offset: 44 }
  };

  const config = $derived(sizeConfig[size]);
</script>

<div
  class="token-pair-container"
  style="width: {config.container}px; height: {config.logo}px;"
>
  <!-- Token 0 (back) -->
  <div
    class="token-logo token-0"
    style="left: 0;"
  >
    <Logo
      src={token0Logo}
      alt={token0Symbol}
      {size}
      {ring}
    />
  </div>

  <!-- Token 1 (front, overlapping) -->
  <div
    class="token-logo token-1"
    style="left: {config.offset}px;"
  >
    <Logo
      src={token1Logo}
      alt={token1Symbol}
      {size}
      {ring}
    />
  </div>
</div>

<style>
  .token-pair-container {
    position: relative;
    display: flex;
    align-items: center;
  }

  .token-logo {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
  }

  .token-0 {
    z-index: 1;
  }

  .token-1 {
    z-index: 2;
  }

  /* Hover effect: slight separation */
  .token-pair-container:hover .token-0 {
    transform: translateX(-2px);
  }

  .token-pair-container:hover .token-1 {
    transform: translateX(2px);
  }
</style>
