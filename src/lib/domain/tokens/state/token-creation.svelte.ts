/**
 * Token Creation State Management
 *
 * PURPOSE: Holds ephemeral form state for the multi-step token creation wizard.
 * This is UI FORM STATE, not entity data.
 *
 * RELATIONSHIP TO entityStore: NONE
 * - This manages user input during token creation flow
 * - Data is reset after successful creation
 * - Created tokens are discovered via indexer and added to entityStore separately
 *
 * Manages ICRC-1 ledger creation flow with multi-recipient initial balances.
 */

import { Principal } from '@dfinity/principal';
import type { LedgerInitArgs } from '$lib/actors/services/registry.service';
import type { Account, ArchiveOptions } from 'declarations/registry/registry.did';
import { canisterIds } from '$lib/constants/app.constants';

interface InitialBalanceRow {
  id: string;
  principal: string;
  amount: string;
}

// Nat64 maximum value (2^64 - 1)
const NAT64_MAX = 18_446_744_073_709_551_615n;

class TokenCreationState {
  // ============================================
  // Step 1: Token Details
  // ============================================

  tokenName = $state<string>('');
  tokenSymbol = $state<string>('');
  decimals = $state<number>(8);
  transferFee = $state<string>('0.0001');
  isBlackholed = $state<boolean>(true); // Default to blackholed
  mintingAddress = $state<string>(''); // Principal ID with minting authority (only used when not blackholed)
  logoBase64 = $state<string>(''); // Base64-encoded PNG logo (square, 48-256px, <100KB)

  // ============================================
  // Step 2: Initial Supply
  // ============================================

  initialBalances = $state<InitialBalanceRow[]>([
    {
      id: crypto.randomUUID(),
      principal: '',
      amount: ''
    }
  ]);

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Convert user-facing amount to smallest units (Nat64)
   */
  private amountToUnits(amount: string): bigint {
    const amountFloat = parseFloat(amount) || 0;
    return BigInt(Math.round(amountFloat * Math.pow(10, this.decimals)));
  }

