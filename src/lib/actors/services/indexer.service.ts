/**
 * Indexer Type Barrel
 *
 * Type-only re-exports from Candid declarations.
 * All runtime logic lives in repositories (indexer.repository.ts, user.repository.ts).
 */

export type {
  _SERVICE as IndexerService,
  // Response types
  FrozenPlatformStats,
  MarketListResponse,
  PoolListResponse,
  TokenListResponse,
  FrozenTokenEntry,
  FrozenControl,
  ApiResult,
  SearchFilter,
  SearchResponse,
  TokenAggregate,
  TokenInfo,
  // List item types
  PoolListItem,
  MarketListItem,
  TokenListItem,
  // Pagination types
  VolumeCursor,
  ListQuery,
  // Platform snapshot types
  PlatformSnapshotView,
  PlatformSnapshotsResponse,
} from 'declarations/indexer/indexer.did';
