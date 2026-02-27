<script lang="ts">
	/**
	 * SlideOutMenu - Submenu wrapper with back navigation
	 *
	 * Used for nested menus within account content (Settings, Language, etc.)
	 * Reference: interface/apps/web/src/components/AccountDrawer/SlideOutMenu.tsx
	 */

	import { menuState } from './menu.state.svelte';

	interface Props {
		title: string;
		children?: any;
		/** Custom back handler (defaults to menuState.back) */
		onBack?: () => void;
		/** Optional right-side icon/action */
		rightIcon?: any;
		/** Optional footer content (e.g., version info) */
		footer?: any;
	}

	let { title, children, onBack, rightIcon, footer }: Props = $props();

	function handleBack() {
		if (onBack) {
			onBack();
		} else {
			menuState.back();
		}
	}
</script>

<div class="slideout-menu">
	<div class="slideout-header">
		<button class="back-button" onclick={handleBack} aria-label="Go back">
			<svg
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M15 18l-6-6 6-6" />
			</svg>
		</button>

		<h2 class="slideout-title">{title}</h2>

		{#if rightIcon}
			<div class="right-icon">
				{@render rightIcon()}
			</div>
		{:else}
			<div class="spacer"></div>
		{/if}
	</div>

	<div class="slideout-content">
		{#if children}
			{@render children()}
		{/if}
	</div>

	{#if footer}
		<div class="slideout-footer">
			{@render footer()}
		</div>
	{/if}
</div>

<style>
	.slideout-menu {
		display: flex;
		flex-direction: column;
		padding: 0.75rem 1rem;
		/* Content flows naturally - drawer handles scrolling */
	}

	.slideout-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.25rem;
		flex-shrink: 0;
	}

	.back-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--foreground);
		border-radius: var(--radius-sm);
		transition: background-color 150ms ease;
	}

	.back-button:hover {
		background-color: var(--hover-overlay);
	}

	.slideout-title {
		font-size: 1rem;
		font-weight: 500;
		color: var(--foreground);
		margin: 0;
		text-align: center;
		flex: 1;
	}

	.right-icon {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.spacer {
		width: 32px;
	}

	.slideout-content {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.slideout-footer {
		flex-shrink: 0;
		padding-top: 1rem;
		margin-top: auto;
	}
</style>
