// ── useHolidayData.ts — AlAdhan API + static fallback ────────────────────
// Fetches Islamic holidays from api.aladhan.com (free, no key).
// 7-day localStorage cache. Falls back to static HOLIDAY_GROUPS if offline.

import { useState, useEffect, useMemo } from 'react';
import { lsGet, lsSet } from '@/lib/storage/localStorage';
import { HOLIDAY_GROUPS, buildHolidayMap, addDays } from './holidays';
import type { Holiday } from './holidays';

const ALADHAN_BASE = 'https://api.aladhan.com/v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface AlAdhanEntry {
  hijri: { holidays: string[]; year: string };
  gregorian: { date: string }; // DD-MM-YYYY
}

interface AlAdhanCache {
  data: AlAdhanEntry[];
  fetchedAt: number;
}

/**
 * Approximate Gregorian year + month → Hijri year.
 * L-10: Pass currentMonth (0-indexed) so the estimate is bumped by 1
 * in the second half of the Gregorian year, where the Hijri new year
 * has often already begun. Prevents fetching the wrong Hijri year near
 * the year boundary (e.g. December → next Hijri year starts in ~June).
 */
function toHijriYear(y: number, month: number): number {
  const base = Math.floor((y - 622) * (33 / 32)) + 1;
  // If we're in the second half of the Gregorian year the Hijri year
  // has likely already advanced; add 1 to ensure we fetch the right year.
  return month >= 6 ? base + 1 : base;
}

/** AlAdhan date DD-MM-YYYY → YYYY-MM-DD */
function parseDate(s: string): string {
  const [d, m, y] = s.split('-');
  return `${y}-${m}-${d}`;
}

async function fetchHijriYear(hijriYear: number): Promise<AlAdhanEntry[]> {
  const key = `mhm_aladhan_${hijriYear}`;
  const cached = lsGet<AlAdhanCache | null>(key, null);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.data;

  const url = `${ALADHAN_BASE}/islamicHolidaysByHijriYear/${hijriYear}?calendarMethod=HJCoSA`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`AlAdhan ${res.status}`);
  const json = (await res.json()) as { data: AlAdhanEntry[] };
  lsSet(key, { data: json.data, fetchedAt: Date.now() } as AlAdhanCache);
  return json.data;
}

/** Extract Eid-ul-Fitr first-day Gregorian dates (YYYY-MM-DD) from AlAdhan entries */
function extractEidFitr(entries: AlAdhanEntry[]): string[] {
  const seen = new Set<string>();
  return entries
    .filter((e) => e.hijri.holidays.some((h) => h.toLowerCase().includes('eid-ul-fitr')))
    .map((e) => parseDate(e.gregorian.date))
    .filter((d) => !seen.has(d) && seen.add(d))
    .sort();
}

export interface HolidayDataResult {
  holidayMap: Record<string, Holiday>;
  eidFitrDates: string[]; // for Eid-bonus pulse computation
  loading: boolean;
}

export function useHolidayData(holidayOffsets: Record<string, number>): HolidayDataResult {
  const [eidFromApi, setEidFromApi] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    // L-10: pass month so boundary drift is corrected
    const h1 = toHijriYear(currentYear, currentMonth);
    Promise.all([fetchHijriYear(h1), fetchHijriYear(h1 + 1)])
      .then(([a, b]) => setEidFromApi(extractEidFitr([...a, ...b])))
      .catch((err) => console.warn('[useHolidayData] AlAdhan offline, using static fallback', err))
      .finally(() => setLoading(false));
  }, []);

  // Holiday map always comes from the static source (includes user offsets + national holidays)
  const holidayMap = useMemo(
    () => buildHolidayMap(HOLIDAY_GROUPS, holidayOffsets),
    [holidayOffsets]
  );

  // Eid dates: prefer live API, fall back to static groups
  const eidFitrDates = useMemo(() => {
    if (eidFromApi.length > 0) return eidFromApi;
    return HOLIDAY_GROUPS.filter((g) => g.type === 'eid' && g.name.includes('الفطر'))
      .map((g) => {
        const offset = holidayOffsets[g.id] ?? 0;
        return offset !== 0 ? addDays(g.baseDates[0], offset) : g.baseDates[0];
      })
      .sort();
  }, [eidFromApi, holidayOffsets]);

  return { holidayMap, eidFitrDates, loading };
}
