<script lang="ts">
	/**
	 * TokenDetailView - Token detail view within account content
	 *
	 * Shows token balance and action buttons (Send, Receive)
	 * Follows Uniswap's pattern of keeping asset management within the drawer
	 *
	 * Reuses components from CashierModal for consistency:
	 * - TextInput for addresses (Principal ID, Account ID, destination)
	 * - TokenAmountInput for send amount (with presets and balance)
	 */

	import { Principal } from '@dfinity/principal';
	import { tokenDetailState, menuState, SlideOutMenu } from '$lib/components/account/menu';
	import { user } from '$lib/domain/user/auth.svelte';
	import { userPortfolio } from '$lib/domain/user';
	import { entityStore } from '$lib/domain/orchestration';
	import { tokenRepository } from '$lib/repositories';
	import { formatUSD } from '$lib/utils/format.utils';
	import Logo from '$lib/components/ui/Logo.svelte';
	import CopyableId from '$lib/components/ui/CopyableId.svelte';
	import { TextInput, TokenAmountInput } from '$lib/components/ui/inputs';
	import type { NormalizedToken } from '$lib/types/entity.types';

	// Get the selected token from state
	const token = $derived(tokenDetailState.token);

	// Get NormalizedToken from entityStore for TokenAmountInput
	const normalizedToken = $derived.by((): NormalizedToken | null => {
		if (!token) return null;
		return entityStore.getToken(token.canisterId) ?? null;
	});

	// Tab state: 'send' or 'receive'
	let activeTab = $state<'send' | 'receive'>('receive');

	// Send form state
	let destinationAddress = $state('');
	let sendAmount = $state('');
	let isSending = $state(false);
	let sendError = $state<string | null>(null);
	let sendSuccess = $state(false);

	// User identifiers for receive
	let pid = $derived(user.principalText);
	let aid = $derived(user.accountId?.toHex() ?? null);

	// Is ICP token (show Account ID for ICP)
	let isIcp = $derived(token?.symbol.toLowerCase() === 'icp');

	// Validation
	let canSend = $derived(
		!isSending &&
			destinationAddress.trim().length > 0 &&
			sendAmount.trim().length > 0 &&
			parseFloat(sendAmount) > 0
	);

	function handleBack() {
		// Reset form state
		resetForm();
		menuState.back();
	}

	function resetForm() {
		destinationAddress = '';
		sendAmount = '';
		sendError = null;
		sendSuccess = false;
		activeTab = 'receive';
	}

	/**
	 * Parse destination address to Principal
	 * Supports both Principal ID and Account ID (hex) formats
	 */
	function parseDestination(address: string): Principal | null {
		const trimmed = address.trim();

		// Try parsing as Principal first
		try {
			return Principal.fromText(trimmed);
		} catch {
			// Not a valid Principal
		}

		// Account IDs are 64-character hex strings
		// For now, we only support Principal IDs for ICRC-1 transfers
		// Account ID support would require ICP ledger-specific handling
		return null;
	}

	/**
	 * Convert amount string to bigint with token decimals
	 */
	function parseAmount(amountStr: string, decimals: number): bigint {
		const amount = parseFloat(amountStr);
		if (isNaN(amount) || amount <= 0) return 0n;

		// Convert to smallest unit
		const multiplier = 10 ** decimals;
		return BigInt(Math.floor(amount * multiplier));
	}

	async function handleSend() {
		if (!token || !canSend) return;

		sendError = null;
		sendSuccess = false;
		isSending = true;

		try {
			// Parse destination
			const toPrincipal = parseDestination(destinationAddress);
			if (!toPrincipal) {
				sendError = 'Invalid destination address. Please enter a valid Principal ID.';
				isSending = false;
				return;
			}

			// Parse amount
			const amountUnits = parseAmount(sendAmount, token.decimals);
			if (amountUnits <= 0n) {
				sendError = 'Invalid amount.';
				isSending = false;
				return;
			}

			// Check sufficient balance (amount + fee)
			const totalRequired = amountUnits + token.fee;
			if (totalRequired > token.balance) {
				sendError = `Insufficient balance. You need ${sendAmount} + fee.`;
				isSending = false;
				return;
			}

			// Execute transfer
			const result = await tokenRepository.transfer(token.canisterId, toPrincipal, amountUnits);

			if ('err' in result) {
				sendError = result.err;
				isSending = false;
				return;
			}

			// Success!
			sendSuccess = true;
			isSending = false;

			// Refresh portfolio to show updated balance
			if (user.principal) {
				userPortfolio.refreshBalances(user.principal as any);
			}

			// Reset form after brief delay to show success
			setTimeout(() => {
				resetForm();
			}, 2000);
		} catch (error) {
			sendError = error instanceof Error ? error.message : 'Transfer failed';
			isSending = false;
		}
	}
