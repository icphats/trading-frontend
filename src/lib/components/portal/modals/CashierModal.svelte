<script lang="ts">
  import Modal from "./Modal.svelte";
  import Logo from "$lib/components/ui/Logo.svelte";
  import CopyableId from "$lib/components/ui/CopyableId.svelte";
  import { SearchInput, EmptyState, UnifiedListRow, SectionHeader } from "$lib/components/ui";
  import { TextInput, TokenAmountInput } from "$lib/components/ui/inputs";
  import { user } from "$lib/domain/user/auth.svelte";
  import { userPortfolio, userPreferences } from "$lib/domain/user";
  import { entityStore } from "$lib/domain/orchestration";
  import { formatUSD, formatToken } from "$lib/utils/format.utils";
  import type { NormalizedToken } from "$lib/types/entity.types";

  // ============================================
  // Types
  // ============================================

  /**
   * UI-ready token for CashierModal
   * Combines platform token data (entityStore) with user balance (userPortfolio)
   */
  interface CashierToken {
    canisterId: string;
    symbol: string;
    name: string;
    decimals: number;
    fee: bigint;
    logo: string | null;
    priceUsd: bigint;
    balance: bigint;
    formattedBalance: string;
    value: number;
  }

  interface Props {
    open?: boolean;
    onClose?: () => void;
  }

  let {
    open = $bindable(false),
    onClose
  }: Props = $props();

  let selectedToken = $state<CashierToken | null>(null);
  let selectedTab = $state<"deposit" | "withdraw">("deposit");
  let searchQuery = $state("");

  // Withdraw form state
  let destinationAddress = $state("");
  let withdrawAmount = $state("");

  // ============================================
  // Token List: Platform tokens enriched with user balances
  // ============================================

  /**
   * Combines entityStore.allTokens (platform) with userPortfolio balances (user-specific)
   * This ensures all platform tokens are visible, with balances where available
   */
  let tokens = $derived.by((): CashierToken[] => {
    return entityStore.allTokens
      .map((token): CashierToken => {
        // Get user's balance for this token (if any)
        const portfolioToken = userPortfolio.getToken(token.canisterId);
        const balance = portfolioToken?.balance ?? 0n;
        const decimals = token.decimals;

        // Format balance for display
        const formattedBalance = formatToken({
          value: balance,
          unitName: decimals,
          displayDecimals: 4,
          commas: true,
        });

        // Calculate USD value (priceUsd is E12 per 06-Precision.md)
        const priceFloat = Number(token.priceUsd) / 1e12;
        const balanceFloat = Number(balance) / (10 ** decimals);
        const value = balanceFloat * priceFloat;

        return {
          canisterId: token.canisterId,
          symbol: token.symbol,
          name: token.name,
          decimals,
          fee: token.fee,
          logo: token.logo,
          priceUsd: token.priceUsd,
          balance,
          formattedBalance,
          value,
        };
      })
      // Sort: tokens with balance first, then by value descending
      .sort((a, b) => {
        if ((a.balance > 0n) !== (b.balance > 0n)) {
          return a.balance > 0n ? -1 : 1;
        }
        return b.value - a.value;
      });
  });

  // ============================================
  // Favorites Section
  // ============================================

  // Is user actively searching?
  let isSearching = $derived(searchQuery.length > 0);

  // Favorite tokens with full data
  let favoriteTokens = $derived.by((): CashierToken[] => {
    return tokens.filter(t => userPreferences.isFavorite(t.canisterId));
  });

  // Non-favorite tokens (to avoid duplicates)
  let nonFavoriteTokens = $derived.by((): CashierToken[] => {
    return tokens.filter(t => !userPreferences.isFavorite(t.canisterId));
  });

  // Show favorites section (only when browsing, not searching)
  let showFavorites = $derived(!isSearching);

  // ============================================
  // Filtered Results (when searching)
  // ============================================

  let filteredTokens = $derived.by(() => {
    if (!searchQuery) return tokens;
    const query = searchQuery.toLowerCase();
    return tokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.canisterId.toLowerCase().includes(query)
    );
  });

  // Tokens to display (when not searching, excludes favorites to avoid duplicates)
  let displayedTokens = $derived.by((): CashierToken[] => {
    if (isSearching) return filteredTokens;
    return nonFavoriteTokens;
  });

  // ============================================
  // Balance Sync on Modal Open
  // ============================================

  // Refresh balances when modal opens (aggressive approach)
  $effect(() => {
    if (open && user.principal && user.isAuthenticated) {
      // Sync balances for all tokens in entityStore
      userPortfolio.syncWithEntityStore(user.principal as any).catch((err) => {
        console.error('[CashierModal] Failed to sync balances:', err);
      });
    }
  });

  // User identifiers
  let pid = $derived(user.principalText);
  let aid = $derived(user.accountId?.toHex() ?? null);

  // Withdraw validation
  let canWithdraw = $derived(
    destinationAddress.trim().length > 0 &&
    withdrawAmount.trim().length > 0 &&
    parseFloat(withdrawAmount) > 0
  );

  // Get full NormalizedToken from entityStore for TokenAmountInput
  let normalizedToken = $derived.by((): NormalizedToken | null => {
    if (!selectedToken) return null;
    return entityStore.getToken(selectedToken.canisterId) ?? null;
  });

  function closeModal() {
    open = false;
    selectedToken = null;
    selectedTab = "deposit";
    searchQuery = "";
    destinationAddress = "";
    withdrawAmount = "";
    onClose?.();
  }

  function selectToken(token: CashierToken) {
    selectedToken = token;
  }

  function goBack() {
    selectedToken = null;
    selectedTab = "deposit";
    destinationAddress = "";
    withdrawAmount = "";
  }

  async function handleWithdraw() {
    if (!selectedToken || !canWithdraw) return;

    // TODO: Implement actual withdraw logic
    closeModal();
  }

  // ============================================
  // Favorite Handler
  // ============================================

  function handleTokenFavorite(canisterId: string) {
    userPreferences.toggleFavorite(canisterId);
  }
