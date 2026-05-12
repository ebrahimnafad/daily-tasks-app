// ══════════════════════════════════════════════════════════════════
//  scheduleConfig.ts — Single source of truth for shift/block/day
// ══════════════════════════════════════════════════════════════════

/** localStorage key for the user-configured day-start hour (0-23, default 0) */
export const DAY_START_HOUR_KEY = 'mhm_day_start_hour';

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

export interface FridaySchedule {
  /** 24h decimal start, e.g. 18.5 = 6:30 PM */
  start: number;
  /** 24h decimal end — may be next day, e.g. 3 = 3 AM next day */
  end: number;
  label: string;
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
  /** Friday special schedule for this shift */
  fridaySchedule: FridaySchedule;
  blocks: TimeBlock[];
  /** Custom block schedules per day of week (0=Sun…6=Sat) */
  dayOverrides?: Partial<Record<number, TimeBlock[]>>;
}

// ── Time Blocks ───────────────────────────────────────────────────

const MORNING_BLOCKS: TimeBlock[] = [
  { id: 'pre-fajr', label: 'قبل الفجر', icon: '🌙', startHour: 4, endHour: 5 },
  { id: 'work-early', label: 'بداية الدوام', icon: '💼', startHour: 5, endHour: 9 },
  { id: 'work-main', label: 'الدوام الرئيسي', icon: '🤝', startHour: 9, endHour: 13.5 },
  { id: 'family', label: 'وقت العائلة', icon: '👨‍👩‍👦', startHour: 14, endHour: 19 },
  { id: 'walking', label: 'المشي', icon: '🚶', startHour: 19, endHour: 20.5, isOptional: true },
  { id: 'rest', label: 'الراحة والنوم', icon: '😴', startHour: 21, endHour: 4, isRest: true },
];

const EVENING_BLOCKS: TimeBlock[] = [
  { id: 'sleep', label: 'النوم والراحة', icon: '😴', startHour: 3, endHour: 12, isRest: true },
  { id: 'family', label: 'وقت العائلة', icon: '👨‍👩‍👦', startHour: 12, endHour: 18 },
  { id: 'work-prep', label: 'بداية الدوام', icon: '📧', startHour: 18, endHour: 19 },
  { id: 'work-coding', label: 'وقت البرمجة', icon: '💻', startHour: 19, endHour: 24 }, // midnight
  { id: 'work-late', label: 'آخر الدوام', icon: '📋', startHour: 0.5, endHour: 2.5 },
];

// ── Default Shifts ─────────────────────────────────────────────────

export const DEFAULT_SHIFTS: ShiftConfig[] = [
  {
    id: 'evening',
    label: 'الأسبوع المسائي',
    icon: '🌙',
    offDays: [], // No fixed off days
    offDayLabel: '',
    fridaySchedule: {
      start: 13, // 1:00 PM
      end: 21.5, // 9:30 PM
      label: 'الجمعة (بعد الظهر) ١م — ٩:٣٠م',
    },
    blocks: EVENING_BLOCKS,
  },
  {
    id: 'morning',
    label: 'الأسبوع الصباحي',
    icon: '☀️',
    offDays: [4, 6], // Thursday + Saturday
    offDayLabel: 'إجازة — الخميس والسبت',
    fridaySchedule: {
      start: 18.5, // 6:30 PM
      end: 3, // 3:00 AM next day
      label: 'الجمعة (مسائي) ٦:٣٠م — ٣ص',
    },
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
export const DEFAULT_EPOCH_KEY = 'mhm_shift_epoch';

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
  const epoch = new Date(epochFridayISO + 'T00:00:00');
  const thisFriday = new Date(getMostRecentFriday(today) + 'T00:00:00');
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksElapsed = Math.round((thisFriday.getTime() - epoch.getTime()) / msPerWeek);

  const cycleIndex = ((weeksElapsed % shifts.length) + shifts.length) % shifts.length;
  return shifts[cycleIndex].id;
}

/**
 * Given current shift and today's day-of-week, return whether today is a work day.
 * Friday is always a workday but with special hours.
 */
export function isWorkday(shiftId: string, shifts: ShiftConfig[], dayOfWeek: number): boolean {
  const shift = shifts.find((s) => s.id === shiftId);
  if (!shift) return true;
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

export const LEGACY_TIME_TO_BLOCK: Record<string, string> = {
  'الصباح الباكر': 'work-early',
  الصباح: 'work-early',
  الضحى: 'work-main',
  'قبل الظهر': 'work-main',
  الظهر: 'family',
  'بعد الظهر': 'family',
  العصر: 'family',
  'بعد العصر': 'family',
  المغرب: 'walking',
  'بين المغرب والعشاء': 'walking',
  العشاء: 'rest',
  الليل: 'rest',
  'طوال اليوم': 'prayer',
  المساء: 'walking',
};
