// ── Calendar Notes ──────────────────────────────────────────────────────────

export interface CalendarNote {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** Raw markdown text */
  text: string;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp */
  updatedAt: string;
  pinned?: boolean;
  tags?: string[];
}
