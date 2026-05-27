import { useState } from 'react';
import type { WeeklyReportData } from './useWeeklyReport';
import OkrProgress from '@/features/okr/components/OkrProgress';
import './weekly-report.css';

import type { StreakResult } from '@/lib/streak/useStreak';

interface WeeklyReportModalProps {
  data: WeeklyReportData;
  streak?: StreakResult;
  onClose: () => void;
}

type Tab = 'tasks' | 'okr' | 'finance';

const TAB_LABELS: Record<Tab, string> = {
  tasks: '📋 المهام',
  okr: '🎯 الأهداف',
  finance: '💰 المالية',
};

function getScoreInfo(score: number) {
  if (score >= 80) return { color: 'var(--gold)', label: 'أسبوع ممتاز 🌟' };
  if (score >= 60) return { color: '#5b9bd5', label: 'أسبوع جيد 👍' };
  return { color: '#e8a838', label: 'يمكن تحسينه 💪' };
}

export default function WeeklyReportModal({ data, streak, onClose }: WeeklyReportModalProps) {
  const [tab, setTab] = useState<Tab>('tasks');
  const [copied, setCopied] = useState(false);

  const scoreInfo = getScoreInfo(data.score);

  if (!data.ready) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box fin-modal wr-modal" onClick={(e) => e.stopPropagation()}>
          <div className="fin-modal__header">
            <h3>📊 التقرير الأسبوعي</h3>
            <button className="fin-modal__close" onClick={onClose}>
              ✕
            </button>
          </div>
          <div className="wr-empty">
            <p style={{ fontSize: '32px', marginBottom: '8px' }}>📊</p>
            <p>لا تتوفر بيانات كافية لإنشاء التقرير</p>
            <p style={{ fontSize: 'var(--font-sm)', marginTop: '8px' }}>
              يُحتاج 3 أيام على الأقل من السبت إلى الجمعة
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleCopy = async () => {
    const { tasks, okr, finance } = data;
    const text = [
      `📊 تقرير أسبوعي | ${data.weekStart} → ${data.weekEnd}`,
      '━━━━━━━━━━━━━━━━',
      streak ? `🔥 السلسلة الحالية: ${streak.current} يوم` : '',
      `✅ المهام: ${tasks.avgCompletion}٪ إنجاز (${tasks.fullDays}/${tasks.totalDays} أيام كاملة)`,
      `🎯 الأهداف: تقدم +${okr.weeklyDelta}٪ هذا الأسبوع (${okr.checkInsThisWeek} تسجيل)`,
      `💰 المالية: ${finance.weekTotal.toLocaleString('ar-SA')} ${finance.currencySymbol} (${finance.diff <= 0 ? '↓ أقل' : '↑ أكثر'} من الأسبوع الماضي)`,
      `⭐ الأداء العام: ${data.score}/100`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box fin-modal wr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fin-modal__header">
          <h3>📊 التقرير الأسبوعي</h3>
          <button className="fin-modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Score ring */}
        <div className="wr-score">
          <div style={{ '--ring-color': scoreInfo.color } as React.CSSProperties}>
            <OkrProgress progress={data.score} size={90} strokeWidth={7} />
          </div>
          <span className="wr-score__label">{scoreInfo.label}</span>
          <span
            style={{
              fontSize: 'var(--font-sm)',
              color: 'rgba(var(--gold-rgb), 0.4)',
              marginTop: '4px',
            }}
          >
            {data.weekStart} → {data.weekEnd}
          </span>
        </div>

        {/* Tabs */}
        <div className="wr-tabs">
          {(['tasks', 'okr', 'finance'] as Tab[]).map((t) => (
            <button
              key={t}
              className={`wr-tab ${tab === t ? 'wr-tab--active' : ''}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'tasks' && (
          <div className="wr-section">
            <div className="wr-stat-row">
              <span className="wr-stat-label">أيام الإنجاز الكامل</span>
              <span className="wr-stat-value">
                {data.tasks.fullDays} / {data.tasks.totalDays}
              </span>
            </div>
            {streak && (
              <div className="wr-stat-row">
                <span className="wr-stat-label">السلسلة الحالية</span>
                <span className="wr-stat-value">🔥 {streak.current} يوم</span>
              </div>
            )}
            <div className="wr-stat-row">
              <span className="wr-stat-label">متوسط الإنجاز</span>
              <span className="wr-stat-value">{data.tasks.avgCompletion}٪</span>
            </div>
            {data.tasks.bestDay && (
              <div className="wr-stat-row">
                <span className="wr-stat-label">أفضل يوم</span>
                <span className="wr-stat-value wr-stat-value--positive">
                  {data.tasks.bestDay.dayName} {data.tasks.bestDay.pct}٪
                </span>
              </div>
            )}
            {data.tasks.worstDay && (
              <div className="wr-stat-row">
                <span className="wr-stat-label">أضعف يوم</span>
                <span className="wr-stat-value wr-stat-value--negative">
                  {data.tasks.worstDay.dayName} {data.tasks.worstDay.pct}٪
                </span>
              </div>
            )}
          </div>
        )}

        {tab === 'okr' && (
          <div className="wr-section">
            <div className="wr-stat-row">
              <span className="wr-stat-label">تقدم الدورة</span>
              <span className="wr-stat-value">{data.okr.cycleProgressNow}٪</span>
            </div>
            <div className="wr-stat-row">
              <span className="wr-stat-label">تقدم هذا الأسبوع</span>
              <span
                className={`wr-stat-value ${data.okr.weeklyDelta > 0 ? 'wr-stat-value--positive' : ''}`}
              >
                +{data.okr.weeklyDelta}٪
              </span>
            </div>
            <div className="wr-stat-row">
              <span className="wr-stat-label">تسجيلات التقدم</span>
              <span className="wr-stat-value">{data.okr.checkInsThisWeek}</span>
            </div>
            {data.okr.topKR && (
              <div className="wr-stat-row">
                <span className="wr-stat-label">أكثر KR تقدماً</span>
                <span className="wr-stat-value">{data.okr.topKR.title}</span>
              </div>
            )}
          </div>
        )}

        {tab === 'finance' && (
          <div className="wr-section">
            <div className="wr-stat-row">
              <span className="wr-stat-label">مصروفات الأسبوع</span>
              <span className="wr-stat-value">
                {data.finance.weekTotal.toLocaleString('ar-SA')} {data.finance.currencySymbol}
              </span>
            </div>
            <div className="wr-stat-row">
              <span className="wr-stat-label">مقارنة بالأسبوع الماضي</span>
              <span
                className={`wr-stat-value ${data.finance.diff <= 0 ? 'wr-stat-value--positive' : 'wr-stat-value--negative'}`}
              >
                {data.finance.diff <= 0 ? '↓' : '↑'}{' '}
                {Math.abs(data.finance.diff).toLocaleString('ar-SA')} {data.finance.currencySymbol}
              </span>
            </div>
            {data.finance.topCategory && (
              <div className="wr-stat-row">
                <span className="wr-stat-label">أعلى تصنيف</span>
                <span className="wr-stat-value">
                  {data.finance.topCategory.name} —{' '}
                  {data.finance.topCategory.amount.toLocaleString('ar-SA')}{' '}
                  {data.finance.currencySymbol}
                </span>
              </div>
            )}
            <div className="wr-stat-row">
              <span className="wr-stat-label">استهلاك الميزانية الشهرية</span>
              <span
                className={`wr-stat-value ${data.finance.budgetUsage > 100 ? 'wr-stat-value--negative' : ''}`}
              >
                {data.finance.budgetUsage}٪
              </span>
            </div>
          </div>
        )}

        {/* Share button */}
        <button className="wr-share-btn" onClick={handleCopy}>
          {copied ? '✅ تم النسخ!' : '📋 نسخ التقرير'}
        </button>
      </div>
    </div>
  );
}
