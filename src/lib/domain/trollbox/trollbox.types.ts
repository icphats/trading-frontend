/**
 * Trollbox Domain Types
 * Architecture Compliance: FRONTEND_ARCHITECTURE.md - Domain Layer
 * Migrated from: canisters/trollbox/types.ts
 */

// ============================================
// Backend Types (Re-exports from Service Layer)
// ============================================

export type {
  // Core types
  MessageId,

  // Response types
  MessageResponse,
  MessagesResponse,
  HydrateResponse,

  // Result types
  MessageResult,
  UsernameResult,

  // Config
  FrozenControl,

  // Actor service
  TrollboxService,
} from '$lib/actors/services/trollbox.service';

// ============================================
// Frontend-Specific Types
// ============================================

/**
 * Frontend-friendly message structure
 */
export interface Message {
  id: bigint;
  content: string;
  username: string | null;
  author: string; // Principal as string
  created_at: bigint;
  status?: 'pending' | 'failed'; // Only set for optimistic messages
}

/**
 * Chat form state interface
 */
export interface ChatFormState {
  message: string;
  isSubmitting: boolean;
  error: string | null;
}

/**
 * Username form state interface
 */
export interface UsernameFormState {
  username: string;
  isSubmitting: boolean;
  error: string | null;
}
