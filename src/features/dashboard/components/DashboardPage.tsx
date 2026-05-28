import { useState } from 'react';
import { LS_KEYS } from '@/lib/storage/keys';
import { lsGet } from '@/lib/storage/localStorage';
import type { Income, Transaction } from '@/features/finance/types';
import type { DailySnapshot } from '@/types';
import ProductivityChart from './ProductivityChart';
import { localMonthISO } from '@/lib/date/localDate';
import '../dashboard.css';

interface DashboardPageProps {
  streak: { current: number; longest: number };
  okrSummary: {
    cycleTitle: string;
    cycleProgress: number;
    objectives: { title: string; progress: number }[];
  } | null;
}

export default function DashboardPage({ streak, okrSummary }: DashboardPageProps) {
  // --- Finance Data ---
  const [finSummary] = useState(() => {
    const incomes = lsGet<Income[]>(LS_KEYS.FIN_INCOME, []);
    const transactions = lsGet<Transaction[]>(LS_KEYS.FIN_TRANSACTIONS, []);

    const currentMonth = localMonthISO();

    const totalIncome = incomes
      .filter((i) => i.isActive && i.frequency === 'monthly')
      .reduce((sum, i) => sum + i.amount, 0);

    const spentThisMonth = transactions
      .filter((t) => t.date.startsWith(currentMonth) && t.status === 'paid')
      .reduce((sum, t) => sum + t.amount, 0);

    const safeIncome = totalIncome || 1; // prevent division by zero
    const spentPercent = Math.min(100, Math.round((spentThisMonth / safeIncome) * 100));

    return { totalIncome, spentThisMonth, spentPercent };
  });

  // --- Task Data ---
  const [taskSummary] = useState(() => {
    const summaries = Object.values(
      lsGet<Record<string, DailySnapshot>>(LS_KEYS.SNAP_SUMMARIES, {})
    );
    if (summaries.length === 0) return { avgProgress: 0, totalDone: 0 };

    // Last 30 days
    const recent = summaries.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

    const avgProgress = Math.round(recent.reduce((sum, s) => sum + s.progress, 0) / recent.length);
    const totalDone = recent.reduce((sum, s) => sum + s.countDone + (s.prayersDone || 0), 0);

    return { avgProgress, totalDone };
  });

  return (
    <div className="dashboard-page fade-in">
      <header className="dashboard-header">
        <h1 className="dashboard-title">📊 الإحصائيات الشاملة</h1>
      </header>

      <div className="dashboard-grid">
        {/* 1. Streaks & Tasks */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">🔥 الاستمرارية</h2>
            <span className="cal-note-meta">أطول سلسلة: {streak.longest} يوم</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <div className="dash-metric">{streak.current}</div>
            <div className="dash-metric-sub">أيام متتالية</div>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: 'auto' }}>
            <div>
              <div className="dash-metric-sub">متوسط الإنجاز (30 يوم)</div>
              <div style={{ fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 'bold' }}>
                {taskSummary.avgProgress}%
              </div>
            </div>
            <div>
              <div className="dash-metric-sub">المهام المنجزة (30 يوم)</div>
              <div style={{ fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 'bold' }}>
                {taskSummary.totalDone}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Finance */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">💰 المالية (الشهر الحالي)</h2>
          </div>
          <div>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}
            >
              <div>
                <div className="dash-metric-sub">المصروفات</div>
                <div
                  className="dash-metric"
                  style={{ color: finSummary.spentPercent > 80 ? '#ef4444' : 'var(--gold)' }}
                >
                  {finSummary.spentThisMonth.toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div className="dash-metric-sub">الدخل الشهري</div>
                <div style={{ fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 'bold' }}>
                  {finSummary.totalIncome.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="dash-fin-progress">
              <div
                className="dash-fin-fill"
                style={{
                  width: `${finSummary.spentPercent}%`,
                  background:
                    finSummary.spentPercent > 80
                      ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                      : undefined,
                }}
              />
            </div>
            <div className="dash-fin-labels">
              <span>0%</span>
              <span>{finSummary.spentPercent}% مستهلَك</span>
            </div>
          </div>
        </div>

        {/* 3. OKR Summary */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">🎯 الأهداف (OKR)</h2>
            {okrSummary && <span className="cal-note-meta">{okrSummary.cycleTitle}</span>}
          </div>

          {!okrSummary ? (
            <div className="dash-empty">لا توجد دورة أهداف نشطة حالياً</div>
          ) : (
            <div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}
              >
                {/* Circular Mini Gauge */}
                <svg viewBox="0 0 36 36" style={{ width: '60px', height: '60px' }}>
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="rgba(var(--gold-rgb), 0.15)"
                    strokeWidth="4"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="var(--gold)"
                    strokeWidth="4"
                    strokeDasharray={`${okrSummary.cycleProgress}, 100`}
                    style={{ transition: 'stroke-dasharray 1s ease-out' }}
                  />
                  <text
                    x="18"
                    y="20.5"
                    fontSize="10"
                    fontWeight="bold"
                    fill="var(--gold)"
                    textAnchor="middle"
                  >
                    {okrSummary.cycleProgress}%
                  </text>
                </svg>

                <div style={{ flex: 1 }}>
                  <div className="dash-metric-sub" style={{ marginBottom: '4px' }}>
                    تقدم الدورة الحالية
                  </div>
                  <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-main)' }}>
                    الأهداف: {okrSummary.objectives.length}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {okrSummary.objectives.slice(0, 3).map((obj, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 'var(--font-sm)',
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--text-main)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '70%',
                      }}
                    >
                      {obj.title}
                    </span>
                    <span style={{ color: 'var(--gold)', fontWeight: 'bold' }}>
                      {obj.progress}%
                    </span>
                  </div>
                ))}
                {okrSummary.objectives.length > 3 && (
                  <div
                    className="dash-metric-sub"
                    style={{ textAlign: 'center', marginTop: '4px' }}
                  >
                    + {okrSummary.objectives.length - 3} أهداف أخرى
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 4. Productivity Chart (Full Width) */}
        <div className="dash-card full-width">
          <div className="dash-card-header">
            <h2 className="dash-card-title">📈 نبض الإنتاجية (آخر 30 يوم)</h2>
          </div>
          <ProductivityChart />
        </div>
      </div>
    </div>
  );
}
