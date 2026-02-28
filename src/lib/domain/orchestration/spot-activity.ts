/**
 * Spot Activity Service
 *
 * Orchestrates fetching spot market transaction data.
 * Components should use this service instead of accessing actors directly.
 */

import { marketRepository } from '$lib/repositories/market.repository';
import type { SpotTransactionResponse, Side } from '$lib/actors/services/spot.service';

// Re-export Side type for components
export type { Side };

/**
 * Parsed transaction for UI display
 */
export interface ParsedTransaction {
  txId: number;
  priceE12: bigint;       // Execution price (E12 precision)
  timestamp: number;      // Unix timestamp in milliseconds
  amountBase: number;
  amountQuote: number;
  usdValue: number;
  side: Side;
}

/**
 * Parse a raw SpotTransactionResponse into a UI-friendly format
 */
function parseTransaction(tx: SpotTransactionResponse): ParsedTransaction {
  return {
    txId: Number(tx.id),
    priceE12: tx.price_e12,
    timestamp: Number(tx.timestamp),
    amountBase: Number(tx.base_amount) / 1e8,
    amountQuote: Number(tx.quote_amount) / 1e8,
    usdValue: Number(tx.usd_value_e6) / 1e6,
    side: tx.side,
  };
}

/**
 * Fetch transactions for a spot market canister
 */
export async function getSpotTransactions(
  spotCanisterId: string,
  limit: bigint = 20n
): Promise<ParsedTransaction[]> {
  try {
    const result = await marketRepository.fetchSpotTransactions(spotCanisterId, undefined, Number(limit));
    if ('err' in result) {
      console.error('[SpotActivity] Failed to fetch transactions:', result.err);
      return [];
    }
    return result.ok.data.map(parseTransaction);
  } catch (err) {
    console.error('[SpotActivity] Failed to fetch transactions:', err);
    return [];
  }
}

/**
 * Check if a side is a buy
 */
export function isBuy(side: Side): boolean {
  return 'buy' in side;
}
