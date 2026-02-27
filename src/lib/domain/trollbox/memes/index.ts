/**
 * Memes Module
 * Provides meme/emoji definitions and utilities for the trollbox chat
 */

// ============================================
// Types & Data
// ============================================
export {
  MEMES,
  MEME_BY_SHORTCODE,
  MEME_BY_ID,
  getAllShortcodes,
  containsMemes,
  getMemesByCategory,
  type Meme
} from './memes';

// ============================================
// Utilities
// ============================================
export {
  parseMessageForMemes,
  prepareMemeMessageForBackend,
  getMemeAutocompleteContext,
  getFilteredMemes
} from './meme-utils';
