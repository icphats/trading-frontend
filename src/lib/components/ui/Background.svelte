<script lang="ts">
  import { getElementConfig, generateKeyframesCSS, srcArray } from "./backgroundAnimations";
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { page } from "$app/state";

  interface FloatingElement {
    src: string;
    keyframes: string;
    size: number;
    blur: number;
    style: string;
  }

  let elementsReady = $state(false);
  let floatingElements = $state<FloatingElement[]>([]);

  let showBackground = $derived(page.url.pathname === "/");

  // Blur calculation based on Uniswap's approach:
  // - Center zone gets more blur (content area)
  // - Smaller elements get more blur (depth effect)
  // - Top area also gets more blur
  function calculateBlur(x: number, y: number, size: number): number {
    // Center zone: 30-70% of screen width (where main content sits)
    const inCenterZone = x > 30 && x < 70;
    const nearTop = y < 15;

    // Base blur inversely proportional to size (smaller = more blur)
    const baseBlur = (1 / size) * 400;

    // Multiply blur in center/top zones
    const zoneMultiplier = (inCenterZone || nearTop) ? 4 : 1;

    return baseBlur * zoneMultiplier;
  }

  // Opacity variation based on position
  function calculateOpacity(x: number, y: number): number {
    const inCenterZone = x > 30 && x < 70;
    const nearTop = y < 15;

    // Base opacity between 0.6-1.0
    const baseOpacity = 0.6 + (Math.random() * 0.4);

    // Reduce opacity in center zone
    return baseOpacity * ((inCenterZone || nearTop) ? 0.7 : 1);
  }

  // Random size variation (20-40px base)
  function calculateSize(index: number): number {
    // Use index to create deterministic but varied sizes
    return 20 + ((index * 7) % 20);
  }

  function generateFloatingElements() {
    const isMobile = window.innerWidth < 768;
    return srcArray.map((src, index) => {
      const config = getElementConfig(index);
      const animationName = `float${index}`;
      const size = calculateSize(index);
      const blur = isMobile ? 0 : calculateBlur(config.x, config.y, size);
      const opacity = calculateOpacity(config.x, config.y);

      const keyframes = generateKeyframesCSS(config, animationName);

      return {
        src,
        keyframes,
        size,
        blur,
        style: `
          left: ${config.x}%;
          top: ${config.y}%;
          animation: ${animationName} ${config.duration}s infinite alternate;
          opacity: ${opacity.toFixed(2)};
          ${blur > 0 ? `filter: blur(${blur.toFixed(1)}px);` : ''}
          width: ${size}px;
          height: ${size}px;
        `,
      };
    });
  }

  function injectKeyframes(elements: FloatingElement[]) {
    // Create a single style element with all keyframes at once
    let styleSheet = document.getElementById("floating-keyframes");
    if (!styleSheet) {
      styleSheet = document.createElement("style");
      styleSheet.id = "floating-keyframes";
      document.head.appendChild(styleSheet);
    }

    // Join all keyframes into a single string and inject once
    const allKeyframes = elements.map((el: FloatingElement) => el.keyframes).join("\n");
    styleSheet.textContent = allKeyframes;
  }

  onMount(() => {
    if (srcArray.length > 0) {
      // Use pre-generated static values
      const elements = generateFloatingElements();
      injectKeyframes(elements);

      // Apply a short delay to ensure DOM is ready and styles are applied
      floatingElements = elements;
      elementsReady = true;
    }
  });

  onDestroy(() => {
    // Clean up injected styles to prevent memory leak
    if (browser) {
      const styleSheet = document.getElementById("floating-keyframes");
      if (styleSheet) {
        styleSheet.remove();
      }
    }
  });
</script>

<div id="background" class="fixed w-full h-full overflow-hidden pointer-events-none" style="z-index: -10;">
  {#if elementsReady && showBackground}
    {#each floatingElements as element}
      <div
        class="absolute transition-[filter,opacity] duration-150"
        style={element.style}
      >
        <img src={element.src} alt="" class="w-full h-full" />
      </div>
    {/each}
  {/if}
</div>
