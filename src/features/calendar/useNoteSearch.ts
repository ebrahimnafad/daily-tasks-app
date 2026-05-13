import { useMemo } from 'react';
import type { CalendarNote } from './types';

/**
 * Filters and ranks notes by a search query.
 * Returns notes matching the query (case-insensitive substring),
 * sorted pinned-first then by updatedAt desc.
 */
export default function useNoteSearch(notes: CalendarNote[], query: string): CalendarNote[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return notes
      .filter(
        (n) =>
          n.text.toLowerCase().includes(q) ||
          n.date.includes(q) ||
          (n.tags && n.tags.some((t) => t.toLowerCase().includes(q)))
      )
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [notes, query]);
}
