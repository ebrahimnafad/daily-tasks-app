import deepEqual from 'fast-deep-equal';

/**
 * Deep equality check.
 * This is a wrapper around fast-deep-equal.
 * It is used to compare complex objects for equality.
 */
export function isDeepEqual<T>(a: T, b: T): boolean {
  return deepEqual(a, b);
}
