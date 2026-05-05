import { useCallback } from "react";

/**
 * Hook to handle accessibility key events (Space and Enter)
 * Returns a helper function that can be used directly or inside loops.
 */
export default function useAccessibleClick() {
  const handleKeyDown = useCallback((e, action) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (action) action();
    }
  }, []);

  return handleKeyDown;
}
