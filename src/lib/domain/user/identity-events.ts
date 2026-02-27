/**
 * Identity Change Events
 *
 * Simple callback registry for identity changes.
 * Separated from auth.svelte.ts to avoid circular dependencies.
 *
 * Flow:
 * 1. Repositories import this and register clearAllActorCaches
 * 2. auth.svelte.ts imports this and calls notifyIdentityChange
 * 3. No circular dependency because this module has no other imports
 */

type IdentityChangeCallback = () => void;

const callbacks: IdentityChangeCallback[] = [];

/**
 * Register a callback to be called when identity changes.
 * Used by repositories to clear actor caches.
 */
export function onIdentityChange(callback: IdentityChangeCallback): void {
  callbacks.push(callback);
}

/**
 * Notify all registered callbacks that identity has changed.
 * Called by auth.svelte.ts after setAgent().
 */
export function notifyIdentityChange(): void {
  for (const callback of callbacks) {
    try {
      callback();
    } catch (error) {
      console.error('[IdentityEvents] Callback error:', error);
    }
  }
}