</script>

{#if token}
	<SlideOutMenu title={token.displaySymbol} onBack={handleBack}>
		{#snippet children()}
			<div class="token-detail">
				<!-- Token Header -->
				<div class="token-header">
					<Logo src={token.logo ?? undefined} alt={token.displaySymbol} size="lg" circle />
					<div class="token-balance">
						<span class="balance-amount">{token.formattedBalance} {token.displaySymbol}</span>
						<span class="balance-usd">{formatUSD(token.value, 2)}</span>
					</div>
				</div>

				<!-- Tab Buttons -->
				<div class="tabs">
					<button
						class="tab"
						class:active={activeTab === 'receive'}
						onclick={() => (activeTab = 'receive')}
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M12 5v14M5 12l7 7 7-7" />
						</svg>
						Receive
					</button>
					<button class="tab" class:active={activeTab === 'send'} onclick={() => (activeTab = 'send')}>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M12 19V5M5 12l7-7 7 7" />
						</svg>
						Send
					</button>
				</div>

				<!-- Tab Content -->
				<div class="tab-content">
					{#if activeTab === 'receive'}
						<!-- Receive Tab -->
						<div class="receive-section">
							<CopyableId id={pid || ''} variant="block" label="Principal ID" />

							{#if isIcp}
								<CopyableId id={aid || ''} variant="block" label="Account ID" />
							{/if}

							<div class="info-note">
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<circle cx="12" cy="12" r="10" />
									<path d="M12 16v-4M12 8h.01" />
								</svg>
								<span
									>Send {token.displaySymbol} to the {isIcp ? 'Account ID' : 'Principal ID'} above to deposit.</span
								>
							</div>
						</div>
					{:else if normalizedToken}
						<!-- Send Tab -->
						<div class="send-section">
							<TextInput
								label="Destination"
								bind:value={destinationAddress}
								placeholder="Enter principal or account ID"
								monospace
								size="md"
							/>

							<TokenAmountInput
								label="Amount"
								token={normalizedToken}
								balance={token.balance}
								value={sendAmount}
								onValueChange={(val) => (sendAmount = val)}
								size="md"
								error={sendError ?? undefined}
							/>

							<button class="send-button" class:success={sendSuccess} disabled={!canSend} onclick={handleSend}>
								{#if isSending}
									<span class="spinner"></span>
									Sending...
								{:else if sendSuccess}
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
									>
										<polyline points="20 6 9 17 4 12"></polyline>
									</svg>
									Sent!
								{:else}
									Send {token.displaySymbol}
								{/if}
							</button>

							<div class="info-note warning">
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
									/>
									<line x1="12" y1="9" x2="12" y2="13" />
									<line x1="12" y1="17" x2="12.01" y2="17" />
								</svg>
								<span>Double-check the address. Transactions cannot be reversed.</span>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/snippet}
	</SlideOutMenu>
{/if}

<style>
	.token-detail {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* Token Header */
	.token-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0 1rem;
	}

	.token-balance {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.balance-amount {
		font-size: 1.5rem;
		font-weight: 500;
		color: var(--foreground);
	}

	.balance-usd {
		font-size: 0.875rem;
		color: var(--muted-foreground);
	}

	/* Tabs */
	.tabs {
		display: flex;
		gap: 0.5rem;
		padding: 0.25rem;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}

	.tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.625rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--muted-foreground);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 200ms ease;
	}

	.tab:hover:not(.active) {
		color: var(--foreground);
		background: var(--hover-overlay-subtle);
	}

	.tab.active {
		color: var(--foreground);
		background: var(--background);
		box-shadow: var(--shadow-sm);
	}

	/* Tab Content */
	.tab-content {
		display: flex;
		flex-direction: column;
	}

	.receive-section,
	.send-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* Send Button */
	.send-button {
		width: 100%;
		padding: 0.75rem;
		margin-top: 0.5rem;
		background: var(--primary);
		border: none;
		border-radius: var(--radius-sm);
		color: white;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			opacity 200ms ease,
			transform 100ms ease,
			background-color 200ms ease;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.send-button:hover:not(:disabled) {
		opacity: 0.9;
	}

	.send-button:active:not(:disabled) {
		transform: scale(0.98);
	}

	.send-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.send-button.success {
		background: var(--success, #22c55e);
	}

	/* Spinner */
	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
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

	.info-note svg {
		flex-shrink: 0;
		margin-top: 0.0625rem;
	}
</style>
