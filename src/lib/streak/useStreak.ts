import { useMemo, useState, useCallback } from 'react';
import type { SnapshotSummary } from '@/types';
import { lsGet, lsSet } from '@/lib/storage/localStorage';
import { LS_KEYS } from '@/lib/storage/keys';
import { getLogicalDateISO } from '@/features/tasks/data/scheduleConfig';
import type { ShiftConfig } from '@/features/tasks/data/scheduleConfig';

// ── Types ────────────────────────────────────────────────────────────────────

export interface StreakResult {
  current: number;
  longest: number;
  lastActiveDate: string | null;
  isActiveToday: boolean;
  threshold: number;
  atRisk: boolean;
  /** Last 7 days status for dot display */
  last7: Array<{ date: string; status: 'active' | 'inactive' | 'rest' }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return toISO(d);
}

function isRestDay(
  dateStr: string,
  schedule: ShiftConfig[],
  workExceptions: string[],
  vacationDays: string[]
): boolean {
  if (vacationDays.includes(dateStr)) return true;
  if (workExceptions.includes(dateStr)) return true;

  const date = new Date(dateStr + 'T12:00:00');
  const dow = date.getDay();

  // Check if this day is an off-day in ANY shift schedule
  for (const s of schedule) {
    if (s.offDays.includes(dow)) return true;
  }
  return false;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useStreak(
  dayStartHour: number,
  schedule: ShiftConfig[]
): {
  streak: StreakResult;
  setThreshold: (val: number) => void;
} {
  const [threshold, setThresholdState] = useState<number>(() =>
    lsGet<number>(LS_KEYS.STREAK_THRESHOLD, 60)
  );

  const setThreshold = useCallback((val: number) => {
    const clamped = Math.max(50, Math.min(90, val));
    setThresholdState(clamped);
    lsSet(LS_KEYS.STREAK_THRESHOLD, clamped);
  }, []);

  const streak = useMemo<StreakResult>(() => {
    const snapMap = lsGet<Record<string, SnapshotSummary>>(LS_KEYS.SNAP_SUMMARIES, {});
    const today = getLogicalDateISO(dayStartHour);
    const workExceptions = lsGet<string[]>(LS_KEYS.WORK_EXCEPTIONS, []);
    const vacationDays = lsGet<string[]>(LS_KEYS.VACATION_DAYS, []);

    // Check if today is active
    const todaySnap = snapMap[today];
    const isActiveToday = todaySnap ? todaySnap.progress >= threshold : false;

    // ── Count current streak ─────────────────────────────────────────────
    let current = 0;
    let cursor = isActiveToday ? today : prevDay(today);
    let lastActiveDate: string | null = null;

    // Walk backwards
    for (let i = 0; i < 365; i++) {
      const snap = snapMap[cursor];
      const rest = isRestDay(cursor, schedule, workExceptions, vacationDays);

      if (snap && snap.progress >= threshold) {
        current++;
        lastActiveDate = lastActiveDate ?? cursor;
        cursor = prevDay(cursor);
      } else if (rest && !snap) {
        // Rest day without snapshot — doesn't break streak
        cursor = prevDay(cursor);
      } else {
        break;
      }
    }

    // If today is active, include it in lastActiveDate
    if (isActiveToday) lastActiveDate = today;

    // ── Count longest streak (scan all snapshots) ────────────────────────
    const allDates = Object.keys(snapMap).sort(); // ascending
    let longest = 0;
    let tempStreak = 0;

    for (let i = 0; i < allDates.length; i++) {
      const date = allDates[i];
      const snap = snapMap[date];
      if (snap.progress >= threshold) {
        tempStreak++;
        // Check if previous day was consecutive or rest
        if (i > 0) {
          const prev = allDates[i - 1];
          const daysBetween = Math.round(
            (new Date(date + 'T12:00:00').getTime() - new Date(prev + 'T12:00:00').getTime()) /
              86400000
          );
          if (daysBetween > 1) {
            // Check if all intermediate days are rest days
            let allRest = true;
            const check = new Date(prev + 'T12:00:00');
            for (let d = 1; d < daysBetween; d++) {
              check.setDate(check.getDate() + 1);
              const checkStr = toISO(check);
              if (!isRestDay(checkStr, schedule, workExceptions, vacationDays)) {
                allRest = false;
                break;
              }
            }
            if (!allRest) tempStreak = 1;
          }
        }
      } else {
        tempStreak = 0;
      }
      if (tempStreak > longest) longest = tempStreak;
    }

    // Current could exceed longest if longest wasn't computed correctly
    if (current > longest) longest = current;

    // ── At-risk detection ────────────────────────────────────────────────
    let atRisk = false;
    if (current >= 3 && !isActiveToday) {
      const now = new Date();
      const hoursSinceDayStart = now.getHours() - dayStartHour;
      if (hoursSinceDayStart >= 18 || hoursSinceDayStart < 0) {
        atRisk = true;
      }
    }

    // ── Last 7 days ─────────────────────────────────────────────────────
    const last7: StreakResult['last7'] = [];
    const d = new Date(today + 'T12:00:00');
    for (let i = 6; i >= 0; i--) {
      const dd = new Date(d);
      dd.setDate(dd.getDate() - i);
      const dateStr = toISO(dd);
      const snap = snapMap[dateStr];
      const rest = isRestDay(dateStr, schedule, workExceptions, vacationDays);

      if (snap && snap.progress >= threshold) {
        last7.push({ date: dateStr, status: 'active' });
      } else if (rest && !snap) {
        last7.push({ date: dateStr, status: 'rest' });
      } else {
        last7.push({ date: dateStr, status: 'inactive' });
      }
    }

    return {
      current,
      longest,
      lastActiveDate,
      isActiveToday,
      threshold,
      atRisk,
      last7,
    };
  }, [threshold, dayStartHour, schedule]);

  return { streak, setThreshold };
}
