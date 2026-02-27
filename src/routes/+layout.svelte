<script>
  /**
   * Root Layout - Migrated to Domain Layer
   * Phase 4 of Migration Plan
   *
   * Key changes:
   * - Uses discoverAndLoadMarkets() instead of registry.loadMarkets()
   * - Markets are now managed by marketRegistry in domain layer
   */
  import { onMount, untrack } from "svelte";
  import { initSatellite } from "@junobuild/core";
  import { user } from "$lib/domain/user/auth.svelte";
  import { api } from "$lib/actors/api.svelte";
  import { discoverAndLoadMarkets } from "$lib/domain/markets";
  import { userPortfolio, userPreferences } from "$lib/domain/user";
  import { entityStore, seedPlatformTokens, pollingCoordinator } from "$lib/domain/orchestration";
  import { indexerRepository, tokenItemToUpsert } from "$lib/repositories/indexer.repository";
  import { pricingService, tokenLogoService } from "$lib/domain/tokens";
  import Navbar from "$lib/components/layout/Navbar.svelte";
  import { app } from "$lib/state/app.state.svelte";
  import ToastContainer from "$lib/components/portal/toasts/ToastContainer.svelte";
  import { TrollboxDrawer } from "$lib/components/portal/drawers/specific/TrollboxDrawer";
  import { page } from "$app/state";
  import { browser } from "$app/environment";

  import "../app.css";

  // Props
  let { children } = $props();
  let initError = $state(null);
  let isRoot = $derived(page.url.pathname === "/");

  // Track initialization state to prevent loops
  let apiInitialized = $state(false);
  let marketsDiscovered = $state(false);

  // 1. Initialize authenticated actors when user agent is ready
  // (Public actors like indexer are initialized earlier via api.initPublic())
  $effect(() => {
    if (user.agent && !apiInitialized) {
      untrack(() => {
        api.init();
        apiInitialized = true;
      });
    }
  });

  // 2. Discover and load markets + tokens when indexer actor becomes available
  // IMPORTANT: Must wait for user.isReady to ensure agent is properly set,
  // otherwise actors get created with null/anonymous agent and cached incorrectly
  $effect(() => {
    if (api.indexer && user.isReady && !marketsDiscovered) {
      marketsDiscovered = true;
      untrack(() => {
        Promise.all([
          discoverAndLoadMarkets(),
          // Discover platform tokens and populate entityStore
          indexerRepository.getTokens(100n).then((result) => {
            if ('ok' in result) {
              const upserts = result.ok.data.map(tokenItemToUpsert);
              entityStore.upsertTokens(upserts);
            }
          })
        ])
          .then(async ([marketResult]) => {

            // Fetch all markets from Indexer to get ledger IDs for spot tokens
            if (api.indexer) {
              const response = await api.indexer.get_markets({ limit: 100n, cursor: [] });
              await tokenLogoService.prefetchAllLogos(response.data);
            }

          })
          .catch((err) => {
            console.error("[Layout] Failed to discover markets/tokens:", err);
            marketsDiscovered = false; // Reset on error to allow retry
          });
      });
    }
  });

  // 3. Initialize user portfolio (load from localStorage)
  $effect(() => {
    if (!userPortfolio.isInitialized && !userPortfolio.isLoading) {
      untrack(() => {
        userPortfolio.initialize().catch((err) => {
          console.error("[Layout] Failed to initialize user portfolio:", err);
        });
      });
    }
  });

  // 3b. Initialize user preferences (favorites, hidden tokens, etc.)
  $effect(() => {
    if (!userPreferences.isInitialized && !userPreferences.isLoading) {
      untrack(() => {
        userPreferences.initialize();
      });
    }
  });

  // 3c. Sync preferences when user changes (login/logout)
  $effect(() => {
    if (userPreferences.isInitialized && user.isReady) {
      untrack(() => {
        userPreferences.syncForUser();
      });
    }
  });

  // 4. Sync balances with entityStore when user is authenticated AND tokens are available
  // This is AGGRESSIVE: checks balance for EVERY token in entityStore
  let lastSyncTokenCount = $state(0);

  $effect(() => {
    const isAuth = user.isAuthenticated;
    const principal = user.principal;
    const isInit = userPortfolio.isInitialized;
    const tokenCount = entityStore.tokenCount;
    const isAlreadySyncing = userPortfolio.isLoadingBalances;

    // Sync when: authenticated + initialized + entityStore has tokens + not already syncing
    // Re-sync when: new tokens are added to entityStore
    // Skip if already syncing to prevent concurrent syncs (will retry when sync completes)
    if (isAuth && principal && isInit && tokenCount > 0 && tokenCount !== lastSyncTokenCount && !isAlreadySyncing) {
      untrack(() => {
        lastSyncTokenCount = tokenCount;

        // Aggressive sync: check balance for ALL tokens in entityStore
        userPortfolio.syncWithEntityStore(principal).catch((err) => {
          console.error("[Layout] Failed to sync balances:", err);
        });
      });
    }
  });

  // 6. Start pricing service after portfolio initialization AND public API is ready
  $effect(() => {
    if (userPortfolio.isInitialized && api.indexer && !pricingService.isActive) {
      pricingService.start();
    }
  });

  // 7. Cleanup on logout
  // Track previous auth state to detect logout transitions
  let wasAuthenticated = $state(user.isAuthenticated);
  $effect(() => {
    const isAuth = user.isAuthenticated;
    const portfolioInit = userPortfolio.isInitialized;

    // Only reset on transition from authenticated to unauthenticated
    if (wasAuthenticated && !isAuth && portfolioInit) {
      userPortfolio.reset();
    }

    wasAuthenticated = isAuth;
  });

  // 8. Sync polling coordinator with auth state
  // When user logs in, the slow tier starts fetching user data across all markets
  $effect(() => {
    const principal = user.principal;
    const isReady = user.isReady;
    if (isReady) {
      untrack(() => {
        pollingCoordinator.setUserPrincipal(principal);
      });
    }
  });

  // Apply theme class to document whenever theme changes
  $effect(() => {
    if (!browser) return;
    if (app.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  });

  onMount(async () => {
    try {
      // Initialize Juno satellite (disabled - not needed for local dev)
      // await initSatellite();

      // Seed platform tokens FIRST - ensures quote tokens (ICP, USDT, USDC) are
      // immediately available for UI components like ConfigurePool, before indexer loads
      seedPlatformTokens();

      // Start unified polling coordinator (visibility-gated, three cadence tiers)
      pollingCoordinator.start();

      // Hydrate logos from IndexedDB cache (non-blocking, runs in parallel)
      // This ensures cached logos are available immediately when markets render
      tokenLogoService.hydrateFromIndexedDB();

      // Initialize public API and user auth in parallel
      // - api.initPublic(): Anonymous indexer for fast public reads
      // - user.init(): User authentication setup
      await Promise.all([
        api.initPublic(),
        user.init()
      ]);
    } catch (error) {
      console.error("Failed to initialize:", error);
      initError = error;
    }

    // Cleanup on unmount
    return () => {
      pricingService.stop();
      pollingCoordinator.stop();
    };
  });
</script>

{#if initError}
  <div style="padding: 20px; background: #fee; border: 1px solid #fcc; margin: 10px; border-radius: 4px;">
    <p style="color: #c00; margin: 0;">Failed to initialize ICP connection. This is often due to:</p>
    <ul style="color: #666; margin-top: 10px;">
      <li>Local ICP development environment not running (run `dfx start` if developing locally)</li>
      <li>Browser blocking WebAssembly or crypto APIs</li>
      <li>Network connectivity issues</li>
    </ul>
    <p style="color: #666; margin-top: 10px;">The app will continue to work in read-only mode.</p>
  </div>
{/if}

<div>
  {#if user.isReady || isRoot}
    {#if !isRoot}
      <div style="height: var(--navbar-height);"></div>
    {/if}
    {@render children?.()}
  {:else}
    <div class="flex justify-center items-center h-screen">
      <div class="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
    </div>
  {/if}
</div>

<Navbar />
<!-- <Footer /> -->
<ToastContainer />

<TrollboxDrawer />
