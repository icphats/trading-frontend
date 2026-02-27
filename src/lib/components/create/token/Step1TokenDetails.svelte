<script lang="ts">
  import { goto } from "$app/navigation";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import { tokenCreation } from "$lib/domain/tokens";
  import { validateImageFile, validateImageDimensions } from "$lib/utils/image.utils";
  import { toastState } from "$lib/state/portal/toast.state.svelte";

  interface Props {
    onNext: () => void;
    onCancel: () => void;
  }

  let { onNext, onCancel }: Props = $props();

  // Image upload state
  let fileInput = $state<HTMLInputElement | null>(null);
  let imageError = $state<string>("");

  async function handleImageUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) return;

    imageError = "";

    // Validate file type and size
    const validation = validateImageFile(file, 100);
    if (!validation.valid) {
      imageError = validation.error || "Invalid file";
      toastState.show({ message: validation.error || "Invalid file", variant: "error" });
      return;
    }

    // Validate square and size range (48–256px)
    const dimValidation = await validateImageDimensions(file);
    if (!dimValidation.valid) {
      imageError = dimValidation.error || "Invalid dimensions";
      toastState.show({ message: dimValidation.error || "Invalid dimensions", variant: "error" });
      return;
    }

    try {
      // Convert to base64 directly (no resize needed — dimensions are validated)
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      tokenCreation.logoBase64 = base64;
    } catch (error) {
      imageError = error instanceof Error ? error.message : "Error processing image";
      toastState.show({ message: imageError, variant: "error" });
    }
  }

  function removeImage() {
    tokenCreation.logoBase64 = "";
    imageError = "";
    if (fileInput) {
      fileInput.value = "";
    }
  }
</script>

