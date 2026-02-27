<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { MEMES, type Meme, getFilteredMemes } from "$lib/domain/trollbox";

  let { onSelectMeme, searchTerm = "" } = $props<{
    onSelectMeme: (meme: Meme) => void;
    searchTerm?: string;
  }>();

  let isOpen = $state(false);
  let filteredMemes = $state<Meme[]>([]);
  let dropupRef = $state<HTMLDivElement>();
  let buttonRef = $state<HTMLButtonElement>();

  // Group memes by category
  const memesByCategory = $derived.by(() => {
    const grouped: Record<string, Meme[]> = {
      pepe: [],
      wojak: [],
      other: [],
    };

    const memesToGroup = searchTerm ? filteredMemes : MEMES;

    memesToGroup.forEach((meme) => {
      const category = meme.category;
      if (grouped[category]) {
        grouped[category].push(meme);
      }
    });

    // Remove empty categories
    Object.keys(grouped).forEach((key) => {
      if (grouped[key].length === 0) {
        delete grouped[key];
      }
    });

    return grouped;
  });

  // Filter memes based on search term
  $effect(() => {
    filteredMemes = getFilteredMemes(searchTerm, MEMES);
  });

  function toggleDropup() {
    isOpen = !isOpen;
  }

  function selectMeme(meme: Meme) {
    onSelectMeme(meme);
    isOpen = false;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!isOpen) return;

    if (e.key === "Escape") {
      e.preventDefault();
      isOpen = false;
    }
  }

  function handleClickOutside(e: MouseEvent) {
    if (dropupRef && buttonRef && !dropupRef.contains(e.target as Node) && !buttonRef.contains(e.target as Node)) {
      isOpen = false;
    }
  }

  onMount(() => {
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
  });

  onDestroy(() => {
    document.removeEventListener("click", handleClickOutside);
    document.removeEventListener("keydown", handleKeyDown);
  });

  const BUTTON_ICON = "/assets/memes/pepe/feelsokayman.png";

  // Category display names
  const categoryNames: Record<string, string> = {
    pepe: "Pepe",
    wojak: "Wojak",
    other: "Other",
  };
</script>

<div class="meme-selector">
  <button bind:this={buttonRef} class="meme-button" onclick={toggleDropup} type="button" aria-label="Select meme" aria-expanded={isOpen}>
    <img src={BUTTON_ICON} alt="Memes" class="meme-button-icon" />
  </button>

  {#if isOpen}
    <div bind:this={dropupRef} class="meme-dropup" role="listbox" aria-label="Select a meme">
      {#each Object.entries(memesByCategory) as [category, memes]}
        <div class="meme-category">
          <div class="category-header">{categoryNames[category] || category}</div>
          <div class="meme-grid">
            {#each memes as meme, index}
              <button
                class="meme-option"
                onclick={() => selectMeme(meme)}
                type="button"
                role="option"
                title={`${meme.name} ${meme.shortcode}`}
              >
                <img src={meme.url} alt={meme.name} class="meme-image" loading="lazy" />
              </button>
            {/each}
          </div>
        </div>
      {/each}

      {#if Object.keys(memesByCategory).length === 0}
        <div class="no-memes">No memes found</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .meme-selector {
    position: relative;
    display: inline-block;
  }

  .meme-button {
    background: var(--muted);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 150ms ease, border-color 150ms ease;
    width: 30px;
    height: 30px;
    flex-shrink: 0;
  }

  .meme-button:hover {
    background: var(--field-hover);
    border-color: var(--field-border);
  }

  .meme-button-icon {
    width: 18px;
    height: 18px;
    object-fit: contain;
  }


  .meme-dropup {
    position: absolute;
    bottom: calc(100% + 0.25rem);
    left: 0;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 4px;
    box-shadow: var(--shadow-elevated);
    width: 264px;
    max-height: 280px;
    overflow-y: auto;
    z-index: 1000;
    animation: slideUp 0.2s ease-out;
  }

  .meme-dropup::-webkit-scrollbar {
    width: 4px;
  }

  .meme-dropup::-webkit-scrollbar-track {
    background: transparent;
  }

  .meme-dropup::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 2px;
  }

  .meme-dropup::-webkit-scrollbar-thumb:hover {
    background: var(--muted-foreground);
  }

  @media (max-width: 640px) {
    .meme-dropup {
      width: 240px;
    }
  }

  .meme-category {
    margin-bottom: 2px;
  }

  .meme-category:last-child {
    margin-bottom: 0;
  }

  .category-header {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--muted-foreground);
    text-transform: uppercase;
    margin-bottom: 2px;
    padding: 4px 6px 2px;
    letter-spacing: 0.05em;
  }

  .meme-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    width: 100%;
  }

  .meme-option {
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    padding: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
  }

  .meme-image {
    width: 24px;
    height: 24px;
    object-fit: contain;
    transition: transform 100ms ease;
  }

  .meme-option:hover .meme-image {
    transform: scale(1.25);
  }

  .no-memes {
    text-align: center;
    color: var(--muted-foreground);
    padding: 0.75rem;
    font-size: 0.75rem;
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
