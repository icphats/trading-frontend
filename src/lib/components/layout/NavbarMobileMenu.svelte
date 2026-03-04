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
        <a href="https://x.com/PartyhatsICP" target="_blank" rel="noopener noreferrer" class="social-link x" aria-label="X" onclick={close}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </a>
        <a href="https://discord.gg/3Gvm4JPkxS" target="_blank" rel="noopener noreferrer" class="social-link discord" aria-label="Discord" onclick={close}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
          </svg>
        </a>
        <a href="https://t.me/partyhatsICP" target="_blank" rel="noopener noreferrer" class="social-link telegram" aria-label="Telegram" onclick={close}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
        </a>
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
    background: var(--muted);
  }

  .social-link.x:hover { color: #000; }
  :global(.dark) .social-link.x:hover { color: #fff; }
  .social-link.discord:hover { color: #5865F2; }
  .social-link.telegram:hover { color: #26A5E4; }

  @media (max-width: 767px) {
    .mobile-menu-wrapper {
      display: block;
    }
  }
</style>
