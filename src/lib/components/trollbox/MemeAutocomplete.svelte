<script lang="ts">
  import { MEMES, type Meme, getFilteredMemes } from "$lib/domain/trollbox";

  let {
    partial = "",
    onSelectMeme,
    isVisible = false,
    position = { x: 0, y: 0 },
  } = $props<{
    partial: string;
    onSelectMeme: (meme: Meme) => void;
    isVisible: boolean;
    position: { x: number; y: number };
  }>();

  let filteredMemes = $state<Meme[]>([]);
  let selectedIndex = $state(0);
  let autocompleteContainer = $state<HTMLDivElement>();

  // Filter memes based on partial input
  $effect(() => {
    if (isVisible && partial) {
      filteredMemes = getFilteredMemes(partial, MEMES);
      selectedIndex = 0;
    } else {
      filteredMemes = [];
    }
  });

  // Scroll selected item into view when selectedIndex changes
  $effect(() => {
    // React to selectedIndex changes
    const currentIndex = selectedIndex;

    if (isVisible && filteredMemes.length > 0 && autocompleteContainer && currentIndex >= 0) {
      const container = autocompleteContainer;
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        const items = container.querySelectorAll(".autocomplete-item");
        const selectedItem = items[currentIndex] as HTMLElement;

        if (selectedItem) {
          const containerHeight = container.clientHeight;
          const itemTop = selectedItem.offsetTop;
          const itemBottom = itemTop + selectedItem.offsetHeight;
          const scrollTop = container.scrollTop;
          const scrollBottom = scrollTop + containerHeight;

          // Scroll down if item is below visible area
          if (itemBottom > scrollBottom) {
            container.scrollTop = itemBottom - containerHeight;
          }
          // Scroll up if item is above visible area
          else if (itemTop < scrollTop) {
            container.scrollTop = itemTop;
          }
        }
      });
    }
  });

  export function handleKeyDown(e: KeyboardEvent) {
    if (!isVisible || filteredMemes.length === 0) return false;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        selectedIndex = Math.max(0, selectedIndex - 1);
        return true;
      case "ArrowDown":
        e.preventDefault();
        selectedIndex = Math.min(filteredMemes.length - 1, selectedIndex + 1);
        return true;
      case "Tab":
      case "Enter":
        e.preventDefault();
        if (filteredMemes[selectedIndex]) {
          onSelectMeme(filteredMemes[selectedIndex]);
        }
        return true;
      case "Escape":
        e.preventDefault();
        return true;
    }
    return false;
  }

  function selectMeme(meme: Meme) {
    onSelectMeme(meme);
  }
</script>

{#if isVisible && filteredMemes.length > 0}
  <div class="meme-autocomplete" bind:this={autocompleteContainer}>
    <div class="autocomplete-list">
      {#each filteredMemes as meme, index}
        <button class="autocomplete-item" class:selected={index === selectedIndex} onclick={() => selectMeme(meme)} onmouseenter={() => (selectedIndex = index)} type="button">
          <img src={meme.url} alt={meme.name} class="autocomplete-image" />
          <span class="autocomplete-shortcode">{meme.shortcode}</span>
          <!-- <span class="autocomplete-name">{meme.name}</span> -->
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .meme-autocomplete {
    position: absolute;
    background: linear-gradient(
      135deg,
      oklch(from var(--card) l c h / 1) 0%,
      oklch(from var(--card) calc(l * 0.95) c h / 1) 100%
    );
    border: 1px solid oklch(from var(--border) l c h / 0.8);
    border-radius: var(--radius-md);
    padding: 4px;
    box-shadow: var(--shadow-elevated);
    min-width: 200px;
    max-width: 280px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 1001;
    left: 0.5rem;
    bottom: calc(100% + 4px);
    animation: slideUp 0.2s ease-out;
  }

  .autocomplete-list {
    display: flex;
    flex-direction: column;
  }

  .autocomplete-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    padding: 0.375rem 0.5rem;
    cursor: pointer;
    transition: background-color 200ms ease-out;
    text-align: left;
    width: 100%;
    white-space: nowrap;
  }

  .autocomplete-item:hover,
  .autocomplete-item.selected {
    background: var(--hover-overlay-subtle);
  }

  .autocomplete-image {
    width: 22px;
    height: 22px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .autocomplete-shortcode {
    color: var(--foreground);
    font-size: 0.75rem;
    font-weight: 500;
    flex-shrink: 0;
  }

  .meme-autocomplete::-webkit-scrollbar {
    width: 4px;
  }

  .meme-autocomplete::-webkit-scrollbar-track {
    background: transparent;
  }

  .meme-autocomplete::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 2px;
  }

  .meme-autocomplete::-webkit-scrollbar-thumb:hover {
    background: var(--muted-foreground);
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
