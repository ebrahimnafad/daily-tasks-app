import { useCallback } from 'react';
import type { KeyboardEvent } from 'react';

/**
 * Returns a handler for keyboard accessibility (Space / Enter triggers action).
 */
export default function useAccessibleClick() {
  const handleKeyDown = useCallback((e: KeyboardEvent, action?: () => void) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      action?.();
    }
  }, []);

  return handleKeyDown;
}
