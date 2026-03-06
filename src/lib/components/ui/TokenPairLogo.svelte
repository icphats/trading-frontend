<script lang="ts">
  import { browser } from "$app/environment";
  import Logo from "./Logo.svelte";
  import type { LogoSize } from "$lib/types/components";

  interface Props {
    baseLogo?: string;
    quoteLogo?: string;
    baseSymbol: string;
    quoteSymbol: string;
    size?: LogoSize;
    ring?: boolean;
  }

  let { baseLogo, quoteLogo, baseSymbol, quoteSymbol, size = "xs", ring = false }: Props = $props();

  const isMobile = browser && window.innerWidth < 768;

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

  const sizeConfigMobile = {
    xxxs: { container: 24, logo: 16, offset: 10 },
    xxs: { container: 28, logo: 20, offset: 12 },
    xs: { container: 33, logo: 22, offset: 15 },
    sm: { container: 39, logo: 28, offset: 18 },
    md: { container: 50, logo: 34, offset: 24 },
    lg: { container: 64, logo: 46, offset: 30 },
    xl: { container: 78, logo: 60, offset: 38 }
  };

  const config = $derived(isMobile ? sizeConfigMobile[size] : sizeConfig[size]);
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
      src={baseLogo}
      alt={baseSymbol}
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
      src={quoteLogo}
      alt={quoteSymbol}
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
