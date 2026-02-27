<script lang="ts">
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import { tokenCreation } from "$lib/domain/tokens";

  interface Props {
    onNext: () => void;
    onBack: () => void;
  }

  let { onNext, onBack }: Props = $props();
</script>

<div class="space-y-6">
  <div class="bg-[var(--background)] border border-[var(--border)] rounded-3xl p-6 space-y-6 overflow-hidden">
    <!-- Selected Token Info -->
    <div class="bg-[color:var(--muted)]/30 rounded-[var(--radius-md)] p-4">
    <div class="flex items-center gap-4">
      <div class="flex-1">
        <div class="text-sm text-[color:var(--muted-foreground)] mb-1">Token</div>
        <div class="text-lg font-semibold">
          {tokenCreation.tokenName} (<span class="uppercase">{tokenCreation.tokenSymbol}</span>)
        </div>
        <div class="text-sm text-[color:var(--muted-foreground)] mt-1">
          {tokenCreation.decimals} decimals • {tokenCreation.transferFee} <span class="uppercase">{tokenCreation.tokenSymbol}</span> transfer fee
        </div>
      </div>
      <!-- Token Logo Preview -->
      {#if tokenCreation.logoBase64}
        <div class="token-summary-logo">
          <img src={tokenCreation.logoBase64} alt="{tokenCreation.tokenSymbol} logo" />
        </div>
      {/if}
    </div>
    </div>

    <!-- Initial Balances -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold">Initial Supply Distribution</h3>
          <p class="text-sm text-[color:var(--muted-foreground)] mt-1">Mint tokens to one or more addresses at creation</p>
        </div>
      <div class="text-right">
        <div class="text-xs text-[color:var(--muted-foreground)]">Total Supply</div>
        <div class="text-lg font-semibold font-[family-name:var(--font-numeric)] tabular-nums" class:text-red-500={tokenCreation.totalSupplyExceedsMax}>
          {tokenCreation.totalSupply} <span class="uppercase">{tokenCreation.tokenSymbol}</span>
        </div>
        <div class="text-xs text-[color:var(--muted-foreground)] mt-1">
          Max: {tokenCreation.maxSupply}
        </div>
      </div>
    </div>

      <!-- Max Supply Warning -->
      {#if tokenCreation.totalSupplyExceedsMax}
        <div class="bg-red-500/10 border border-red-500/20 rounded-[var(--radius-md)] p-4">
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
              <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
            </svg>
            <div class="flex-1">
              <p class="text-sm font-semibold text-red-500">Total supply exceeds maximum</p>
              <p class="text-xs text-[color:var(--muted-foreground)] mt-1">
                With {tokenCreation.decimals} decimals, the maximum supply is {tokenCreation.maxSupply}
                {tokenCreation.tokenSymbol.toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      {/if}

    <div class="space-y-3">
      {#each tokenCreation.initialBalances as row (row.id)}
        <div>
          <div class="flex gap-3 items-start">
            <!-- Principal Input -->
            <div class="flex-1">
              <input
                type="text"
                value={row.principal}
                oninput={(e) => tokenCreation.updateBalanceRow(row.id, "principal", e.currentTarget.value)}
                placeholder="Principal ID (aaaaa-aa...)"
                class="w-full px-4 py-3 bg-[color:var(--background)] border border-[color:var(--border)] rounded-[var(--radius-md)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] font-mono"
              />
            </div>

            <!-- Amount Input -->
            <div class="w-64">
              <div class="relative">
                <input
                  type="text"
                  value={row.amount}
                  oninput={(e) => tokenCreation.updateBalanceRow(row.id, "amount", e.currentTarget.value)}
                  placeholder="1000000"
                  class="w-full px-4 py-3 pr-16 bg-[color:var(--background)] border border-[color:var(--border)] rounded-[var(--radius-md)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                  class:border-red-500={tokenCreation.amountExceedsMax(row.amount)}
                />
                <div class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[color:var(--muted-foreground)] font-medium uppercase">
                  {tokenCreation.tokenSymbol || "TOKENS"}
                </div>
              </div>
              {#if tokenCreation.amountExceedsMax(row.amount)}
                <p class="text-xs text-red-500 mt-1">
                  Exceeds maximum of {tokenCreation.maxSupply}
                </p>
              {/if}
            </div>

            <!-- Remove Button -->
            <button
              onclick={() => tokenCreation.removeBalanceRow(row.id)}
              disabled={tokenCreation.initialBalances.length <= 1}
              class="p-3 text-[color:var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10 rounded-[var(--radius-md)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Remove recipient"
            >
              <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z" />
                <path
                  fill-rule="evenodd"
                  d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      {/each}
    </div>

    <!-- Add Row Button -->
    <button
      onclick={() => tokenCreation.addBalanceRow()}
      class="mt-3 w-full px-4 py-3 border border-dashed border-[color:var(--border)] rounded-[var(--radius-md)] text-sm text-[color:var(--muted-foreground)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)] transition-colors"
    >
      <span class="flex items-center justify-center gap-2">
        <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z" />
        </svg>
        Add Recipient
      </span>
      </button>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between gap-4 mt-6">
      <ButtonV2 variant="secondary" size="xl" onclick={onBack}>Back</ButtonV2>
      <ButtonV2 variant="primary" size="xl" onclick={onNext} disabled={!tokenCreation.step2Valid}>Next</ButtonV2>
    </div>
  </div>
</div>

<style>
  /* Token Summary Logo */
  .token-summary-logo {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .token-summary-logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: var(--background);
  }
</style>
