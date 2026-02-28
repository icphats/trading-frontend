<script lang="ts">
  import { page } from "$app/stores";
  import { user } from "$lib/domain/user/auth.svelte";
  import { app } from "$lib/state/app.state.svelte";
  import NavbarLogo from "./NavbarLogo.svelte";
  import NavbarLinks from "./NavbarLinks.svelte";
  import NavbarGlobalSearchModal from "./NavbarGlobalSearchModal.svelte";
  import CashierModal from "$lib/components/portal/modals/CashierModal.svelte";
  import { AccountDrawer, accountDrawer } from "$lib/components/portal/drawers/specific/AccountDrawer";
  import { trollboxDrawer } from "$lib/components/portal/drawers/specific/TrollboxDrawer";

  function handleThemeToggle() {
    app.setThemeMode(app.themeMode === 'dark' ? 'light' : 'dark');
  }

  let isCashierModalOpen = $state(false);
  // Theme toggle (cycles light ↔ dark)
  let isSearchOpen = $state(false);
  let isMobileMenuOpen = $state(false);

  // Scroll detection for navbar styling
  let isScrolledDown = $state(false);

  // Show background on all pages except landing page (and when not scrolled)
  let isLandingPage = $derived($page.url.pathname === "/");
  let isHeaderTransparent = $derived(!isScrolledDown && isLandingPage);
  let navHasBottomBorder = $derived(isScrolledDown);

  function openSearch() {
    isSearchOpen = true;
  }

  function closeSearch() {
    isSearchOpen = false;
  }

  function toggleMobileMenu() {
    isMobileMenuOpen = !isMobileMenuOpen;
  }

  function handleConnect() {
    // Open AccountDrawer which shows WalletModal when not authenticated
    accountDrawer.open();
  }

  function handleLogout() {
    user.logout();
  }

  function handleWallet() {
    isCashierModalOpen = true;
  }

  function handleCashierClose() {
    isCashierModalOpen = false;
  }

  // Navigation links for mobile menu
  const navLinks = [
    { href: '/trade', label: 'Trade' },
    { href: '/portfolio', label: 'Portfolio' },
    { href: '/explore', label: 'Explore' }
  ];

  const createLinks = [
    { href: '/create/token', label: 'Token' },
    { href: '/create/market', label: 'Market' }
  ];

  // Close mobile menu
  function closeMobileMenu() {
    isMobileMenuOpen = false;
  }


  // Close mobile menu when clicking outside
  $effect(() => {
    if (!isMobileMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".mobile-menu-wrapper")) {
        isMobileMenuOpen = false;
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        isMobileMenuOpen = false;
      }
    };

    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  });

  // Keyboard shortcut: "/" to open search
  $effect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.key === "/" && !isSearchOpen) {
        event.preventDefault();
        openSearch();
      }
    };

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  });

  // Scroll detection for navbar background/border
  $effect(() => {
    let rafId: number | null = null;

    const updateScrollState = () => {
      isScrolledDown = window.scrollY > 0;
      rafId = null;
    };

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(updateScrollState);
    };

    // Check initial scroll position
    updateScrollState();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  });
</script>

