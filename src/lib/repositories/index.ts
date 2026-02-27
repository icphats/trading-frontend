/**
 * Repository Layer
 *
 * Data access layer that sits between services and domain entities
 * Provides caching and error handling
 */

// Cache layer
export * from './cache';

// Shared infrastructure
export * from './shared/result';
export * from './shared/cleanup';

// Repository instances
export { marketRepository, MarketRepository, type MarketResult } from './market.repository';
export { indexerRepository, IndexerRepository } from './indexer.repository';
export {
  tokenRepository,
  TokenRepository,
  type TokenMetadata,
  type TokenBalance,
  type TokenSource,
  type DiscoveredToken,
} from './token.repository';
export {
  userRepository,
  UserRepository,
} from './user.repository';
export {
  pricingRepository,
  PricingRepository,
  type PriceSource,
  type PriceData,
  type PriceFetchResult,
} from './pricing.repository';
export {
  oracleRepository,
  OracleRepository,
} from './oracle.repository';

// ============================================
// Identity Change Handler
// ============================================

import { actorRegistry } from './cache';
import { tokenRepository as _tokenRepo } from './token.repository';
import { userRepository as _userRepo } from './user.repository';
import { onIdentityChange } from '$lib/domain/user/identity-events';

/**
 * Clear all actor caches when identity changes.
 *
 * Why: Actors bind to the agent at creation time. When identity changes
 * (login/logout), cached actors still use the old agent, causing
 * "Certificate verification failed" errors on update calls.
 */
function clearAllActorCaches(): void {
  // Clear shared registry (used by MarketRepository, etc.)
  actorRegistry.clearAll();

  // Clear private repository caches
  _tokenRepo.clearActorCache();
  _userRepo.clearActorCache();

}

// Register the callback with auth module
onIdentityChange(clearAllActorCaches);
