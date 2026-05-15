// L-12: Extracted from CalendarPage — snapshot history panel
import type { DailySnapshot, SnapshotSummary } from '@/types';

interface HistoryPanelProps {
  selectedDate: string;
  today: string;
  snapSummaries: Record<string, SnapshotSummary>;
  selectedSnapshot: DailySnapshot | null;
  loadingSnapshot: boolean;
  onRefresh: () => void;
}

export default function HistoryPanel({
  selectedDate,
  today,
  snapSummaries,
  selectedSnapshot,
  loadingSnapshot,
  onRefresh,
}: HistoryPanelProps) {
  if (selectedDate >= today) return null;

  return (
    <div className="cal-history">
      <div className="cal-history__header">
        <span className="cal-history__icon">📅</span>
        <span className="cal-history__title">سجل الإنجاز</span>
        {snapSummaries[selectedDate] && (
          <span className="cal-history__badge">{snapSummaries[selectedDate].progress}%</span>
        )}
        {/* M-7: Manual refresh button */}
        <button
          onClick={onRefresh}
          title="تحديث سجل الإنجاز"
          style={{
            marginRight: 'auto',
            marginLeft: '6px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
          aria-label="تحديث سجل الإنجاز"
        >
          ↻
        </button>
      </div>

      {loadingSnapshot && <div className="cal-history__loading">جاري التحميل...</div>}

      {!loadingSnapshot && !selectedSnapshot && !snapSummaries[selectedDate] && (
        <div className="cal-history__empty">
          لا يوجد سجل محفوظ لهذا اليوم — يتم الحفظ تلقائياً عند استخدام &quot;يوم جديد&quot;
        </div>
      )}

      {!loadingSnapshot && selectedSnapshot && (
        <>
          {/* Progress summary bar */}
          <div className="cal-history__summary">
            <div className="cal-history__prog-row">
              <span>
                إنجاز {selectedSnapshot.countDone} / {selectedSnapshot.totalOther} مهمة
              </span>
              <span className="cal-history__prog-pct">{selectedSnapshot.progress}%</span>
            </div>
            <div className="cal-history__prog-track">
              <div
                className="cal-history__prog-fill"
                style={{
                  width: `${selectedSnapshot.progress}%`,
                  background:
                    selectedSnapshot.progress >= 80
                      ? '#9bc87a'
                      : selectedSnapshot.progress >= 50
                        ? '#e6a855'
                        : '#d97e6a',
                }}
              />
            </div>
          </div>

          {/* Task state list */}
          <div className="cal-history__tasks">
            {selectedSnapshot.tasks.map((t) => {
              const isDone =
                t.subtasks.length > 0
                  ? t.subtasks.every((s) => selectedSnapshot.checked[s.id as number])
                  : !!selectedSnapshot.checked[t.id];
              const isSkipped = !!selectedSnapshot.skipped[t.id];
              return (
                <div
                  key={t.id}
                  className={`cal-history__task ${isDone ? 'cal-history__task--done' : ''} ${isSkipped ? 'cal-history__task--skipped' : ''}`}
                >
                  <span className="cal-history__task-state">
                    {isDone ? '✅' : isSkipped ? '⏩' : '○'}
                  </span>
                  <span className="cal-history__task-icon">{t.icon}</span>
                  <span className="cal-history__task-title">{t.title}</span>
                  <span className="cal-history__task-cat" style={{ color: t.color }}>
                    {t.category}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
