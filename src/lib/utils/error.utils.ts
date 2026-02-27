/**
 * Error Handling Utilities
 *
 * Utilities for formatting and handling API errors from ICP canisters.
 */

import type { ApiError } from 'declarations/spot/spot.did';

/**
 * Format an ApiError object into a human-readable error message
 *
 * @param apiError - The ApiError object from the canister
 * @returns Formatted error message with code, category, and metadata
 *
 * @example
 * // Input: { code: "INSUFFICIENT_BALANCE", message: "Not enough tokens", category: { user_error: null }, metadata: [] }
 * // Output: "INSUFFICIENT_BALANCE: Not enough tokens (user_error)"
 */
export function formatApiError(apiError: ApiError): string {
  const parts: string[] = [];

  // Add error code if present
  if (apiError.code) {
    parts.push(`[${apiError.code}]`);
  }

  // Add main error message
  if (apiError.message) {
    parts.push(apiError.message);
  }

  // Add category information
  if (apiError.category) {
    const categoryKey = Object.keys(apiError.category)[0];
    if (categoryKey) {
      parts.push(`(${categoryKey})`);
    }
  }

  // Add metadata if present
  if (apiError.metadata && apiError.metadata.length > 0 && apiError.metadata[0]) {
    const metadataStr = apiError.metadata[0]
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    parts.push(`\nDetails: ${metadataStr}`);
  }

  return parts.join(' ');
}

/**
 * Extract error message from various error types
 * Handles ApiError objects, Error instances, and plain strings
 *
 * @param error - The error to extract message from
 * @returns Human-readable error message
 */
export function extractErrorMessage(error: unknown): string {
  // Handle null/undefined
  if (!error) {
    return 'An unknown error occurred';
  }

  // Handle ApiError object
  if (typeof error === 'object' && 'message' in error && 'code' in error) {
    return formatApiError(error as ApiError);
  }

  // Handle Error instance
  if (error instanceof Error) {
    return error.message;
  }

  // Handle string
  if (typeof error === 'string') {
    return error;
  }

  // Handle objects with message property
  if (typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }

  // Last resort: stringify the error
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Format a Result type error for display
 *
 * @param result - Result object with { err: ApiError | string } shape
 * @returns Formatted error message
 */
export function formatResultError(result: { err: ApiError | string } | { ok: any }): string {
  if ('err' in result) {
    if (typeof result.err === 'string') {
      return result.err;
    }
    return formatApiError(result.err);
  }
  return 'Operation failed with unknown error';
}

/**
 * Log concise error information to console
 * Useful for debugging without cluttering the console
 *
 * @param context - Context string describing where the error occurred
 * @param error - The error to log
 */
export function logDetailedError(context: string, error: unknown): void {
  const message = extractErrorMessage(error);
  console.error(`❌ ${context}:`, message);

  // Only log the full object in development or if it's not a standard ApiError
  if (typeof error === 'object' && error !== null && !('code' in error && 'message' in error)) {
    console.error('Error details:', error);
  }
}
