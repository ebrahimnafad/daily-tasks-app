// ── holidays.ts — Saudi National & Islamic Events 2025-2027 ──────────────
// Islamic dates are approximate (±1 day) — actual dates depend on moon sighting.

export type HolidayType = 'national' | 'eid' | 'islamic' | 'ramadan';

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string; // Arabic name
  icon: string;
  type: HolidayType;
  note?: string;
}

export const HOLIDAYS: Holiday[] = [
  // ── Saudi National Holidays (fixed Gregorian) ────────────────────────
  { date: '2025-02-22', name: 'يوم التأسيس', icon: '🇸🇦', type: 'national' },
  { date: '2025-09-23', name: 'اليوم الوطني ٩٥', icon: '🇸🇦', type: 'national' },

  { date: '2026-02-22', name: 'يوم التأسيس', icon: '🇸🇦', type: 'national' },
  { date: '2026-09-23', name: 'اليوم الوطني ٩٦', icon: '🇸🇦', type: 'national' },

  { date: '2027-02-22', name: 'يوم التأسيس', icon: '🇸🇦', type: 'national' },
  { date: '2027-09-23', name: 'اليوم الوطني ٩٧', icon: '🇸🇦', type: 'national' },

  // ── 2025 / 1446–1447 AH ─────────────────────────────────────────────
  { date: '2025-03-01', name: 'بداية رمضان ١٤٤٦', icon: '🌙', type: 'ramadan', note: 'تقريبي' },

  { date: '2025-03-30', name: 'عيد الفطر — اليوم الأول', icon: '🎉', type: 'eid', note: 'تقريبي' },
  { date: '2025-03-31', name: 'عيد الفطر — اليوم الثاني', icon: '🎉', type: 'eid' },
  { date: '2025-04-01', name: 'عيد الفطر — اليوم الثالث', icon: '🎉', type: 'eid' },

  { date: '2025-06-06', name: 'عيد الأضحى — اليوم الأول', icon: '🐑', type: 'eid', note: 'تقريبي' },
  { date: '2025-06-07', name: 'عيد الأضحى — اليوم الثاني', icon: '🐑', type: 'eid' },
  { date: '2025-06-08', name: 'عيد الأضحى — اليوم الثالث', icon: '🐑', type: 'eid' },
  { date: '2025-06-09', name: 'عيد الأضحى — اليوم الرابع', icon: '🐑', type: 'eid' },

  {
    date: '2025-06-26',
    name: 'رأس السنة الهجرية ١٤٤٧',
    icon: '☪️',
    type: 'islamic',
    note: 'تقريبي',
  },
  { date: '2025-09-04', name: 'المولد النبوي الشريف', icon: '⭐', type: 'islamic', note: 'تقريبي' },

  // ── 2026 / 1447–1448 AH ─────────────────────────────────────────────
  { date: '2026-02-17', name: 'بداية رمضان ١٤٤٧', icon: '🌙', type: 'ramadan', note: 'تقريبي' },

  { date: '2026-03-19', name: 'عيد الفطر — اليوم الأول', icon: '🎉', type: 'eid', note: 'تقريبي' },
  { date: '2026-03-20', name: 'عيد الفطر — اليوم الثاني', icon: '🎉', type: 'eid' },
  { date: '2026-03-21', name: 'عيد الفطر — اليوم الثالث', icon: '🎉', type: 'eid' },

  { date: '2026-05-27', name: 'عيد الأضحى — اليوم الأول', icon: '🐑', type: 'eid', note: 'تقريبي' },
  { date: '2026-05-28', name: 'عيد الأضحى — اليوم الثاني', icon: '🐑', type: 'eid' },
  { date: '2026-05-29', name: 'عيد الأضحى — اليوم الثالث', icon: '🐑', type: 'eid' },
  { date: '2026-05-30', name: 'عيد الأضحى — اليوم الرابع', icon: '🐑', type: 'eid' },

  {
    date: '2026-06-16',
    name: 'رأس السنة الهجرية ١٤٤٨',
    icon: '☪️',
    type: 'islamic',
    note: 'تقريبي',
  },
  { date: '2026-08-25', name: 'المولد النبوي الشريف', icon: '⭐', type: 'islamic', note: 'تقريبي' },

  // ── 2027 / 1448–1449 AH ─────────────────────────────────────────────
  { date: '2027-02-06', name: 'بداية رمضان ١٤٤٨', icon: '🌙', type: 'ramadan', note: 'تقريبي' },

  { date: '2027-03-07', name: 'عيد الفطر — اليوم الأول', icon: '🎉', type: 'eid', note: 'تقريبي' },
  { date: '2027-03-08', name: 'عيد الفطر — اليوم الثاني', icon: '🎉', type: 'eid' },
  { date: '2027-03-09', name: 'عيد الفطر — اليوم الثالث', icon: '🎉', type: 'eid' },

  { date: '2027-05-16', name: 'عيد الأضحى — اليوم الأول', icon: '🐑', type: 'eid', note: 'تقريبي' },
  { date: '2027-05-17', name: 'عيد الأضحى — اليوم الثاني', icon: '🐑', type: 'eid' },
  { date: '2027-05-18', name: 'عيد الأضحى — اليوم الثالث', icon: '🐑', type: 'eid' },
  { date: '2027-05-19', name: 'عيد الأضحى — اليوم الرابع', icon: '🐑', type: 'eid' },

  {
    date: '2027-06-05',
    name: 'رأس السنة الهجرية ١٤٤٩',
    icon: '☪️',
    type: 'islamic',
    note: 'تقريبي',
  },
  { date: '2027-08-15', name: 'المولد النبوي الشريف', icon: '⭐', type: 'islamic', note: 'تقريبي' },
];

/** Build a date→Holiday map for O(1) lookup */
export const HOLIDAYS_BY_DATE: Record<string, Holiday> = Object.fromEntries(
  HOLIDAYS.map((h) => [h.date, h])
);

/** CSS accent colour per holiday type */
export const HOLIDAY_COLOR: Record<HolidayType, string> = {
  national: 'rgba(0, 108, 53, 0.85)', // Saudi green
  eid: 'rgba(16, 185, 129, 0.82)', // emerald
  islamic: 'rgba(99, 102, 241, 0.80)', // indigo
  ramadan: 'rgba(168, 85, 247, 0.80)', // purple
};
