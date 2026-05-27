import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { SnapshotSummary } from '@/types';
import type { FinanceData } from '@/features/finance/hooks/useFinanceSync';
import type { ExpenseCategory, Transaction } from '@/features/finance/types';
import type { OkrCheckIn, OkrKeyResult } from '@/features/okr/hooks/useOkrSync';
import { lsGet } from '@/lib/storage/localStorage';
import { LS_KEYS } from '@/lib/storage/keys';

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** Get the Saturday→Friday week range ending on the most recent Friday (or today if Friday). */
function getWeekRange(refDate: Date): { start: string; end: string; dates: string[] } {
  const d = new Date(refDate);
  // Find most recent Friday (day=5)
  while (d.getDay() !== 5) d.setDate(d.getDate() - 1);
  const end = toISO(d);
  d.setDate(d.getDate() - 6); // Saturday
  const start = toISO(d);

  const dates: string[] = [];
  const cursor = new Date(start + 'T12:00:00');
  const endDate = new Date(end + 'T12:00:00');
  while (cursor <= endDate) {
    dates.push(toISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return { start, end, dates };
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface TasksReport {
  fullDays: number;
  totalDays: number;
  avgCompletion: number;
  bestDay: { date: string; dayName: string; pct: number } | null;
  worstDay: { date: string; dayName: string; pct: number } | null;
}

export interface OkrReport {
  cycleProgressNow: number;
  weeklyDelta: number;
  checkInsThisWeek: number;
  topKR: { title: string; delta: number } | null;
}

export interface FinanceReport {
  weekTotal: number;
  prevWeekTotal: number;
  diff: number;
  topCategory: { name: string; amount: number } | null;
  budgetUsage: number; // 0-100 percentage of monthly budget used
  currencySymbol: string;
}

export interface WeeklyReportData {
  ready: boolean;
  weekStart: string;
  weekEnd: string;
  tasks: TasksReport;
  okr: OkrReport;
  finance: FinanceReport;
  score: number; // 0-100 overall
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UseWeeklyReportInput {
  cycleProgress?: number;
  checkIns?: OkrCheckIn[];
  keyResults?: OkrKeyResult[];
}

export function useWeeklyReport(input: UseWeeklyReportInput = {}): WeeklyReportData {
  const queryClient = useQueryClient();

  return useMemo(() => {
    const now = new Date();
    const { start, end, dates } = getWeekRange(now);

    // Also compute previous week for finance comparison
    const prevEnd = new Date(start + 'T12:00:00');
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevWeek = getWeekRange(prevEnd);

    // ── TASKS ──────────────────────────────────────────────────────────────
    const snapMap = lsGet<Record<string, SnapshotSummary>>(LS_KEYS.SNAP_SUMMARIES, {});
    const weekSnaps = dates
      .map((d) => (snapMap[d] ? { date: d, snap: snapMap[d] } : null))
      .filter(Boolean) as { date: string; snap: SnapshotSummary }[];

    const ready = weekSnaps.length >= 3;

    let fullDays = 0;
    let totalPct = 0;
    let bestDay: TasksReport['bestDay'] = null;
    let worstDay: TasksReport['worstDay'] = null;

    weekSnaps.forEach(({ date, snap }) => {
      const pct = snap.progress ?? 0;
      totalPct += pct;
      if (pct >= 100) fullDays++;
      const dow = new Date(date + 'T12:00:00').getDay();
      const dayName = DAYS_AR[dow];
      if (!bestDay || pct > bestDay.pct) bestDay = { date, dayName, pct: Math.round(pct) };
      if (!worstDay || pct < worstDay.pct) worstDay = { date, dayName, pct: Math.round(pct) };
    });

    const avgCompletion = weekSnaps.length > 0 ? Math.round(totalPct / weekSnaps.length) : 0;

    const tasksReport: TasksReport = {
      fullDays,
      totalDays: weekSnaps.length,
      avgCompletion,
      bestDay,
      worstDay,
    };

    // ── OKR ────────────────────────────────────────────────────────────────
    const cycleProgressNow = input.cycleProgress ?? 0;
    const checkIns = input.checkIns ?? [];
    const keyResults = input.keyResults ?? [];

    const checkInsThisWeek = checkIns.filter((ci) => {
      const d = ci.checkInDate || ci.createdAt?.substring(0, 10) || '';
      return d >= start && d <= end;
    }).length;

    // Approximate weekly delta from snapshot okrSummary (first snap of week vs last)
    // SnapshotSummary doesn't have okrSummary but the full DailySnapshot does.
    // Since we only have summaries, approximate delta from checkIns count.
    // For a real delta we'd need full snapshots. Use cycleProgress difference heuristic.
    const weeklyDelta = checkInsThisWeek > 0 ? Math.max(1, Math.round(cycleProgressNow * 0.05)) : 0;

    let topKR: OkrReport['topKR'] = null;
    // Not enough data in cache for per-KR weekly delta without full snapshots.
    // Show the KR with most check-ins this week as a proxy.
    if (keyResults.length > 0 && checkIns.length > 0) {
      const weekCIs = checkIns.filter((ci) => {
        const d = ci.checkInDate || ci.createdAt?.substring(0, 10) || '';
        return d >= start && d <= end;
      });
      const countByKR: Record<string, number> = {};
      weekCIs.forEach((ci) => {
        const krid = ci.keyResultId;
        if (krid) countByKR[krid] = (countByKR[krid] || 0) + 1;
      });
      const topId = Object.entries(countByKR).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topId) {
        const kr = keyResults.find((k) => k.id === topId);
        if (kr) topKR = { title: kr.title, delta: countByKR[topId] };
      }
    }

    const okrReport: OkrReport = {
      cycleProgressNow: Math.round(cycleProgressNow),
      weeklyDelta,
      checkInsThisWeek,
      topKR,
    };

    // ── FINANCE ────────────────────────────────────────────────────────────
    const finData = queryClient.getQueryData<{ data: FinanceData }>(['finance'])?.data;
    const transactions: Transaction[] =
      finData?.transactions ?? lsGet(LS_KEYS.FIN_TRANSACTIONS, []);
    const categories: ExpenseCategory[] = finData?.categories ?? lsGet(LS_KEYS.FIN_CATEGORIES, []);
    const settings = lsGet<{ currencySymbol?: string }>(LS_KEYS.FIN_SETTINGS, {});
    const currencySymbol = settings.currencySymbol || 'ر.س';

    const weekTxns = transactions.filter(
      (t) => t.date >= start && t.date <= end && t.status === 'paid'
    );
    const prevWeekTxns = transactions.filter(
      (t) => t.date >= prevWeek.start && t.date <= prevWeek.end && t.status === 'paid'
    );

    const weekTotal = weekTxns.reduce((s, t) => s + t.amount, 0);
    const prevWeekTotal = prevWeekTxns.reduce((s, t) => s + t.amount, 0);

    // Top category
    const catTotals: Record<string, number> = {};
    weekTxns.forEach((t) => {
      catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
    });
    const topCatId = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
    const topCategory = topCatId
      ? {
          name: categories.find((c) => c.id === topCatId[0])?.name ?? topCatId[0],
          amount: topCatId[1],
        }
      : null;

    // Budget usage: total transactions this month vs total monthlyBudget
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthTxns = transactions.filter(
      (t) => t.date.startsWith(monthStr) && t.status === 'paid'
    );
    const monthSpent = monthTxns.reduce((s, t) => s + t.amount, 0);
    const totalBudget = categories.reduce((s, c) => s + (c.monthlyBudget || 0), 0);
    const budgetUsage = totalBudget > 0 ? Math.round((monthSpent / totalBudget) * 100) : 0;

    const financeReport: FinanceReport = {
      weekTotal: Math.round(weekTotal),
      prevWeekTotal: Math.round(prevWeekTotal),
      diff: Math.round(weekTotal - prevWeekTotal),
      topCategory,
      budgetUsage,
      currencySymbol,
    };

    // ── OVERALL SCORE ──────────────────────────────────────────────────────
    const taskScore = avgCompletion; // 0-100
    const okrScore = Math.min(100, cycleProgressNow); // 0-100
    const budgetScore = budgetUsage <= 100 ? 100 : Math.max(0, 200 - budgetUsage); // 100 if under, degrades if over
    const score = Math.round(taskScore * 0.4 + okrScore * 0.4 + budgetScore * 0.2);

    return {
      ready,
      weekStart: start,
      weekEnd: end,
      tasks: tasksReport,
      okr: okrReport,
      finance: financeReport,
      score,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.cycleProgress, input.checkIns, input.keyResults, queryClient]);
}
