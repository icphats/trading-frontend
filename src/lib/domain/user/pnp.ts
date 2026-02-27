/**
 * Wallet Integration Placeholders
 *
 * The @windoge98/plug-n-play packages have been removed to eliminate version
 * conflicts with @dfinity packages. Each wallet below needs direct implementation.
 *
 * Currently Working:
 * - Internet Identity (all variants: II, Apple, Google, Microsoft) - see ii-signer.ts
 * - Oisy - see oisy-signer.ts
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ETHEREUM WALLETS (SIWE - Sign In With Ethereum)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * MetaMask, WalletConnect, Coinbase Wallet, OKX Wallet
 *
 * Implementation approach:
 * - Use `ic-siwe-js` directly (https://github.com/AstroxNetwork/ic-siwe)
 * - Create `src/lib/domain/user/wallets/ethereum.ts`
 * - Requires SIWE canister deployment
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SOLANA WALLETS (SIWS - Sign In With Solana)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Phantom, Solflare
 *
 * Implementation approach:
 * - Use `ic-siws-js` or similar
 * - Create `src/lib/domain/user/wallets/solana.ts`
 * - Requires SIWS canister deployment
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * IC NATIVE WALLETS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Plug:
 * - Use `@psychedelic/plug-connect` directly
 * - Create `src/lib/domain/user/wallets/plug.ts`
 * - Reference: https://github.com/AstroxNetwork/plug-connect
 *
 * NFID:
 * - Use NFID's SDK directly
 * - Create `src/lib/domain/user/wallets/nfid.ts`
 * - Reference: https://docs.nfid.one/
 */

// This file is a placeholder - all exports removed
