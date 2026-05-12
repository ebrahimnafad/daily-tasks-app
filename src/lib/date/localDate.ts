/**
 * Returns today's date as a local YYYY-MM-DD string.
 *
 * IMPORTANT: Do NOT use `new Date().toISOString().split('T')[0]` — that returns
 * the UTC date which is wrong for users in UTC+ timezones during the early hours
 * of a new calendar day (e.g. 1 AM UTC+3 → still yesterday in UTC).
 */
export function localDateISO(from: Date = new Date()): string {
  const y = from.getFullYear();
  const m = String(from.getMonth() + 1).padStart(2, '0');
  const d = String(from.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the current month as a local YYYY-MM string.
 */
export function localMonthISO(from: Date = new Date()): string {
  const y = from.getFullYear();
  const m = String(from.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
