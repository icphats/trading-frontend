/**
 * Domain Layer Public API
 *
 * Central exports for domain-level state and entities.
 *
 * Structure:
 * - orchestration/  → Cross-domain coordination (entity-store, loaders)
 * - markets/        → Market domain (state/, utils/, types)
 * - tokens/         → Token domain (state/, utils/, types)
 * - user/           → User domain (auth, portfolio)
 * - platform/       → Platform-wide metrics and stats from indexer
 */

// Orchestration - Cross-domain coordination
export * from './orchestration';

// Domain modules
export * from './tokens';
export * from './markets';
export * from './user';
export * from './platform';