<!-- Navbar -->
<div class="navbar-container" class:transparent={isHeaderTransparent} class:scrolled={navHasBottomBorder}>
  <nav class="navbar">
    <!-- Left Section: Logo + Links -->
    <div class="nav-left">
      <div class="logo-and-menu">
        <NavbarLogo />
        <!-- Hamburger Menu (visible below 640px) -->
        <div class="mobile-menu-wrapper">
          <button
            class="hamburger-button"
            onclick={toggleMobileMenu}
            aria-label="Menu"
            aria-expanded={isMobileMenuOpen}
          >
            <!-- Hamburger icon -->
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          {#if isMobileMenuOpen}
            <div class="mobile-menu-dropdown">
              <!-- Navigation Section -->
              <div class="mobile-menu-section">
                <div class="mobile-menu-section-title">Navigate</div>
                <div class="mobile-menu-grid">
                  {#each navLinks as link}
                    <a href={link.href} class="mobile-menu-link" onclick={closeMobileMenu}>
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
                    <a href={link.href} class="mobile-menu-link" onclick={closeMobileMenu}>
                      {link.label}
                    </a>
                  {/each}
                </div>
              </div>

              <!-- Divider -->
              <div class="mobile-menu-divider"></div>

              <!-- Social Links -->
              <div class="mobile-social-links">
                <button type="button" class="social-link" aria-label="GitHub" onclick={closeMobileMenu}>
                  <!-- GitHub icon -->
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </button>
                <button type="button" class="social-link" aria-label="X (Twitter)" onclick={closeMobileMenu}>
                  <!-- X/Twitter icon -->
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </button>
                <button type="button" class="social-link" aria-label="Discord" onclick={closeMobileMenu}>
                  <!-- Discord icon -->
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
                  </svg>
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>
      <div class="nav-links-desktop">
        <NavbarLinks />
      </div>
    </div>

    <!-- Search Bar (visible on xl and above) -->
    <button class="search-bar" onclick={openSearch}>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
      </svg>
      <span class="search-placeholder">Search tokens and pools</span>
      <span class="search-shortcut">/</span>
    </button>

    <!-- Right Section: Actions -->
    <div class="nav-right">
      <!-- Search Icon (visible below xl) -->
      <button class="icon-button search-icon-button" onclick={openSearch} aria-label="Search">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
      </button>

      <!-- Chat Toggle -->
      <button class="icon-button" onclick={() => trollboxDrawer.toggle()} aria-label="Toggle chat">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>

      <!-- Theme Toggle -->
      <button class="icon-button" onclick={handleThemeToggle} aria-label="Toggle theme">
        {#if app.themeMode === 'dark'}
          <!-- Sun icon (click to switch to light) -->
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        {:else}
          <!-- Moon icon (click to switch to dark) -->
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        {/if}
      </button>

      {#if user.isReady}
        {#if user.isAuthenticated}
          <!-- Wallet Button -->
          <button class="wallet-button" onclick={handleWallet} title="Wallet">
            <span class="wallet-text">Wallet</span>
          </button>

          <!-- Account Drawer Trigger -->
          <button class="icon-button" onclick={() => accountDrawer.open()} aria-label="Account">
            <!-- User/Profile Icon -->
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="8" r="5"></circle>
              <path d="M20 21a8 8 0 1 0-16 0"></path>
            </svg>
          </button>
        {:else}
          <!-- Connect Button (matches Uniswap styling) -->
          <button class="connect-button" onclick={handleConnect}>
            Connect
          </button>
        {/if}
      {/if}
    </div>
  </nav>
</div>

<!-- Search Modal -->
<NavbarGlobalSearchModal bind:open={isSearchOpen} onClose={closeSearch} />

<!-- Cashier Modal -->
<CashierModal bind:open={isCashierModalOpen} onClose={handleCashierClose} />

<!-- Account Drawer -->
<AccountDrawer />

<style>
  /* ===== NAVBAR LAYOUT ===== */
  .navbar-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: var(--z-base);
    background-color: var(--background);
    border-bottom: 1px solid transparent;
    transition: border-bottom-color 0.2s ease-in-out;
  }

  .navbar-container.transparent {
    background-color: transparent;
  }

  .navbar-container.scrolled {
    border-bottom-color: var(--border);
  }

  .navbar {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--navbar-height);
    padding: 0 12px;
    gap: 12px;
  }

  /* Left section: Logo + Nav Links */
  .nav-left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    min-width: 0;
  }

  .nav-links-desktop {
    display: flex;
    align-items: center;
  }

  /* Right section: Actions */
  .nav-right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  /* ===== SEARCH BAR ===== */
  .search-bar {
    display: none; /* Hidden by default, shown at xl+ */
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 340px;
    height: 40px;
    padding: 8px 16px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .search-bar:hover {
    border-color: var(--muted-foreground);
  }

  .search-bar:focus {
    outline: none;
  }

  .search-bar .search-icon {
    color: var(--muted-foreground);
    flex-shrink: 0;
    width: 20px;
    height: 20px;
  }

  .search-placeholder {
    flex: 1;
    text-align: left;
    font-size: 16px;
    font-weight: 485;
    color: var(--muted-foreground);
  }

  .search-shortcut {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: var(--background);
    border-radius: 4px;
    font-size: 12px;
    font-weight: 535;
    line-height: 16px;
    color: var(--muted-foreground);
    opacity: 0.6;
  }

  /* ===== ICON BUTTONS (search, chat, profile) ===== */
  .icon-button {
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

  .icon-button:hover {
    color: var(--foreground);
    background: var(--muted);
  }

  /* ===== WALLET BUTTON ===== */
  .wallet-button {
    display: none; /* Hidden for now, will be deleted later */
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    background: var(--primary);
    border: 1px solid transparent;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .wallet-button:hover {
    filter: brightness(1.1);
  }

  .wallet-button:active {
    transform: scale(0.98);
  }

  .wallet-text {
    font-family: 'Basel', sans-serif;
    font-size: 16px;
    line-height: 1;
    font-weight: 485;
    color: white;
  }

  /* ===== CONNECT BUTTON ===== */
  .connect-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    background: var(--primary);
    border: 1px solid transparent;
    border-radius: 12px;
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: 14px;
    font-weight: 535;
    line-height: 14px;
    color: white;
    transition: opacity 0.15s ease, transform 0.1s ease;
    white-space: nowrap;
  }

  .connect-button:hover {
    opacity: 0.9;
  }

  .connect-button:active {
    transform: scale(0.98);
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ===== MOBILE MENU ===== */
  .logo-and-menu {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .mobile-menu-wrapper {
    display: none; /* Hidden by default, shown at mobile */
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
    position: absolute;
    top: calc(100% + 12px);
    left: 0;
    min-width: 280px;
    max-height: calc(100vh - var(--navbar-height) - 24px);
    overflow-y: auto;
    z-index: 9999;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: var(--shadow-elevated);
    padding: 16px;
    animation: slideDown 0.2s ease-out;
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
    background: var(--hover-overlay-strong);
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
    background: var(--hover-overlay-strong);
  }

  /* ===== RESPONSIVE BREAKPOINTS ===== */
  /* Mobile: <768px, Desktop: >=768px (see 08-Responsive.md) */

  /* xl and above (1280px+): Full search bar visible */
  @media (min-width: 1280px) {
    .navbar {
      padding: 0 12px;
      gap: 12px;
    }

    .search-bar {
      display: flex;
    }

    .search-icon-button {
      display: none;
    }
  }

  /* Small mobile (<480px): Prevent dropdowns from bleeding out of viewport */
  @media (max-width: 479px) {
    .mobile-menu-dropdown {
      left: -12px;
    }
  }

  /* Mobile (<768px): Hide nav links, show hamburger menu */
  @media (max-width: 767px) {
    .navbar {
      gap: 4px;
    }

    .nav-links-desktop {
      display: none;
    }

    .mobile-menu-wrapper {
      display: block;
    }

    .nav-right {
      gap: 8px;
    }
  }
</style>
