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
 * Validate image dimensions are within allowed size range and near-square.
 * Allows up to 20% aspect ratio deviation — images will be center-cropped to square.
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
      const shorter = Math.min(img.width, img.height);
      const longer = Math.max(img.width, img.height);
      const ratio = shorter / longer;

      if (ratio < 0.8) {
        resolve({
          valid: false,
          error: `Image is too rectangular (${img.width}×${img.height}). Aspect ratio must be close to square.`
        });
      } else if (shorter < minSize) {
        resolve({
          valid: false,
          error: `Image must be at least ${minSize}×${minSize}px (got ${img.width}×${img.height})`
        });
      } else if (longer > maxSize) {
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

/**
 * Center-crop an image file to a square, using the shorter dimension.
 * Returns a base64 data URL of the cropped PNG.
 */
export function cropToSquare(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const size = Math.min(img.width, img.height);
      const offsetX = (img.width - size) / 2;
      const offsetY = (img.height - size) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for cropping'));
    };

    img.src = url;
  });
}

