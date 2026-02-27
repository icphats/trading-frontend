import { MEME_BY_SHORTCODE, type Meme } from './memes';

/**
 * Parse a message and replace meme shortcodes with image HTML
 * Returns an array of text and meme objects for rendering
 */
export function parseMessageForMemes(content: string): Array<{ type: 'text' | 'meme'; value: string | Meme }> {
  const result: Array<{ type: 'text' | 'meme'; value: string | Meme }> = [];
  
  // Regular expression to match :shortcode: patterns
  const memeRegex = /(:[a-zA-Z0-9_-]+:)/g;
  let lastIndex = 0;
  let match;
  
  while ((match = memeRegex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      result.push({
        type: 'text',
        value: content.substring(lastIndex, match.index)
      });
    }
    
    // Check if this is a valid meme shortcode
    const shortcode = match[1];
    const meme = MEME_BY_SHORTCODE.get(shortcode);
    
    if (meme) {
      // Add the meme
      result.push({
        type: 'meme',
        value: meme
      });
    } else {
      // Not a valid meme, treat as text
      result.push({
        type: 'text',
        value: shortcode
      });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining text
  if (lastIndex < content.length) {
    result.push({
      type: 'text',
      value: content.substring(lastIndex)
    });
  }
  
  return result;
}

/**
 * Replace meme shortcodes with placeholder text for backend storage
 * The backend stores the raw shortcodes, not the images
 */
export function prepareMemeMessageForBackend(content: string): string {
  // The message is already in the correct format with shortcodes
  // This function exists for future processing if needed
  return content.trim();
}

/**
 * Check if cursor is positioned to show meme suggestions
 * Returns the partial shortcode if typing one, null otherwise
 */
export function getMemeAutocompleteContext(
  text: string,
  cursorPosition: number
): { partial: string; startIndex: number } | null {
  // Look for a ':' before the cursor position
  let startIndex = -1;
  
  for (let i = cursorPosition - 1; i >= 0; i--) {
    if (text[i] === ':') {
      startIndex = i;
      break;
    }
    // Stop if we hit a space or newline (shortcodes don't contain these)
    if (text[i] === ' ' || text[i] === '\n') {
      break;
    }
  }
  
  if (startIndex === -1) {
    return null;
  }
  
  // Extract the partial shortcode
  const partial = text.substring(startIndex, cursorPosition);
  
  // Only return if it looks like a shortcode in progress
  if (partial.match(/^:[a-zA-Z0-9_-]*$/)) {
    return { partial, startIndex };
  }
  
  return null;
}

/**
 * Get filtered memes based on partial shortcode
 */
export function getFilteredMemes(partial: string, memes: Meme[]): Meme[] {
  if (!partial || partial === ':') {
    return memes;
  }
  
  const searchTerm = partial.substring(1).toLowerCase(); // Remove the ':'
  
  return memes.filter(meme => 
    meme.shortcode.toLowerCase().includes(searchTerm) ||
    meme.name.toLowerCase().includes(searchTerm)
  );
}