  /**
   * Get maximum user-facing supply based on current decimals
   */
  maxSupply = $derived.by(() => {
    const divisor = BigInt(Math.pow(10, this.decimals));
    const maxTokens = Number(NAT64_MAX / divisor);

    return maxTokens.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: this.decimals
    });
  });

  /**
   * Get maximum units as bigint
   */
  private get maxSupplyUnits(): bigint {
    return NAT64_MAX;
  }

  // ============================================
  // Validation
  // ============================================

  step1Valid = $derived.by(() => {
    // Token name: 1-20 chars
    if (!this.tokenName || this.tokenName.length < 1 || this.tokenName.length > 20) {
      return false;
    }

    // Token symbol: 2-8 chars
    if (!this.tokenSymbol || this.tokenSymbol.length < 2 || this.tokenSymbol.length > 8) {
      return false;
    }

    // Transfer fee must be valid number >= 0
    const feeNum = parseFloat(this.transferFee);
    if (isNaN(feeNum) || feeNum < 0) {
      return false;
    }

    // Decimals fixed at 8
    if (this.decimals !== 8) {
      return false;
    }

    // If not blackholed, minting address must be valid principal
    if (!this.isBlackholed) {
      if (!this.mintingAddress) {
        return false;
      }
      try {
        Principal.fromText(this.mintingAddress);
      } catch {
        return false;
      }
    }

    // Logo must be provided (mandatory)
    if (!this.logoBase64) {
      return false;
    }

    return true;
  });

  step2Valid = $derived.by(() => {
    // Must have at least one initial balance
    if (this.initialBalances.length === 0) {
      return false;
    }

    let totalUnits = 0n;

    // All rows must have valid principal and amount > 0
    const allRowsValid = this.initialBalances.every((row) => {
      if (!row.principal || !row.amount) return false;

      // Validate principal format
      try {
        Principal.fromText(row.principal);
      } catch {
        return false;
      }

      // Validate amount is positive number
      const amount = parseFloat(row.amount);
      if (isNaN(amount) || amount <= 0) {
        return false;
      }

      // Convert to units and validate against Nat64 max
      const amountUnits = this.amountToUnits(row.amount);

      // Individual amount must not exceed Nat64 max
      if (amountUnits > NAT64_MAX) {
        return false;
      }

      // Accumulate total
      totalUnits += amountUnits;

      return true;
    });

    if (!allRowsValid) {
      return false;
    }

    // Total supply must not exceed Nat64 max
    if (totalUnits > NAT64_MAX) {
      return false;
    }

    return true;
  });

  formValid = $derived.by(() => {
    return this.step1Valid && this.step2Valid;
  });

  // ============================================
  // Validation Helpers (for UI error messages)
  // ============================================

  /**
   * Check if a specific amount exceeds Nat64 max for current decimals
   */
  amountExceedsMax(amount: string): boolean {
    if (!amount) return false;
    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat)) return false;

    const amountUnits = this.amountToUnits(amount);
    return amountUnits > NAT64_MAX;
  }

  /**
   * Check if total supply exceeds Nat64 max
   */
  totalSupplyExceedsMax = $derived.by(() => {
    let totalUnits = 0n;

    for (const row of this.initialBalances) {
      if (!row.amount) continue;
      const amountFloat = parseFloat(row.amount);
      if (isNaN(amountFloat)) continue;

      totalUnits += this.amountToUnits(row.amount);
    }

    return totalUnits > NAT64_MAX;
  });

  /**
   * Get total supply in units (for validation)
   */
  totalSupplyUnits = $derived.by(() => {
    let totalUnits = 0n;

    for (const row of this.initialBalances) {
      if (!row.amount) continue;
      const amountFloat = parseFloat(row.amount);
      if (isNaN(amountFloat)) continue;

      totalUnits += this.amountToUnits(row.amount);
    }

    return totalUnits;
  });

  // ============================================
  // Initial Balance Management
  // ============================================

  addBalanceRow() {
    this.initialBalances.push({
      id: crypto.randomUUID(),
      principal: '',
      amount: ''
    });
  }

  removeBalanceRow(id: string) {
    // Don't allow removing the last row
    if (this.initialBalances.length <= 1) return;

    this.initialBalances = this.initialBalances.filter((row) => row.id !== id);
  }

  updateBalanceRow(id: string, field: 'principal' | 'amount', value: string) {
    const row = this.initialBalances.find((r) => r.id === id);
    if (row) {
      row[field] = value;
    }
  }

  // ============================================
  // Total Supply Calculation
  // ============================================

  totalSupply = $derived.by(() => {
    const total = this.initialBalances.reduce((sum, row) => {
      const amount = parseFloat(row.amount) || 0;
      return sum + amount;
    }, 0);

    // Format with appropriate decimals
    return total.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: this.decimals
    });
  });

  // ============================================
  // Prepare LedgerInitArgs
  // ============================================

  /**
   * Convert user-facing state to blockchain LedgerInitArgs
   * @param userPrincipal - The user's principal (used for archive controller)
   */
  prepareLedgerInitArgs(userPrincipal: Principal): LedgerInitArgs {
    // Convert transfer fee to smallest unit
    const transferFeeFloat = parseFloat(this.transferFee);
    const transferFeeUnits = BigInt(Math.round(transferFeeFloat * Math.pow(10, this.decimals)));

    // Convert initial balances to blockchain format
    const initialBalances: Array<[Account, bigint]> = this.initialBalances.map((row) => {
      const principal = Principal.fromText(row.principal);
      const amountFloat = parseFloat(row.amount);
      const amountUnits = BigInt(Math.round(amountFloat * Math.pow(10, this.decimals)));

      return [
        {
          owner: principal,
          subaccount: []
        },
        amountUnits
      ];
    });

    // Minting account - use registry canister if blackholed, otherwise use custom address
    const mintingAccount: Account = {
      owner: this.isBlackholed
        ? Principal.fromText(canisterIds.registry!)
        : Principal.fromText(this.mintingAddress),
      subaccount: []
    };

    // Archive options with sensible defaults
    const archiveOptions: ArchiveOptions = {
      num_blocks_to_archive: 1000n,
      trigger_threshold: 2000n,
      max_transactions_per_response: [1000n],
      max_message_size_bytes: [2_000_000n],
      cycles_for_archive_creation: [1_000_000_000_000n], // 1T cycles
      node_max_memory_size_bytes: [3_221_225_472n], // ~3GB
      controller_id: userPrincipal, // User as controller
      more_controller_ids: []
    };

    // Build metadata array with logo
    const metadata: Array<[string, { Text: string } | { Nat: bigint } | { Blob: Uint8Array }]> = [
      ['icrc1:logo', { Text: this.logoBase64 }]
    ];

    return {
      token_name: this.tokenName,
      token_symbol: this.tokenSymbol.toUpperCase(),
      decimals: [this.decimals],
      transfer_fee: transferFeeUnits,
      minting_account: mintingAccount,
      initial_balances: initialBalances,
      fee_collector_account: [], // Can be set later
      archive_options: archiveOptions,
      max_memo_length: [32],
      index_principal: [],
      metadata: metadata,
      feature_flags: [{ icrc2: true }] // Enable ICRC-2 by default
    };
  }

  // ============================================
  // Reset
  // ============================================

  reset() {
    this.tokenName = '';
    this.tokenSymbol = '';
    this.decimals = 8;
    this.transferFee = '0.0001';
    this.isBlackholed = true;
    this.mintingAddress = '';
    this.logoBase64 = '';
    this.initialBalances = [
      {
        id: crypto.randomUUID(),
        principal: '',
        amount: ''
      }
    ];
  }
}

// Export singleton instance
export const tokenCreation = new TokenCreationState();
