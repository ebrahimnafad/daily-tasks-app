// ══════════════════════════════════════════════════════════════════
//  scheduleConfig.ts — Single source of truth for shift/block/day
// ══════════════════════════════════════════════════════════════════

import { LS_KEYS } from '@/lib/storage/keys';

/** localStorage key for the user-configured day-start hour (0-23, default 0) */
export const DAY_START_HOUR_KEY = LS_KEYS.DAY_START_HOUR;

/**
 * Returns the "logical" date ISO string (YYYY-MM-DD).
 * If the current time is before `dayStartHour`, it's still considered
 * the previous calendar day — useful for users whose day starts after midnight.
 *
 * Examples:
 *   dayStartHour=0  → behaves like normal midnight rollover
 *   dayStartHour=15 → before 3 PM is treated as yesterday
 */
export function getLogicalDateISO(dayStartHour: number, from: Date = new Date()): string {
  const hour = from.getHours() + from.getMinutes() / 60;
  const effective = new Date(from);
  if (dayStartHour > 0 && hour < dayStartHour) {
    effective.setDate(effective.getDate() - 1);
  }
  // Use local date parts — toISOString() would return UTC which is wrong for UTC+ timezones
  const y = effective.getFullYear();
  const m = String(effective.getMonth() + 1).padStart(2, '0');
  const d = String(effective.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface TimeBlock {
  id: string;
  label: string;
  icon: string;
  /** Hour of day this block starts (0-23, decimals OK e.g. 18.5 = 6:30PM) */
  startHour: number;
  /** Hour of day this block ends (can wrap past midnight) */
  endHour: number;
  isOptional?: boolean;
  isRest?: boolean;
}

export type ShiftType = 'morning' | 'evening';

export interface ShiftConfig {
  id: ShiftType;
  label: string;
  icon: string;
  /** JS day numbers where work tasks are hidden (0=Sun…6=Sat) */
  offDays: number[];
  /** Human-readable off-day label */
  offDayLabel: string;
  /** Decimal hour on Friday at which the logical week boundary occurs.
   *  0 = calendar midnight (default), 4 = 04:00 AM, 4.5 = 04:30 AM.
   *  computeShift() treats times before this hour on Friday as still the previous week.
   *  Persisted automatically as part of ShiftConfig inside 'mhm_schedule'. */
  weekStartHour?: number;

  blocks: TimeBlock[];
  /** Custom block schedules per day of week (0=Sun…6=Sat) */
  dayOverrides?: Partial<Record<number, TimeBlock[]>>;
}

// ── Time Blocks ───────────────────────────────────────────────────

// ── Canonical block IDs — shared across both shifts ──────────────
// Same three IDs exist in morning and evening (different hours, same semantics).
// Tasks assigned to these blocks appear in the correct block regardless of which
// shift is active — no cross-shift drift.
const MORNING_BLOCKS: TimeBlock[] = [
  { id: 'work', label: 'وقت العمل', icon: '💼', startHour: 5, endHour: 13.5 },
  { id: 'family', label: 'وقت العائلة', icon: '👨‍👩‍👦', startHour: 14, endHour: 21 },
  { id: 'rest-sleep', label: 'الراحة والنوم', icon: '😴', startHour: 21, endHour: 4, isRest: true },
];

const EVENING_BLOCKS: TimeBlock[] = [
  { id: 'rest-sleep', label: 'النوم والراحة', icon: '😴', startHour: 3, endHour: 12, isRest: true },
  { id: 'family', label: 'وقت العائلة', icon: '👨‍👩‍👦', startHour: 12, endHour: 18 },
  { id: 'work', label: 'وقت العمل', icon: '💼', startHour: 18, endHour: 2.5 },
];

// ── Default Shifts ─────────────────────────────────────────────────

export const DEFAULT_SHIFTS: ShiftConfig[] = [
  {
    id: 'evening',
    label: 'الأسبوع المسائي',
    icon: '🌙',
    offDays: [], // Kept for CalendarPage/ScheduleSettingsModal — isWorkday() ignores this
    //             for the evening shift by design: evening is a 7-day rotation with no
    //             off days regardless of what the user sets. See isWorkday() below.
    offDayLabel: '',
    weekStartHour: 0, // midnight — matches existing behavior, safe default

    blocks: EVENING_BLOCKS,
  },
  {
    id: 'morning',
    label: 'الأسبوع الصباحي',
    icon: '☀️',
    offDays: [4, 6], // Thursday + Saturday
    offDayLabel: 'إجازة — الخميس والسبت',
    weekStartHour: 0, // midnight — matches existing behavior, safe default

    blocks: MORNING_BLOCKS,
  },
];

// ── Auto-shift computation ────────────────────────────────────────

/**
 * The epoch is an ISO date string of a Friday that started an EVENING week.
 * Stored in localStorage as 'mhm_shift_epoch'.
 *
 * Default: the most recent Friday (inclusive) is treated as the start of
 * an evening week when no epoch is stored yet.
 */
export const DEFAULT_EPOCH_KEY = LS_KEYS.EPOCH;

/** Returns the ISO date string (YYYY-MM-DD) of the most recent Friday ≤ today */
export function getMostRecentFriday(from: Date = new Date()): string {
  const d = new Date(from);
  const day = d.getDay(); // 0=Sun…5=Fri…6=Sat
  const daysBack = day === 5 ? 0 : day < 5 ? day + 2 : 1; // days since last Friday
  d.setDate(d.getDate() - daysBack);
  // Use local date parts — toISOString() would return UTC
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/**
 * Compute current shift from epoch.
 * Each Friday begins a new week. Cycles through the provided shifts array.
 * By default, shifts[0] corresponds to the epoch week (weeksElapsed = 0).
 */
export function computeShift(
  epochFridayISO: string,
  shifts: ShiftConfig[],
  today: Date = new Date()
): ShiftType {
  if (!shifts || shifts.length === 0) return 'morning'; // fallback
  // fires at user-configured week-start hour, not hardcoded midnight.
  // All shifts share one physical week boundary — use shifts[0].weekStartHour to avoid
  // circular dependency (computeShift cannot know the current shift without calling itself).
  // With weekStartHour=0 (default) adjusted === today — identical behaviour to before.
  const offsetHours = shifts[0].weekStartHour ?? 0;
  const adjusted = new Date(today.getTime() - offsetHours * 60 * 60 * 1000);

  const epoch = new Date(epochFridayISO + 'T00:00:00');
  const thisFriday = new Date(getMostRecentFriday(adjusted) + 'T00:00:00');
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksElapsed = Math.round((thisFriday.getTime() - epoch.getTime()) / msPerWeek);

  const cycleIndex = ((weeksElapsed % shifts.length) + shifts.length) % shifts.length;
  return shifts[cycleIndex].id;
}

/**
 * Given current shift and today's day-of-week, return whether today is a work day.
 * Friday is always a workday but with special hours.
 *
 * NOTE — evening shift: by design this is a 7-day rotation with no days off.
 * isWorkday() always returns true for 'evening' regardless of the offDays field
 * stored in ShiftConfig. The offDays field on the evening entry exists only for
 * CalendarPage and ScheduleSettingsModal compatibility — it has no effect here.
 * Do not remove this guard without a deliberate product decision.
 */
export function isWorkday(shiftId: string, shifts: ShiftConfig[], dayOfWeek: number): boolean {
  // By design: evening shift is a 7-day rotation — always a workday.
  // User-configured off days are intentionally ignored for this shift.
  if (shiftId === 'evening') return true;

  const shift = shifts.find((s) => s.id === shiftId);
  if (!shift) return true;
  // Off days are user-editable via ScheduleSettingsModal and stored in ShiftConfig.
  // This is the single source of truth for non-evening shifts.
  return !shift.offDays.includes(dayOfWeek);
}

/**
 * Determine which time block is currently active, given shift and current hour.
 * Returns the block ID or null if no block matches.
 */
export function getCurrentBlockId(
  shiftId: string,
  shifts: ShiftConfig[],
  hourDecimal: number,
  dayOfWeek?: number
): string | null {
  const shift = shifts.find((s) => s.id === shiftId);
  if (!shift) return null;

  const blocks = (dayOfWeek !== undefined && shift.dayOverrides?.[dayOfWeek]) || shift.blocks;

  for (const block of blocks) {
    const { startHour, endHour } = block;
    if (endHour > startHour) {
      // Normal range (doesn't cross midnight)
      if (hourDecimal >= startHour && hourDecimal < endHour) return block.id;
    } else {
      // Wraps midnight (e.g. rest: 21→4, work-late: 0.5→2.5)
      if (hourDecimal >= startHour || hourDecimal < endHour) return block.id;
    }
  }
  return null;
}

// ── Legacy time → block mapping (for migration) ───────────────────

// ── Legacy time-label → canonical block ID mapping ───────────────
// Used during task import/migration for tasks that still carry the old
// Arabic time-of-day string in `task.time`. Maps to canonical block IDs.
export const LEGACY_TIME_TO_BLOCK: Record<string, string> = {
  'الصباح الباكر': 'work',
  الصباح: 'work',
  الضحى: 'work',
  'قبل الظهر': 'work',
  الظهر: 'family',
  'بعد الظهر': 'family',
  العصر: 'family',
  'بعد العصر': 'family',
  المغرب: 'family',
  'بين المغرب والعشاء': 'family',
  العشاء: 'rest-sleep',
  الليل: 'rest-sleep',
  'طوال اليوم': 'prayer',
  المساء: 'family',
};

// ── Block ID migration map (v1 → v2 canonical IDs) ────────────────
// Applied once on first app load after the canonical-block redesign.
// Maps every old default block ID to its canonical replacement.
export const BLOCK_ID_MIGRATION_V2: Record<string, string> = {
  // Morning old IDs
  'pre-fajr': 'anytime', // deleted block — tasks go to unscheduled bucket
  'work-early': 'work',
  'work-main': 'work',
  walking: 'family',
  rest: 'rest-sleep',
  // Evening old IDs
  sleep: 'rest-sleep',
  'work-prep': 'work',
  'work-coding': 'work',
  'work-late': 'work',
  // Canonical IDs — pass-through (already correct)
  work: 'work',
  family: 'family',
  'rest-sleep': 'rest-sleep',
  anytime: 'anytime',
};
