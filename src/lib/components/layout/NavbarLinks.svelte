<script lang="ts">
  import { browser } from "$app/environment";

  const links = [
    { href: '/trade', label: 'Trade' },
    { href: '/portfolio', label: 'Portfolio' },
    { href: '/explore', label: 'Explore' }
  ];

  // Dropdown state
  let createDropdownOpen = $state(false);
  let closeTimeout: ReturnType<typeof setTimeout> | null = null;

  const createOptions = [
    { href: '/create/token', label: 'Token' },
    { href: '/create/market', label: 'Market' }
  ];

  function openDropdown() {
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = null;
    }
    createDropdownOpen = true;
  }

  function scheduleClose() {
    closeTimeout = setTimeout(() => {
      createDropdownOpen = false;
      closeTimeout = null;
    }, 150); // 150ms delay before closing
  }

  function closeDropdown() {
    createDropdownOpen = false;
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = null;
    }
  }

  // Handle keyboard navigation
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeDropdown();
    }
  }

  // Effect to add/remove keyboard listener
  $effect(() => {
    if (!browser) return;

    if (createDropdownOpen) {
      document.addEventListener('keydown', handleKeydown);
    } else {
      document.removeEventListener('keydown', handleKeydown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      if (closeTimeout) {
        clearTimeout(closeTimeout);
      }
    };
  });
</script>

<div class="flex items-center gap-3">
  {#each links as link}
    <a
      href={link.href}
      class="nav-link"
    >
      {link.label}
    </a>
  {/each}

  <!-- Create Dropdown -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    id="create-dropdown-container"
    class="relative"
    onmouseenter={openDropdown}
    onmouseleave={scheduleClose}
  >
    <div
      class="nav-link flex items-center gap-1 cursor-pointer"
      aria-haspopup="true"
      aria-expanded={createDropdownOpen}
    >
      Create
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="chevron"
        class:rotate={createDropdownOpen}
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </div>

    {#if createDropdownOpen}
      <div class="create-dropdown" role="menu">
        {#each createOptions as option (option.href)}
          <a
            href={option.href}
            class="dropdown-item"
            role="menuitem"
          >
            <span class="dropdown-label">{option.label}</span>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  /* Nav link styling (matching Uniswap subheading1) */
  .nav-link {
    font-family: 'Basel', sans-serif;
    font-size: 19px;
    line-height: 24px;
    font-weight: 485;
    color: var(--muted-foreground);
    text-decoration: none;
    padding: 8px;
    transition: color 200ms ease-out;
    user-select: none;
  }

  .nav-link:hover {
    color: var(--foreground);
  }

  /* Chevron rotation animation */
  .chevron {
    transition: transform 200ms ease-out;
  }

  .chevron.rotate {
    transform: rotate(180deg);
  }

  /* Create dropdown */
  .create-dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 50%;
    transform: translateX(-50%);
    width: auto;
    min-width: 120px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: var(--shadow-elevated);
    overflow: hidden;
    z-index: 9999;
    animation: slideDown 0.2s ease-out;
  }

  /* Dropdown item */
  .dropdown-item {
    display: block;
    padding: 0.5rem 1rem;
    background: transparent;
    transition: background-color 200ms ease-out;
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
  }

  .dropdown-item:hover {
    background: var(--hover-overlay-strong);
  }

  .dropdown-label {
    font-family: 'Basel', sans-serif;
    font-size: 16px;
    font-weight: 485;
    color: var(--foreground);
  }

  /* Slide down animation */
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
</style>
