/**
 * Trollbox Type Barrel
 *
 * Type-only re-exports from Candid declarations.
 * Runtime logic lives in domain/trollbox/trollbox.svelte.ts (calls actor directly).
 */

export type {
  _SERVICE as TrollboxService,
  MessageId,
  MessageResponse,
  HydrateResponse,
  MessageResult,
  MessagesResponse,
  UsernameResult,
  FrozenControl,
} from 'declarations/trollbox/trollbox.did';
