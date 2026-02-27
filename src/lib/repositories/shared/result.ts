/**
 * Result Type
 *
 * Unified result type for repository operations.
 * Follows Rust/IC convention: { ok: T } | { err: E }
 *
 * @template T - Success value type
 * @template E - Error type (defaults to string)
 */
export type Result<T, E = string> = { ok: T } | { err: E };

/**
 * Type guard to check if result is successful
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: T } {
  return 'ok' in result;
}

/**
 * Type guard to check if result is an error
 */
export function isErr<T, E>(result: Result<T, E>): result is { err: E } {
  return 'err' in result;
}

/**
 * Unwrap a successful result or throw
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.ok;
  }
  throw new Error(String(result.err));
}

/**
 * Unwrap a successful result or return a default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.ok;
  }
  return defaultValue;
}

/**
 * Map successful result value
 */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (isOk(result)) {
    return { ok: fn(result.ok) };
  }
  return result;
}
