// ── holidays.ts — Saudi National & Islamic Events 2025-2027 ──────────────
// Islamic dates are approximate (±1-2 days). Actual dates depend on
// official Saudi moon sighting. Users can adjust per-group via the
// banner controls; offsets are persisted to localStorage.

export type HolidayType = 'national' | 'eid' | 'islamic' | 'ramadan';

export const LS_HOLIDAY_OFFSETS = 'mhm_holiday_offsets';

export interface Holiday {
  date: string; // YYYY-MM-DD (after offset applied)
  name: string; // Arabic name including day ordinal
  icon: string;
  type: HolidayType;
  groupId: string;
  approximate: boolean;
  dayIndex: number; // 0-based within multi-day group
}

export interface HolidayGroup {
  id: string;
  name: string;
  icon: string;
  type: HolidayType;
  baseDates: string[]; // ordered YYYY-MM-DD (pre-offset)
  approximate: boolean;
}

// Arabic ordinals for multi-day events
const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع'];

/** Shift a YYYY-MM-DD string by N days */
export function addDays(dateStr: string, days: number): string {
  if (days === 0) return dateStr;
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Build the date → Holiday flat map from groups + per-group day offsets */
export function buildHolidayMap(
  groups: HolidayGroup[],
  offsets: Record<string, number>
): Record<string, Holiday> {
  const map: Record<string, Holiday> = {};
  for (const group of groups) {
    const offset = offsets[group.id] ?? 0;
    group.baseDates.forEach((base, idx) => {
      const date = addDays(base, offset);
      map[date] = {
        date,
        name:
          group.baseDates.length > 1
            ? `${group.name} — اليوم ${ORDINALS[idx] ?? String(idx + 1)}`
            : group.name,
        icon: group.icon,
        type: group.type,
        groupId: group.id,
        approximate: group.approximate,
        dayIndex: idx,
      };
    });
  }
  return map;
}

export const HOLIDAY_GROUPS: HolidayGroup[] = [
  // ── Saudi National (fixed Gregorian) ────────────────────────────────
  {
    id: 'founding-2025',
    name: 'يوم التأسيس',
    icon: '🇸🇦',
    type: 'national',
    baseDates: ['2025-02-22'],
    approximate: false,
  },
  {
    id: 'national-2025',
    name: 'اليوم الوطني ٩٥',
    icon: '🇸🇦',
    type: 'national',
    baseDates: ['2025-09-23'],
    approximate: false,
  },
  {
    id: 'founding-2026',
    name: 'يوم التأسيس',
    icon: '🇸🇦',
    type: 'national',
    baseDates: ['2026-02-22'],
    approximate: false,
  },
  {
    id: 'national-2026',
    name: 'اليوم الوطني ٩٦',
    icon: '🇸🇦',
    type: 'national',
    baseDates: ['2026-09-23'],
    approximate: false,
  },
  {
    id: 'founding-2027',
    name: 'يوم التأسيس',
    icon: '🇸🇦',
    type: 'national',
    baseDates: ['2027-02-22'],
    approximate: false,
  },
  {
    id: 'national-2027',
    name: 'اليوم الوطني ٩٧',
    icon: '🇸🇦',
    type: 'national',
    baseDates: ['2027-09-23'],
    approximate: false,
  },

  // ── 2025 / 1446–1447 AH ─────────────────────────────────────────────
  {
    id: 'ramadan-2025',
    name: 'بداية رمضان ١٤٤٦',
    icon: '🌙',
    type: 'ramadan',
    baseDates: ['2025-03-01'],
    approximate: true,
  },
  {
    id: 'eid-fitr-2025',
    name: 'عيد الفطر',
    icon: '🎉',
    type: 'eid',
    baseDates: ['2025-03-30', '2025-03-31', '2025-04-01'],
    approximate: true,
  },
  {
    id: 'eid-adha-2025',
    name: 'عيد الأضحى',
    icon: '🐑',
    type: 'eid',
    baseDates: ['2025-06-06', '2025-06-07', '2025-06-08', '2025-06-09'],
    approximate: true,
  },
  {
    id: 'new-year-1447',
    name: 'رأس السنة الهجرية ١٤٤٧',
    icon: '☪️',
    type: 'islamic',
    baseDates: ['2025-06-26'],
    approximate: true,
  },
  {
    id: 'mawlid-1447',
    name: 'المولد النبوي الشريف',
    icon: '⭐',
    type: 'islamic',
    baseDates: ['2025-09-04'],
    approximate: true,
  },

  // ── 2026 / 1447–1448 AH ─────────────────────────────────────────────
  {
    id: 'ramadan-2026',
    name: 'بداية رمضان ١٤٤٧',
    icon: '🌙',
    type: 'ramadan',
    baseDates: ['2026-02-17'],
    approximate: true,
  },
  {
    id: 'eid-fitr-2026',
    name: 'عيد الفطر',
    icon: '🎉',
    type: 'eid',
    baseDates: ['2026-03-19', '2026-03-20', '2026-03-21'],
    approximate: true,
  },
  {
    id: 'eid-adha-2026',
    name: 'عيد الأضحى',
    icon: '🐑',
    type: 'eid',
    baseDates: ['2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30'],
    approximate: true,
  },
  {
    id: 'new-year-1448',
    name: 'رأس السنة الهجرية ١٤٤٨',
    icon: '☪️',
    type: 'islamic',
    baseDates: ['2026-06-16'],
    approximate: true,
  },
  {
    id: 'mawlid-1448',
    name: 'المولد النبوي الشريف',
    icon: '⭐',
    type: 'islamic',
    baseDates: ['2026-08-25'],
    approximate: true,
  },

  // ── 2027 / 1448–1449 AH ─────────────────────────────────────────────
  {
    id: 'ramadan-2027',
    name: 'بداية رمضان ١٤٤٨',
    icon: '🌙',
    type: 'ramadan',
    baseDates: ['2027-02-06'],
    approximate: true,
  },
  {
    id: 'eid-fitr-2027',
    name: 'عيد الفطر',
    icon: '🎉',
    type: 'eid',
    baseDates: ['2027-03-07', '2027-03-08', '2027-03-09'],
    approximate: true,
  },
  {
    id: 'eid-adha-2027',
    name: 'عيد الأضحى',
    icon: '🐑',
    type: 'eid',
    baseDates: ['2027-05-16', '2027-05-17', '2027-05-18', '2027-05-19'],
    approximate: true,
  },
  {
    id: 'new-year-1449',
    name: 'رأس السنة الهجرية ١٤٤٩',
    icon: '☪️',
    type: 'islamic',
    baseDates: ['2027-06-05'],
    approximate: true,
  },
  {
    id: 'mawlid-1449',
    name: 'المولد النبوي الشريف',
    icon: '⭐',
    type: 'islamic',
    baseDates: ['2027-08-15'],
    approximate: true,
  },
];

/** CSS accent colour per holiday type */
export const HOLIDAY_COLOR: Record<HolidayType, string> = {
  national: 'rgba(0, 108, 53, 0.85)',
  eid: 'rgba(16, 185, 129, 0.82)',
  islamic: 'rgba(99, 102, 241, 0.80)',
  ramadan: 'rgba(168, 85, 247, 0.80)',
};
