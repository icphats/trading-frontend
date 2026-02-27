<script lang="ts">
  let open = $state(false);

  const navLinks = [
    { href: '/trade', label: 'Trade' },
    { href: '/portfolio', label: 'Portfolio' },
    { href: '/explore', label: 'Explore' }
  ];

  const createLinks = [
    { href: '/create/token', label: 'Token' },
    { href: '/create/market', label: 'Market' }
  ];

  function toggle() {
    open = !open;
  }

  function close() {
    open = false;
  }

  // Close when clicking outside or pressing Escape
  $effect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".mobile-menu-wrapper")) {
        open = false;
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        open = false;
      }
    };

    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  });
</script>

<div class="mobile-menu-wrapper">
  <button
    class="hamburger-button"
    onclick={toggle}
    aria-label="Menu"
    aria-expanded={open}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  </button>

  {#if open}
    <div class="dropdown-panel mobile-menu-dropdown">
      <!-- Navigation Section -->
      <div class="mobile-menu-section">
        <div class="mobile-menu-section-title">Navigate</div>
        <div class="mobile-menu-grid">
          {#each navLinks as link}
            <a href={link.href} class="mobile-menu-link" onclick={close}>
              {link.label}
            </a>
          {/each}
        </div>
      </div>

      <!-- Create Section -->
      <div class="mobile-menu-section">
        <div class="mobile-menu-section-title">Create</div>
        <div class="mobile-menu-grid">
          {#each createLinks as link}
            <a href={link.href} class="mobile-menu-link" onclick={close}>
              {link.label}
            </a>
          {/each}
        </div>
      </div>

      <!-- Divider -->
      <div class="mobile-menu-divider"></div>

      <!-- Social Links -->
      <div class="mobile-social-links">
        <button type="button" class="social-link" aria-label="GitHub" onclick={close}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </button>
        <button type="button" class="social-link" aria-label="X (Twitter)" onclick={close}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </button>
        <button type="button" class="social-link" aria-label="Discord" onclick={close}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
          </svg>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .mobile-menu-wrapper {
    display: none;
    position: relative;
  }

  .hamburger-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: transparent;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    color: var(--muted-foreground);
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .hamburger-button:hover {
    background: var(--muted);
    color: var(--foreground);
  }

  .mobile-menu-dropdown {
    left: 0;
    min-width: 280px;
    max-height: calc(100vh - var(--navbar-height) - 24px);
    overflow-y: auto;
    padding: 16px;
  }

  .mobile-menu-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .mobile-menu-section:not(:last-child) {
    margin-bottom: 16px;
  }

  .mobile-menu-section-title {
    font-size: 12px;
    font-weight: 535;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
    padding: 0 8px 8px 8px;
  }

  .mobile-menu-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
  }

  .mobile-menu-link {
    display: flex;
    align-items: center;
    padding: 12px 8px;
    border-radius: 12px;
    font-family: var(--font-sans);
    font-size: 16px;
    font-weight: 485;
    color: var(--foreground);
    text-decoration: none;
    transition: background-color 0.15s ease;
  }

  .mobile-menu-link:hover {
    background: var(--muted);
  }

  .mobile-menu-divider {
    height: 1px;
    background: var(--border);
    margin: 8px 0 16px 0;
  }

  .mobile-social-links {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 16px;
  }

  .social-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    color: var(--muted-foreground);
    text-decoration: none;
    border-radius: 8px;
    transition: color 0.15s ease, background-color 0.15s ease;
  }

  .social-link:hover {
    color: var(--foreground);
    background: var(--muted);
  }

  @media (max-width: 767px) {
    .mobile-menu-wrapper {
      display: block;
    }
  }
</style>