<div class="space-y-6">
  <div class="bg-[var(--background)] border border-[var(--border)] rounded-3xl p-6 space-y-6 overflow-hidden">
    <div>
      <h3 class="text-lg font-semibold">Token Information</h3>
      <p class="text-sm text-[color:var(--muted-foreground)] mt-1">Configure your token's basic properties including name, symbol, and logo.</p>
    </div>

    <div class="space-y-4">
    <!-- Top Row: Image Upload + Token Name/Symbol/Decimals/Transfer Fee -->
    <div class="grid grid-cols-[140px_1fr] gap-4">
      <!-- Image Upload (Left) -->
      <div>
        <span class="block text-sm font-medium mb-2">Logo</span>
        <div class="logo-upload-area">
          {#if tokenCreation.logoBase64}
            <!-- Preview -->
            <div class="logo-preview">
              <img src={tokenCreation.logoBase64} alt="Token logo" />
              <button onclick={removeImage} class="logo-remove-btn" aria-label="Remove logo">
                <svg class="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
                </svg>
              </button>
            </div>
          {:else}
            <!-- Upload Button -->
            <button onclick={() => fileInput?.click()} class="logo-upload-btn" type="button">
              <svg class="w-6 h-6 mb-1" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6.002 5.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                <path d="M2.002 1a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V3a2 2 0 00-2-2h-12zm12 1a1 1 0 011 1v6.5l-3.777-1.947a.5.5 0 00-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 00-.63.062L1.002 12V3a1 1 0 011-1h12z" />
              </svg>
              <span class="text-xs">Upload</span>
            </button>
            <input bind:this={fileInput} type="file" accept="image/png" onchange={handleImageUpload} class="hidden" />
          {/if}
        </div>
        {#if imageError}
          <p class="text-xs text-red-500 mt-1">{imageError}</p>
        {:else}
          <p class="text-xs text-[color:var(--muted-foreground)] mt-1">PNG, square, 48–256px, max 100KB</p>
        {/if}
      </div>

      <!-- Right Column: Token Details (2x2 Grid) -->
      <div class="grid grid-cols-2 gap-4">
        <!-- Token Name -->
        <div>
          <label class="block text-sm font-medium mb-2" for="token-name">Token Name</label>
          <input
            id="token-name"
            type="text"
            bind:value={tokenCreation.tokenName}
            placeholder="My Awesome Token"
            maxlength="20"
            class="w-full px-4 py-3 bg-[color:var(--background)] border border-[color:var(--border)] rounded-[var(--radius-md)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
          />
          <p class="text-xs text-[color:var(--muted-foreground)] mt-1">Full name (1-20 chars)</p>
        </div>

        <!-- Token Symbol -->
        <div>
          <label class="block text-sm font-medium mb-2" for="token-symbol">Token Symbol</label>
          <input
            id="token-symbol"
            type="text"
            bind:value={tokenCreation.tokenSymbol}
            placeholder="MAT"
            maxlength="8"
            class="w-full px-4 py-3 bg-[color:var(--background)] border border-[color:var(--border)] rounded-[var(--radius-md)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] uppercase"
            style="text-transform: uppercase;"
          />
          <p class="text-xs text-[color:var(--muted-foreground)] mt-1">Ticker (2-8 chars)</p>
        </div>

        <!-- Decimals (fixed at 8) -->
        <div>
          <label class="block text-sm font-medium mb-2" for="token-decimals">Decimals</label>
          <input
            id="token-decimals"
            type="text"
            value="8"
            disabled
            class="w-full px-4 py-3 bg-[color:var(--background)] border border-[color:var(--border)] rounded-[var(--radius-md)] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p class="text-xs text-[color:var(--muted-foreground)] mt-1">Fixed at 8 decimal places</p>
        </div>

        <!-- Transfer Fee -->
        <div>
          <label class="block text-sm font-medium mb-2" for="token-transfer-fee">Transfer Fee</label>
          <div class="relative">
            <input
              id="token-transfer-fee"
              type="text"
              bind:value={tokenCreation.transferFee}
              placeholder="0.0001"
              class="w-full px-4 py-3 pr-24 bg-[color:var(--background)] border border-[color:var(--border)] rounded-[var(--radius-md)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            />
            <div class="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[color:var(--muted-foreground)] font-medium pointer-events-none uppercase">
              {tokenCreation.tokenSymbol || "TOKENS"}
            </div>
          </div>
          <p class="text-xs text-[color:var(--muted-foreground)] mt-1">Fee per transfer</p>
        </div>
      </div>
    </div>

    <!-- Minting Address (Full Width) -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <label class="block text-sm font-medium" for="token-minting-address">Minting Address</label>
        <div class="flex items-center gap-3">
          <button
            type="button"
            onclick={() => (tokenCreation.isBlackholed = !tokenCreation.isBlackholed)}
            class="mint-toggle"
            class:blackholed={tokenCreation.isBlackholed}
            aria-label={tokenCreation.isBlackholed ? "Switch to custom minting address" : "Switch to blackholed (registry canister)"}
          >
            {#if tokenCreation.isBlackholed}
              <!-- Blackhole Icon (locked/disabled) -->
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" fill="currentColor" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </svg>
              <span>Blackholed</span>
            {:else}
              <!-- Custom Icon (unlocked/editable) -->
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v20M2 12h20M6 6l12 12M6 18L18 6" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Custom</span>
            {/if}
          </button>
          <a href="https://caffeine.ai" target="_blank" rel="noopener noreferrer" class="caffeine-badge"> Try it with Caffeine! </a>
        </div>
      </div>
      <input
        id="token-minting-address"
        type="text"
        bind:value={tokenCreation.mintingAddress}
        placeholder={tokenCreation.isBlackholed ? "Registry canister (blackholed)" : "Principal ID with minting authority"}
        disabled={tokenCreation.isBlackholed}
        class="w-full px-4 py-3 bg-[color:var(--background)] border border-[color:var(--border)] rounded-[var(--radius-md)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] font-mono disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <p class="text-xs text-[color:var(--muted-foreground)] mt-1">
        {#if tokenCreation.isBlackholed}
          Minting authority is blackholed (assigned to the registry canister). No one can mint new tokens.
        {:else}
          This principal will have the authority to mint new tokens after creation.
        {/if}
      </p>
    </div>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between gap-4 mt-6">
      <ButtonV2 variant="secondary" size="xl" onclick={onCancel}>Cancel</ButtonV2>
      <ButtonV2 variant="primary" size="xl" onclick={onNext} disabled={!tokenCreation.step1Valid}>Next</ButtonV2>
    </div>
  </div>
</div>

<style>
  /* Caffeine Badge */
  .caffeine-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    background: var(--primary);
    color: white;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.025em;
    text-transform: uppercase;
    text-decoration: none;
    box-shadow:
      0 2px 8px oklch(from var(--primary) l c h / 0.25),
      inset 0 1px 0 oklch(from var(--primary) calc(l + 0.15) c h / 0.5);
    transition: all 0.2s ease;
  }

  .caffeine-badge:hover {
    transform: translateY(-1px);
    box-shadow:
      0 4px 12px oklch(from var(--primary) l c h / 0.35),
      inset 0 1px 0 oklch(from var(--primary) calc(l + 0.15) c h / 0.5);
  }

  .caffeine-badge:active {
    transform: translateY(0);
  }

  /* Logo Upload Styles */
  .logo-upload-area {
    width: 128px;
    height: 128px;
    position: relative;
  }

  .logo-upload-btn {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 2px dashed var(--border);
    border-radius: var(--radius-md);
    background: var(--background);
    color: var(--muted-foreground);
    cursor: pointer;
    transition: all 0.2s;
  }

  .logo-upload-btn:hover {
    border-color: var(--foreground);
    color: var(--foreground);
    background: var(--muted);
  }

  .logo-preview {
    width: 100%;
    height: 100%;
    position: relative;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid var(--border);
  }

  .logo-preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: var(--background);
  }

  .logo-remove-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border-radius: 50%;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .logo-preview:hover .logo-remove-btn {
    opacity: 1;
  }

  .logo-remove-btn:hover {
    background: rgba(239, 68, 68, 0.9);
  }

  /* Mint Toggle Styles */
  .mint-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.875rem;
    border-radius: var(--radius-md);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    border: 1.5px solid var(--border);
    background: var(--background);
    color: var(--foreground);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mint-toggle:hover {
    border-color: var(--foreground);
    background: var(--muted);
    color: var(--foreground);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .mint-toggle.blackholed {
    border-color: var(--muted-foreground);
    background: oklch(from var(--muted-foreground) l c h / 0.05);
    color: var(--muted-foreground);
  }

  .mint-toggle.blackholed:hover {
    border-color: var(--foreground);
    background: var(--muted);
    color: var(--foreground);
  }

  .mint-toggle:active {
    transform: translateY(0);
  }

  .mint-toggle svg {
    transition: transform 0.2s ease;
  }

  .mint-toggle:hover svg {
    transform: rotate(180deg);
  }
</style>
