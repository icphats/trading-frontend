/**
 * Allowance Utilities
 *
 * Simple, no-cache ICRC-2 allowance management.
 * Always queries the ledger for current allowance, approves if insufficient.
 *
 * Usage in components:
 * ```typescript
 * $effect(() => {
 *   if (!user.principal || !market.tokens?.[0]) return;
 *   if (token0Balance > 0n) {
 *     checkAndApprove(market.tokens[0].toString(), market.canister_id);
 *   }
 * });
 * ```
 */

import { Principal } from '@dfinity/principal';
import { tokenRepository } from '$lib/repositories/token.repository';
import { user } from '$lib/domain/user/auth.svelte';

// ============================================
// Constants
// ============================================

/**
 * Max approval amount (effectively unlimited)
 * Using max u64 value for "set and forget" approvals
 */
export const MAX_APPROVAL_AMOUNT = 2n ** 64n - 1n;

/**
 * Minimum allowance threshold to consider "sufficient"
 * If allowance is below this, we approve max amount
 */
export const MIN_ALLOWANCE_THRESHOLD = 10n ** 12n; // 1 token with 12 decimals worth

// ============================================
// In-flight tracking (prevent duplicate calls)
// ============================================

const inFlight = new Set<string>();

function makeKey(ledger: string, spender: string): string {
  return `${ledger}:${spender}`;
}

// ============================================
// Main Function
// ============================================

/**
 * Check current allowance and approve if insufficient
 *
 * - Always queries the ledger (no cache)
 * - Approves max amount if below threshold
 * - Deduplicates concurrent calls
 * - Fire-and-forget (logs errors, doesn't throw)
 *
 * @param ledgerCanisterId - Token ledger canister ID
 * @param spenderCanisterId - Canister that will spend tokens (e.g., spot market)
 */
export async function checkAndApprove(
  ledgerCanisterId: string,
  spenderCanisterId: string
): Promise<void> {
  const owner = user.principal;
  if (!owner) return;

  const key = makeKey(ledgerCanisterId, spenderCanisterId);

  // Prevent duplicate in-flight requests
  if (inFlight.has(key)) {
    return;
  }

  inFlight.add(key);

  try {
    // Step 1: Query current allowance from ledger

    const result = await tokenRepository.getAllowance(
      ledgerCanisterId,
      owner as any,
      Principal.fromText(spenderCanisterId)
    );

    if ('err' in result) {
      console.error('[Allowance] Failed to query:', result.err);
      return;
    }

    const currentAllowance = result.ok.allowance;

    // Step 2: Check if sufficient
    if (currentAllowance >= MIN_ALLOWANCE_THRESHOLD) {
      return;
    }

    // Step 3: Approve max amount

    const approveResult = await tokenRepository.approve(
      ledgerCanisterId,
      Principal.fromText(spenderCanisterId),
      MAX_APPROVAL_AMOUNT
    );

    if ('ok' in approveResult) {
    } else {
      console.error('[Allowance] ✗ Approval failed:', approveResult.err);
    }
  } catch (error) {
    console.error('[Allowance] Error:', error);
  } finally {
    inFlight.delete(key);
  }
}

// ============================================
// Error Detection Helper
// ============================================

/**
 * Check if an error is an InsufficientAllowance error
 * Useful for retry logic in trading flows
 */
export function isInsufficientAllowanceError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    if ('InsufficientAllowance' in error) return true;
    if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
      return (error as { message: string }).message.toLowerCase().includes('insufficient allowance');
    }
  }
  if (typeof error === 'string') {
    return error.toLowerCase().includes('insufficient allowance');
  }
  return false;
}
