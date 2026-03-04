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
  <div class="bg-[var(--background)] border border-[var(--border)] rounded-3xl p-4 sm:p-6 space-y-6 overflow-hidden">
    <div>
      <h3 class="text-lg font-semibold">Token Information</h3>
      <p class="text-sm text-[color:var(--muted-foreground)] mt-1">Configure your token's basic properties including name, symbol, and logo.</p>
    </div>

    <div class="space-y-4">
    <!-- Top Row: Image Upload + Token Name/Symbol/Decimals/Transfer Fee -->
    <div class="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4">
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
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- Token Name -->
        <div>
          <label class="block text-sm font-medium mb-2" for="token-name">Token Name</label>
          <input
            id="token-name"
            type="text"
            bind:value={tokenCreation.tokenName}
            oninput={(e) => {
              const input = e.currentTarget;
              input.value = input.value.replace(/[^A-Za-z0-9 ]/g, '');
              tokenCreation.tokenName = input.value;
            }}
            placeholder="Bitcoin"
            maxlength="20"
            class="w-full px-4 py-3 bg-[color:var(--background)] border rounded-[var(--radius-md)] text-sm form-input"
            class:border-red-500={!!tokenCreation.tokenNameError}
            class:border-[color:var(--border)]={!tokenCreation.tokenNameError}
          />
          <div class="flex justify-between mt-1">
            {#if tokenCreation.tokenNameError}
              <p class="text-xs text-red-500">{tokenCreation.tokenNameError}</p>
            {:else}
              <p class="text-xs text-[color:var(--muted-foreground)]">Letters, digits, spaces</p>
            {/if}
            <span class="text-xs" class:text-red-500={tokenCreation.tokenName.length >= 20} class:text-[color:var(--muted-foreground)]={tokenCreation.tokenName.length < 20}>{tokenCreation.tokenName.length}/20</span>
          </div>
        </div>

        <!-- Token Symbol -->
        <div>
          <label class="block text-sm font-medium mb-2" for="token-symbol">Token Symbol</label>
          <input
            id="token-symbol"
            type="text"
            bind:value={tokenCreation.tokenSymbol}
            oninput={(e) => {
              const input = e.currentTarget;
              input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
              tokenCreation.tokenSymbol = input.value;
            }}
            placeholder="BTC"
            maxlength="8"
            class="w-full px-4 py-3 bg-[color:var(--background)] border rounded-[var(--radius-md)] text-sm form-input uppercase"
            class:border-red-500={!!tokenCreation.tokenSymbolError}
            class:border-[color:var(--border)]={!tokenCreation.tokenSymbolError}
            style="text-transform: uppercase;"
          />
          <div class="flex justify-between mt-1">
            {#if tokenCreation.tokenSymbolError}
              <p class="text-xs text-red-500">{tokenCreation.tokenSymbolError}</p>
            {:else}
              <p class="text-xs text-[color:var(--muted-foreground)]">Uppercase letters and digits</p>
            {/if}
            <span class="text-xs" class:text-red-500={tokenCreation.tokenSymbol.length >= 8} class:text-[color:var(--muted-foreground)]={tokenCreation.tokenSymbol.length < 8}>{tokenCreation.tokenSymbol.length}/8</span>
          </div>
        </div>

        <!-- Decimals (fixed at 8) -->
        <div>
          <label class="block text-sm font-medium mb-2" for="token-decimals">Decimals</label>
          <input
            id="token-decimals"
            type="text"
            value="8"
            disabled
            class="w-full px-4 py-3 bg-[color:var(--background)] border border-[color:var(--border)] rounded-[var(--radius-md)] text-sm form-input disabled:opacity-50 disabled:cursor-not-allowed"
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
              oninput={(e) => {
                const input = e.currentTarget;
                // Allow digits and at most one decimal point
                let cleaned = input.value.replace(/[^\d.]/g, '');
                const parts = cleaned.split('.');
                if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
                input.value = cleaned;
                tokenCreation.transferFee = cleaned;
              }}
              placeholder="0.0001"
              class="w-full px-4 py-3 pr-24 bg-[color:var(--background)] border rounded-[var(--radius-md)] text-sm form-input"
              class:border-red-500={!!tokenCreation.transferFeeError}
              class:border-[color:var(--border)]={!tokenCreation.transferFeeError}
            />
            <div class="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[color:var(--muted-foreground)] font-medium pointer-events-none uppercase">
              {tokenCreation.tokenSymbol || "BTC"}
            </div>
          </div>
          {#if tokenCreation.transferFeeError}
            <p class="text-xs text-red-500 mt-1">{tokenCreation.transferFeeError}</p>
          {:else}
            <p class="text-xs text-[color:var(--muted-foreground)] mt-1">Fee per transfer</p>
          {/if}
        </div>
      </div>
    </div>

    <!-- Minting Address (Full Width) -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <label class="block text-sm font-medium" for="token-minting-address">Minting Address</label>
        <button
          type="button"
          role="switch"
          aria-checked={tokenCreation.isBlackholed}
          onclick={() => (tokenCreation.isBlackholed = !tokenCreation.isBlackholed)}
          class="toggle-switch"
          class:active={tokenCreation.isBlackholed}
        >
          <span class="text-xs font-medium">{tokenCreation.isBlackholed ? "Blackholed" : "Custom"}</span>
          <span class="toggle-track">
            <span class="toggle-thumb"></span>
          </span>
        </button>
      </div>
      <input
        id="token-minting-address"
        type="text"
        bind:value={tokenCreation.mintingAddress}
        placeholder={tokenCreation.isBlackholed ? "Registry canister (blackholed)" : "Principal ID with minting authority"}
        disabled={tokenCreation.isBlackholed}
        class="w-full px-4 py-3 bg-[color:var(--background)] border rounded-[var(--radius-md)] text-sm form-input font-mono disabled:opacity-50 disabled:cursor-not-allowed"
        class:border-red-500={!!tokenCreation.mintingAddressError}
        class:border-[color:var(--border)]={!tokenCreation.mintingAddressError}
      />
      {#if tokenCreation.mintingAddressError}
        <p class="text-xs text-red-500 mt-1">{tokenCreation.mintingAddressError}</p>
      {:else}
        <p class="text-xs text-[color:var(--muted-foreground)] mt-1">
          {#if tokenCreation.isBlackholed}
            Minting authority is blackholed (assigned to the registry canister). No one can mint new tokens.
          {:else}
            This principal will have the authority to mint new tokens after creation.
          {/if}
        </p>
      {/if}
    </div>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between gap-4 mt-6">
      <ButtonV2 variant="secondary" size="lg" onclick={onCancel}>Cancel</ButtonV2>
      <ButtonV2 variant="primary" size="lg" onclick={onNext} disabled={!tokenCreation.step1Valid}>Next</ButtonV2>
    </div>
  </div>
</div>

<style>
  /* Form Input — matches SearchInput inline variant pattern */
  .form-input {
    outline: none;
    transition:
      border-color 200ms ease-out,
      box-shadow 200ms ease-out;
  }

  .form-input:hover:not(:disabled) {
    border-color: var(--border-hover);
  }

  .form-input:focus:not(:disabled) {
    border-color: var(--border-hover);
    box-shadow: var(--focus-glow);
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
    background: oklch(from var(--destructive) l c h / 0.9);
  }

  /* Toggle Switch Styles */
  .toggle-switch {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    color: var(--muted-foreground);
  }

  .toggle-track {
    position: relative;
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: var(--muted);
    border: 1.5px solid var(--border);
    transition: all 0.2s ease;
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--muted-foreground);
    transition: all 0.2s ease;
  }

  .toggle-switch.active .toggle-track {
    background: var(--foreground);
    border-color: var(--foreground);
  }

  .toggle-switch.active .toggle-thumb {
    left: 18px;
    background: var(--background);
  }

  .toggle-switch:hover .toggle-track {
    border-color: var(--foreground);
  }
</style>
