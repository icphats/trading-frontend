/**
 * Account Feature Components
 *
 * Contains all account-related UI components including:
 * - Account content routing (AccountContent)
 * - Menu navigation (menu/)
 * - Portfolio display (portfolio/)
 * - Settings panel (settings/)
 * - Wallet connection (wallet-connect/)
 *
 * Per canonical architecture: Feature components live in lib/components/{feature}/,
 * not in portal folders. Portal is for container infrastructure only.
 */

// Main content components
export { default as AccountContent } from './AccountContent.svelte';
export { default as MainMenu } from './MainMenu.svelte';
export { default as TokenDetailView } from './TokenDetailView.svelte';

// Sub-feature re-exports
export * from './menu';
export * from './portfolio';
export * from './settings';
export * from './wallet-connect';
