<script lang="ts">
  import type { ClaimTokenId } from "$lib/actors/services/spot.service";
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import Modal from "../Modal.svelte";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import { TokenAmountInput } from "$lib/components/ui/inputs";
  import { stringToBigInt, bigIntToString } from "$lib/domain/markets/utils";
  import { toastState } from "$lib/state/portal/toast.state.svelte";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { userPortfolio } from "$lib/domain/user";
  import { checkAndApprove } from "$lib/utils/allowance.utils";

  interface Props {
    open: boolean;
    spot: SpotMarket;
    tokenId: ClaimTokenId;
    initialTab?: "deposit" | "withdraw";
    onClose?: () => void;
  }

  let {
    open = $bindable(false),
    spot,
    tokenId,
    initialTab = "deposit",
    onClose
  }: Props = $props();

  // ============================================
  // Tab & Form State
  // ============================================

  let activeTab = $state<"deposit" | "withdraw">("deposit");
  let localAmount = $state("");

  // ============================================
  // Derived Token Data
  // ============================================

  let isBase = $derived('base' in tokenId);

  let token = $derived.by(() => {
    if (!spot.tokens) return undefined;
    const tokenPrincipal = isBase ? spot.tokens[0] : spot.tokens[1];
    return tokenPrincipal ? entityStore.getToken(tokenPrincipal.toString()) : undefined;
  });

  let tokenCanisterId = $derived.by(() => {
    if (!spot.tokens) return undefined;
    const tokenPrincipal = isBase ? spot.tokens[0] : spot.tokens[1];
    return tokenPrincipal?.toString();
  });

  // Wallet balance (for deposit)
  let walletBalance = $derived.by(() => {
    if (!tokenCanisterId) return 0n;
    return userPortfolio.getToken(tokenCanisterId)?.balance ?? 0n;
  });

  // Available balance in trading account (for withdraw)
  let availableBalance = $derived.by(() => {
    return isBase ? spot.availableBase : spot.availableQuote;
  });

  // Current balance based on tab
  let currentBalance = $derived(activeTab === "deposit" ? walletBalance : availableBalance);

  // Fee (same for both)
  let fee = $derived(token?.fee ?? 10000n);
  let formattedFee = $derived(
    token ? bigIntToString(fee, token.decimals) : "0"
  );

  // Amount
  let amountBigInt = $derived.by(() => {
    if (!localAmount || !token) return 0n;
    try {
      return stringToBigInt(localAmount, token.decimals);
    } catch {
      return 0n;
    }
  });


  // ============================================
  // Validation
  // ============================================

  let canSubmit = $derived(
    localAmount &&
    amountBigInt > fee &&
    amountBigInt <= currentBalance &&
    token
  );

  // ============================================
  // Reset on Open / Tab Change
  // ============================================

  $effect(() => {
    if (open) {
      activeTab = initialTab;
      localAmount = "";
    }
  });

  function handleTabChange(tab: "deposit" | "withdraw") {
    if (tab !== activeTab) {
      activeTab = tab;
      localAmount = "";
    }
  }

  // ============================================
  // Handlers
  // ============================================

  function handleClose() {
    open = false;
    onClose?.();
  }

  function handleAmountChange(val: string) {
    localAmount = val;
  }

  async function handleSubmit() {
    if (!token || !tokenCanisterId) return;

    // Capture values before closing (derived state may change)
    const tab = activeTab;
    const amount = amountBigInt;
    const decimals = token.decimals;
    const symbol = token.displaySymbol;
    const logo = token.logo;
    const canisterId = tokenCanisterId;
    const tid = tokenId;

    // Close modal immediately — toast handles the lifecycle
    handleClose();

    const executeTransfer = async () => {
      if (tab === "deposit") {
        await checkAndApprove(canisterId, spot.canister_id);
        return await spot.deposit(tid, amount);
      } else {
        return await spot.withdraw(tid, amount);
      }
    };

    try {
      await toastState.show({
        async: true,
        promise: executeTransfer(),
        messages: {
          loading: `${tab === 'deposit' ? 'Depositing' : 'Withdrawing'} ${symbol}...`,
          success: (result: any) => {
            if (tab === 'deposit') {
              return `Deposited ${bigIntToString(result.credited, decimals)} ${symbol}`;
            }
            if (result.claimId) {
              return `Transfer failed - claim created. You can retry later.`;
            }
            return `Withdrew ${bigIntToString(result.withdrawn, decimals)} ${symbol}`;
          },
          error: (err: unknown) => err instanceof Error ? err.message : `Failed to ${tab}`,
        },
        data: {
          type: 'order' as const,
          side: tab === 'deposit' ? 'Buy' as const : 'Sell' as const,
          orderType: 'market' as const,
          symbol,
          logo: logo ?? undefined,
        },
        duration: 3000,
        toastPosition: 'bottom-right',
      });
    } catch {
      // Error already shown by toast
    }
  }
</script>

<Modal
  bind:open
  onClose={handleClose}
  title={token?.displaySymbol ?? 'Token'}
  size="sm"
  compactHeader={true}
>
  {#snippet children()}
    {#if token}
      <!-- Transfer Form -->
      <div class="modal-body transfer-form">
        <!-- Tabs -->
        <div class="tabs">
          <button
            class="tab"
            class:active={activeTab === "deposit"}
            onclick={() => handleTabChange("deposit")}
          >
            Deposit
          </button>
          <button
            class="tab"
            class:active={activeTab === "withdraw"}
            onclick={() => handleTabChange("withdraw")}
          >
            Withdraw
          </button>
        </div>

        <!-- Amount Input -->
        <div class="modal-form-section">
          <TokenAmountInput
            label="Amount"
            {token}
            balance={currentBalance}
            {fee}
            value={localAmount}
            onValueChange={handleAmountChange}
            size="lg"
          />
        </div>

        <!-- Fee Summary -->
        <div class="modal-panel">
          <div class="modal-detail-row">
            <span class="modal-detail-label">Transfer Fee</span>
            <span class="modal-detail-value">{formattedFee} {token.displaySymbol}</span>
          </div>
        </div>

        {#if activeTab === "deposit"}
          <!-- Info Banner (deposit only) -->
          <div class="modal-info-banner">
            <svg class="modal-info-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4M12 8h.01"/>
            </svg>
            <span>Deposited tokens enable atomic order execution without waiting for transfers.</span>
          </div>
        {/if}

        <!-- Submit Button -->
        <ButtonV2
          variant="primary"
          size="lg"
          fullWidth
          onclick={handleSubmit}
          disabled={!canSubmit}
        >
          {activeTab === "deposit" ? "Deposit" : "Withdraw"} {token.displaySymbol}
        </ButtonV2>
      </div>
    {:else}
      <div class="modal-empty">
        <p>Loading token data...</p>
      </div>
    {/if}
  {/snippet}
</Modal>

<style>
  .transfer-form {
    gap: 1rem;
  }

  /* Tabs */
  .tabs {
    display: flex;
    width: 100%;
    background: var(--muted);
    border-radius: var(--radius-md);
    padding: 0.25rem;
    gap: 0.25rem;
  }

  .tab {
    flex: 1;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--muted-foreground);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .tab:hover:not(.active) {
    color: var(--foreground);
  }

  .tab.active {
    background: var(--background);
    color: var(--foreground);
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

</style>
