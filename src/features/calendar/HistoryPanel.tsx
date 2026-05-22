// L-12: Extracted from CalendarPage — snapshot history panel
import type { DailySnapshot, SnapshotSummary } from '@/types';

interface HistoryPanelProps {
  selectedDate: string;
  today: string;
  snapSummaries: Record<string, SnapshotSummary>;
  selectedSnapshot: DailySnapshot | null;
  loadingSnapshot: boolean;
}

export default function HistoryPanel({
  selectedDate,
  today,
  snapSummaries,
  selectedSnapshot,
  loadingSnapshot,
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
            {selectedSnapshot.prayerTotal !== undefined && selectedSnapshot.prayerTotal > 0 && (
              <>
                <div className="cal-history__prog-row" style={{ marginTop: '12px' }}>
                  <span>
                    🕌 {selectedSnapshot.prayersDone} / {selectedSnapshot.prayerTotal}
                    {selectedSnapshot.prayerOptionalDone ? (
                      <span style={{ color: 'var(--gold)', marginLeft: '6px', fontSize: '0.9em' }}>
                        +{selectedSnapshot.prayerOptionalDone}
                      </span>
                    ) : null}
                  </span>
                  <span className="cal-history__prog-pct" style={{ color: 'var(--gold)' }}>
                    {Math.round(
                      ((selectedSnapshot.prayersDone || 0) / selectedSnapshot.prayerTotal) * 100
                    )}
                    %
                  </span>
                </div>
                <div className="cal-history__prog-track">
                  <div
                    className="cal-history__prog-fill"
                    style={{
                      width: `${((selectedSnapshot.prayersDone || 0) / selectedSnapshot.prayerTotal) * 100}%`,
                      background: 'var(--gold)',
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Task state list */}
          <div className="cal-history__tasks">
            {selectedSnapshot.tasks.map((t) => {
              const isDone = (() => {
                if (t.subtasks && t.subtasks.length > 0) {
                  const required = t.subtasks.filter((s) => !s.isOptional);
                  if (required.length === 0) {
                    return t.subtasks.every((s) => selectedSnapshot.checked[s.id as number]);
                  }
                  return required.every((s) => selectedSnapshot.checked[s.id as number]);
                }
                return !!selectedSnapshot.checked[t.id];
              })();
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
