/**
 * Hardcoded Token Definitions
 *
 * Static token configuration for known platform tokens.
 * Used by repositories and domain layer.
 */

import type { TokenDefinition } from '$lib/domain/tokens/token.types';
import { canisterIds } from './app.constants';

const definitions: TokenDefinition[] = [];

// PARTY Token (conditional - only if configured)
if (canisterIds.icrc_ledger) {
  definitions.push({
    canisterId: canisterIds.icrc_ledger,
    symbol: 'PARTY',
    name: 'Party Token',
    decimals: 8,
    initialFee: 100_000n,
    logo: '/tokens/party.svg',
    priceDecimals: 8,
  });
}

// ICP Token (always included with fallback)
definitions.push({
  canisterId: canisterIds.icp_ledger || "ryjl3-tyaaa-aaaaa-aaaba-cai",
  symbol: 'ICP',
  name: 'Internet Computer',
  decimals: 8,
  initialFee: 10_000n,
  logo: '/tokens/icp.svg',
  isQuoteToken: true,
  priceDecimals: 8,
});

// ckUSDT (displayed as USDT without ck prefix)
definitions.push({
  canisterId: 'cngnf-vqaaa-aaaar-qag4q-cai',
  symbol: 'USDT',
  name: 'Tether USD',
  decimals: 6,
  initialFee: 10_000n,
  logo: '/tokens/usdt.svg',
  isQuoteToken: true,
  initialPrice: 100000000n,
  priceDecimals: 8,
});

// ckUSDC (displayed as USDC without ck prefix)
definitions.push({
  canisterId: 'xevnm-gaaaa-aaaar-qafnq-cai',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  initialFee: 10_000n,
  logo: '/tokens/usdc.svg',
  isQuoteToken: true,
  initialPrice: 100000000n,
  priceDecimals: 8,
});

// ckBTC (displayed as BTC without ck prefix)
definitions.push({
  canisterId: 'mxzaz-hqaaa-aaaar-qaada-cai',
  symbol: 'BTC',
  name: 'Bitcoin',
  decimals: 8,
  initialFee: 10n,
  logo: '/tokens/btc.svg',
  priceDecimals: 8,
});

// ckETH (displayed as ETH without ck prefix)
definitions.push({
  canisterId: 'ss2fx-dyaaa-aaaar-qacoq-cai',
  symbol: 'ETH',
  name: 'Ethereum',
  decimals: 18,
  initialFee: 2_000_000_000_000n,
  logo: '/tokens/eth.svg',
  priceDecimals: 8,
});

export const TOKEN_DEFINITIONS: readonly TokenDefinition[] = definitions;
