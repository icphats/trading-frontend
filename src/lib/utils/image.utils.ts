/**
 * Image Processing Utilities
 *
 * Architecture: FRONTEND_ARCHITECTURE.md - Utils Layer (Pure Functions)
 *
 * Cross-cutting pure functions for image processing, validation, and conversion.
 * Used across all domains for logo handling, file uploads, and image manipulation.
 *
 * @module utils/image
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================================
// BLOB � DATA URL CONVERSIONS
// ============================================================================

/**
 * Convert blob to base64 data URL
 * @param blob - The logo blob (Uint8Array) from ICRC-1 metadata
 * @returns Base64 data URL string or undefined if blob is invalid
 *
 * @example
 * convertLogoToDataUrl(new Uint8Array([...])) // "data:image/png;base64,..."
 */
export function convertLogoToDataUrl(blob: Uint8Array | null | undefined): string | undefined {
  if (!blob || blob.length === 0) {
    return undefined;
  }

  try {
    // Convert Uint8Array to base64
    const binary = Array.from(blob)
      .map((byte) => String.fromCharCode(byte))
      .join('');
    const base64 = btoa(binary);

    // Detect image type from magic bytes
    let mimeType = 'image/png'; // Default
    if (blob[0] === 0xFF && blob[1] === 0xD8) {
      mimeType = 'image/jpeg';
    } else if (blob[0] === 0x89 && blob[1] === 0x50) {
      mimeType = 'image/png';
    } else if (blob[0] === 0x47 && blob[1] === 0x49) {
      mimeType = 'image/gif';
    } else if (blob[0] === 0x52 && blob[1] === 0x49) {
      mimeType = 'image/webp';
    }

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Failed to convert logo blob to data URL:', error);
    return undefined;
  }
}

// ============================================================================
// IMAGE VALIDATION
// ============================================================================

/**
 * Validate image file type and size for token logo
 * @param file - The file to validate
 * @param maxSizeKB - Maximum file size in KB (default: 200KB)
 * @returns Validation result with error message if invalid
 *
 * @example
 * validateImageFile(file, 200) // { valid: true }
 * validateImageFile(file, 50) // { valid: false, error: "Image must be less than 50KB" }
 */
export function validateImageFile(
  file: File,
  maxSizeKB: number = 100
): ImageValidationResult {
  // Check file type — PNG only
  if (file.type !== 'image/png') {
    return {
      valid: false,
      error: 'Only PNG images are supported'
    };
  }

  // Check file size
  const maxBytes = maxSizeKB * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `Image must be less than ${maxSizeKB}KB`
    };
  }

  return { valid: true };
}

/**
 * Validate image is square and within allowed size range
 * @param file - The image file to check
 * @param minSize - Minimum dimension in pixels (default: 48)
 * @param maxSize - Maximum dimension in pixels (default: 256)
 * @returns Promise resolving to validation result
 */
export function validateImageDimensions(
  file: File,
  minSize: number = 48,
  maxSize: number = 256
): Promise<ImageValidationResult> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width !== img.height) {
        resolve({
          valid: false,
          error: `Image must be square (got ${img.width}×${img.height})`
        });
      } else if (img.width < minSize) {
        resolve({
          valid: false,
          error: `Image must be at least ${minSize}×${minSize}px (got ${img.width}×${img.height})`
        });
      } else if (img.width > maxSize) {
        resolve({
          valid: false,
          error: `Image must be at most ${maxSize}×${maxSize}px (got ${img.width}×${img.height})`
        });
      } else {
        resolve({ valid: true });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ valid: false, error: 'Failed to load image' });
    };

    img.src = url;
  });
}