</script>

<Modal bind:open onClose={closeModal} showHeader={false} size="sm" customClass="cashier-modal max-h-[70vh]">
  {#snippet children()}
    <div class="cashier-content">
      {#if !selectedToken}
        <!-- Token Selection View -->
        <SearchInput
          bind:value={searchQuery}
          placeholder="Search tokens..."
          autofocus
        />

        <!-- Token List -->
        <div class="results-container">
          {#if isSearching && filteredTokens.length === 0}
            <EmptyState
              variant="empty"
              message="No tokens found"
              hint={`No results for "${searchQuery}"`}
            />
          {:else}
            <!-- Favorites Section (only when browsing and has favorites) -->
            {#if showFavorites && favoriteTokens.length > 0}
              <SectionHeader label="Favorites" count={favoriteTokens.length} />

              {#each favoriteTokens as token (token.canisterId)}
                <UnifiedListRow
                  type="token"
                  id={token.canisterId}
                  logo={token.logo}
                  primaryLabel={token.symbol}
                  secondaryLabel={token.name}
                  balance={{ amount: token.formattedBalance, raw: token.balance }}
                  usdValue={token.value}
                  showBalance
                  showUsdValue
                  isFavorite={true}
                  onClick={() => selectToken(token)}
                  onFavorite={() => handleTokenFavorite(token.canisterId)}
                  logoSize="sm"
                />
              {/each}
            {/if}

            <!-- Tokens Section -->
            {#if displayedTokens.length > 0}
              <SectionHeader
                label="Tokens"
                count={isSearching ? filteredTokens.length : nonFavoriteTokens.length}
              />
              {#each displayedTokens as token (token.canisterId)}
                <UnifiedListRow
                  type="token"
                  id={token.canisterId}
                  logo={token.logo}
                  primaryLabel={token.symbol}
                  secondaryLabel={token.name}
                  balance={{ amount: token.formattedBalance, raw: token.balance }}
                  usdValue={token.value}
                  showBalance
                  showUsdValue
                  isFavorite={userPreferences.isFavorite(token.canisterId)}
                  onClick={() => selectToken(token)}
                  onFavorite={() => handleTokenFavorite(token.canisterId)}
                  logoSize="sm"
                />
              {/each}
            {/if}
          {/if}
        </div>
      {:else}
        <!-- Token Detail View -->
        <div class="detail-header">
          <button onclick={goBack} class="back-button" aria-label="Go back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div class="header-token">
            <Logo src={selectedToken.logo ?? undefined} alt={selectedToken.symbol} size="sm" circle={true} />
            <span class="header-symbol">{selectedToken.symbol}</span>
          </div>
          <div class="header-spacer"></div>
        </div>

        <!-- Tabs -->
        <div class="tabs-container">
          <div class="tabs-track">
            <button
              class="tab-pill"
              class:active={selectedTab === "deposit"}
              onclick={() => (selectedTab = "deposit")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
              Deposit
            </button>
            <button
              class="tab-pill"
              class:active={selectedTab === "withdraw"}
              onclick={() => (selectedTab = "withdraw")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M12 19V5M5 12l7-7 7 7"/>
              </svg>
              Withdraw
            </button>
          </div>
        </div>

        <div class="detail-content">
          {#if selectedTab === "deposit"}
            <!-- Balance Row (only for deposit) -->
            <div class="balance-row">
              <span class="balance-label">Balance</span>
              <div class="balance-right">
                <div class="balance-amount-row">
                  <span class="balance-amount">{selectedToken.formattedBalance}</span>
                  <Logo src={selectedToken.logo ?? undefined} alt={selectedToken.symbol} size="xs" circle={true} />
                </div>
                <span class="balance-usd">{formatUSD(selectedToken.value, 2)}</span>
              </div>
            </div>
            <!-- Deposit Section -->
            <div class="deposit-section">
              <!-- Principal ID -->
              <CopyableId id={pid || ''} variant="block" label="Principal ID" />

              <!-- Account ID (for ICP only) -->
              {#if selectedToken.symbol.toLowerCase() === "icp"}
                <CopyableId id={aid || ''} variant="block" label="Account ID" />
              {/if}

              <!-- Info Note -->
              <div class="info-note">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="info-icon">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4M12 8h.01"/>
                </svg>
                <span>Send {selectedToken.symbol} to the {selectedToken.symbol.toLowerCase() === "icp" ? "Account ID" : "Principal ID"} above to deposit.</span>
              </div>
            </div>
          {:else if normalizedToken}
            <!-- Withdraw Section -->
            <div class="withdraw-section">
              <!-- Destination Address -->
              <TextInput
                label="Destination Address"
                bind:value={destinationAddress}
                placeholder="Enter principal or account ID"
                monospace
                size="md"
              />

              <!-- Amount -->
              <TokenAmountInput
                label="Amount"
                token={normalizedToken}
                balance={selectedToken.balance}
                value={withdrawAmount}
                onValueChange={(val) => withdrawAmount = val}
                size="md"
              />

              <!-- Withdraw Button -->
              <button
                class="withdraw-button"
                disabled={!canWithdraw}
                onclick={handleWithdraw}
              >
                Withdraw {selectedToken.symbol}
              </button>

              <!-- Info Note -->
              <div class="info-note warning">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="info-icon">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span>Double-check the destination address. Transactions cannot be reversed.</span>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/snippet}
</Modal>

<style>
  :global(.cashier-modal) {
    display: flex;
    flex-direction: column;
  }

  :global(.cashier-modal .overflow-auto) {
    overflow: hidden !important;
    display: flex;
    flex-direction: column;
  }

  .cashier-content {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
  }

  /* Results Container */
  .results-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    background: var(--background);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  }

  .results-container::-webkit-scrollbar {
    width: 4px;
  }

  .results-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .results-container::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 2px;
  }

  .results-container::-webkit-scrollbar-thumb:hover {
    background: var(--muted-foreground);
  }

  /* Detail View */
  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: var(--background);
    border-bottom: 1px solid var(--border);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }

  .back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--foreground);
    transition: background-color 200ms ease-out;
  }

  .back-button:hover {
    background: var(--hover-overlay);
  }

  .header-token {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .header-symbol {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--foreground);
  }

  .header-spacer {
    width: 28px;
  }

  /* Tabs Section */
  .tabs-container {
    padding: 0.75rem 1rem;
    background: var(--background);
  }

  .tabs-track {
    display: flex;
    gap: 0.25rem;
    padding: 0.25rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .tab-pill {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--muted-foreground);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition:
      background-color 200ms ease-out,
      color 200ms ease-out,
      box-shadow 200ms ease-out;
  }

  .tab-pill.active {
    color: var(--foreground);
    background: var(--background);
    box-shadow: var(--shadow-sm);
  }

  .tab-pill:hover:not(.active) {
    color: var(--foreground);
    background: var(--hover-overlay-subtle);
  }

  .detail-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: var(--background);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  }

  /* Compact Balance Row */
  .balance-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: var(--card);
    border-radius: var(--radius-md);
  }

  .balance-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--muted-foreground);
  }

  .balance-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.125rem;
  }

  .balance-amount-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .balance-amount {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--foreground);
    font-family: var(--font-mono);
  }

  .balance-usd {
    font-size: 0.6875rem;
    color: var(--muted-foreground);
  }

  /* Deposit Section */
  .deposit-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* Withdraw Section */
  .withdraw-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .withdraw-button {
    width: 100%;
    padding: 0.75rem;
    background: var(--primary);
    border: none;
    border-radius: var(--radius-sm);
    color: white;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      opacity 200ms ease-out,
      transform 100ms ease-out;
  }

  .withdraw-button:hover:not(:disabled) {
    opacity: 0.9;
  }

  .withdraw-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .withdraw-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Info Note */
  .info-note {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.625rem;
    background: oklch(0.6 0.15 250 / 0.1);
    border: 1px solid oklch(0.6 0.15 250 / 0.2);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    color: oklch(0.7 0.12 250);
  }

  .info-note.warning {
    background: oklch(0.7 0.15 60 / 0.1);
    border-color: oklch(0.7 0.15 60 / 0.2);
    color: oklch(0.75 0.12 60);
  }

  .info-icon {
    flex-shrink: 0;
    margin-top: 0.0625rem;
  }
</style>
