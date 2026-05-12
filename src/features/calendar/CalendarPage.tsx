import { useMemo, useState, useEffect, useCallback } from 'react';
import type { Task } from '@/types';
import type { SnapshotSummary, DailySnapshot } from '@/types';
import type { Expense, Transaction } from '@/features/finance/types';
import { KEYS } from '@/features/finance/hooks/useFinanceSync';
import { lsGet } from '@/lib/storage/localStorage';
import { useTaskContext } from '@/features/tasks/context/TaskContext';
import { TaskCard } from '@/features/tasks/components/TaskCard/index.js';
import { authFetch } from '@/features/auth/authFetch';
import useNotesSync from './useNotesSync';
import useNoteSearch from './useNoteSearch';
import NotesPanel from './NotesPanel';
import { localDateISO } from '@/lib/date/localDate';

interface FinanceEvent {
  id: string;
  title: string;
  icon: string;
  amount: number;
  isPaid: boolean;
  type: 'due' | 'paid';
}

interface CalendarPageProps {
  tasks: Task[];
}

const DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const SYNC_LABELS: Record<string, string> = {
  syncing: '🔄 جاري الحفظ...',
  synced: '✓ محفوظ',
  offline: '📴 غير متصل',
  error: '⚠️ خطأ في الحفظ',
};

export default function CalendarPage({ tasks }: CalendarPageProps) {
  const { tm } = useTaskContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = localDateISO();
  const [selectedDate, setSelectedDate] = useState<string>(today);

  // ── Snapshot summaries (for battery indicator) ──────────────────────
  const [snapSummaries, setSnapSummaries] = useState<Record<string, SnapshotSummary>>({});
  const [selectedSnapshot, setSelectedSnapshot] = useState<DailySnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);

  useEffect(() => {
    authFetch('/api/db?resource=snapshots', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { summaries?: SnapshotSummary[] }) => {
        if (!Array.isArray(data.summaries)) return;
        const map: Record<string, SnapshotSummary> = {};
        data.summaries.forEach((s) => {
          map[s.date] = s;
        });
        setSnapSummaries(map);
      })
      .catch(() => {
        /* offline — silent */
      });
  }, []);

  const fetchSnapshot = useCallback(
    async (date: string) => {
      if (date >= today) {
        setSelectedSnapshot(null);
        return;
      }
      const summary = snapSummaries[date];
      if (!summary) {
        setSelectedSnapshot(null);
        return;
      }
      setLoadingSnapshot(true);
      try {
        const r = await authFetch(`/api/db?resource=snapshot&date=${date}`, { cache: 'no-store' });
        const data = (await r.json()) as { snapshot: DailySnapshot | null };
        setSelectedSnapshot(data.snapshot ?? null);
      } catch {
        setSelectedSnapshot(null);
      } finally {
        setLoadingSnapshot(false);
      }
    },
    [today, snapSummaries]
  );

  // ── Battery helper ─────────────────────────────────────────────────
  const BatteryBar = ({ progress }: { progress: number }) => {
    const filled = Math.round((progress / 100) * 5);
    const color = progress >= 80 ? '#9bc87a' : progress >= 50 ? '#e6a855' : '#d97e6a';
    return (
      <div className="cal-battery" aria-label={`إنجاز ${progress}%`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={`cal-battery__seg ${i < filled ? 'cal-battery__seg--on' : ''}`}
            style={i < filled ? { background: color } : {}}
          />
        ))}
      </div>
    );
  };

  // ── Notes sync ──────────────────────────────────────────────────────
  const { notes, addNote, updateNote, deleteNote, togglePin, syncStatus } = useNotesSync();

  // ── Search ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const searchResults = useNoteSearch(notes, searchQuery);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const [expenses] = useState<Expense[]>(() => lsGet(KEYS.expenses, []));
  const [transactions] = useState<Transaction[]>(() => lsGet(KEYS.transactions, []));

  const financeEventsByDate = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const map: Record<string, FinanceEvent[]> = {};
    const monthStr = `${y}-${String(m + 1).padStart(2, '0')}`;

    // Only Due Expenses
    expenses.forEach((e) => {
      if (!e.isActive) return;
      let isDueThisMonth = false;
      let dueDay = e.dueDay || 1;

      if (e.frequency === 'monthly' || e.frequency === 'weekly') {
        isDueThisMonth = true;
      } else if (e.frequency === 'annual' && e.seasonMonth) {
        if (e.seasonMonth === m + 1) isDueThisMonth = true;
      } else if (e.frequency === 'semi-annual' && e.seasonMonth) {
        if (e.seasonMonth === m + 1 || ((e.seasonMonth + 6) % 12 || 12) === m + 1) {
          isDueThisMonth = true;
        }
      } else if (e.frequency === 'quarterly' && e.quarterMonth) {
        const currentQuarterMonth = (m % 3) + 1;
        if (currentQuarterMonth === e.quarterMonth) {
          isDueThisMonth = true;
        }
      } else if (e.frequency === 'one-time' && e.endDate) {
        if (e.endDate.startsWith(monthStr)) {
          isDueThisMonth = true;
          dueDay = parseInt(e.endDate.split('-')[2], 10);
        }
      }

      if (isDueThisMonth) {
        const paid = transactions.some(
          (t) => t.expenseId === e.id && t.date.startsWith(monthStr) && t.status === 'paid'
        );
        if (!paid) {
          const dateStr = `${monthStr}-${String(dueDay).padStart(2, '0')}`;
          if (!map[dateStr]) map[dateStr] = [];
          map[dateStr].push({
            id: e.id,
            title: e.title,
            icon: e.icon,
            amount: e.amount,
            isPaid: false,
            type: 'due',
          });
        }
      }
    });

    return map;
  }, [expenses, transactions, currentDate]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const days = new Date(y, m + 1, 0).getDate();

    for (let day = 1; day <= days; day++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Only include tasks explicitly scheduled for this specific date
      const applicableTasks = tasks.filter((t) => {
        return t.recurrence === 'موعد محدد' && t.date === dateStr;
      });

      if (applicableTasks.length > 0) {
        map[dateStr] = applicableTasks;
      }
    }
    return map;
  }, [tasks, currentDate]);

  // Notes grouped by date for indicator dots
  const notesByDate = useMemo(() => {
    const map: Record<string, typeof notes> = {};
    notes.forEach((n) => {
      if (!map[n.date]) map[n.date] = [];
      map[n.date].push(n);
    });
    return map;
  }, [notes]);

  // Calculate max expense amount in the current month to scale the heatmap opacity
  const maxExpenseAmount = useMemo(() => {
    let max = 0;
    Object.values(financeEventsByDate).forEach((events) => {
      const dayTotal = events.reduce((sum, e) => sum + (e.amount || 0), 0);
      if (dayTotal > max) max = dayTotal;
    });
    return max;
  }, [financeEventsByDate]);

  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    const d = localDateISO(now);
    setSelectedDate(d);
    setSelectedSnapshot(null);
  };

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    void fetchSnapshot(dateStr);
  };

  const selectedDateTasks = tasksByDate[selectedDate] || [];
  const selectedDateFinance = financeEventsByDate[selectedDate] || [];
  const selectedDateNotes = notesByDate[selectedDate] ?? [];

  return (
    <div className="cal-view">
      {/* Header */}
      <div className="cal-header">
        <button className="cal-nav" onClick={goToPrevMonth}>
          ◀
        </button>
        <div className="cal-title">
          <span>{MONTHS[month]}</span>
          <span style={{ fontWeight: 400 }}>{year}</span>
        </div>
        <button className="cal-nav" onClick={goToNextMonth}>
          ▶
        </button>
      </div>

      <button className="cal-today-btn" onClick={goToToday}>
        اليوم
      </button>

      {/* Search bar */}
      <div className="cal-search-bar">
        <span className="cal-search-icon">🔍</span>
        <input
          type="text"
          className="cal-search-input"
          placeholder="ابحث في الملاحظات..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          dir="auto"
        />
        {searchQuery && (
          <button className="cal-search-clear" onClick={() => setSearchQuery('')}>
            ✕
          </button>
        )}
      </div>

      {/* Search results (shown instead of calendar when searching) */}
      {searchQuery ? (
        <div className="cal-search-results">
          {searchResults.length === 0 ? (
            <p className="cal-empty">لا توجد نتائج للبحث</p>
          ) : (
            searchResults.map((note) => (
              <div
                key={note.id}
                className="cal-search-result-item"
                onClick={() => {
                  setSelectedDate(note.date);
                  setSearchQuery('');
                  // Navigate to the month of this note
                  const d = new Date(note.date + 'T00:00:00');
                  setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
                }}
              >
                <span className="cal-search-result-date">
                  {new Date(note.date + 'T00:00:00').toLocaleDateString('ar-SA', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {note.pinned && ' 📌'}
                </span>
                <span className="cal-search-result-snippet">
                  {note.text.slice(0, 120)}
                  {note.text.length > 120 ? '...' : ''}
                </span>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          {/* Days header */}
          <div className="cal-days-header">
            {DAYS.map((day) => (
              <div key={day} className="cal-day-name">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="cal-grid">
            {/* Empty cells for first day offset */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="cal-cell cal-cell--empty" />
            ))}

            {/* Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              const dayTasks = tasksByDate[dateStr] || [];
              const dayFinance = financeEventsByDate[dateStr] || [];
              const hasNotes = (notesByDate[dateStr]?.length ?? 0) > 0;

              // Heatmap calculations
              const dayTotalExpense = dayFinance.reduce((sum, e) => sum + (e.amount || 0), 0);
              const intensity = maxExpenseAmount > 0 ? dayTotalExpense / maxExpenseAmount : 0;
              const heatmapOpacity = Math.max(0.08, intensity * 0.75); // scales from 0.08 (baseline) up to 0.75 max
              const hasExpenses = dayFinance.length > 0;

              return (
                <div
                  key={day}
                  onClick={() => handleSelectDate(dateStr)}
                  style={{
                    cursor: 'pointer',
                    border: isSelected ? '2px solid var(--gold)' : undefined,
                    background: hasExpenses
                      ? `rgba(var(--gold-rgb), ${heatmapOpacity})`
                      : undefined,
                  }}
                  className={`cal-cell ${isToday ? 'cal-cell--today' : ''} ${dayTasks.length > 0 || hasExpenses ? 'cal-cell--has-tasks' : ''} ${snapSummaries[dateStr] ? 'cal-cell--has-snapshot' : ''}`}
                >
                  <span className="cal-day-num">{day}</span>
                  {hasNotes && (
                    <span style={{ position: 'absolute', top: 4, right: 4, fontSize: '10px' }}>
                      📝
                    </span>
                  )}
                  {/* Battery indicator for past days with snapshots */}
                  {snapSummaries[dateStr] && dateStr < today && (
                    <BatteryBar progress={snapSummaries[dateStr].progress} />
                  )}
                  <div className="cal-tasks">
                    {dayFinance.slice(0, 2).map((fe) => (
                      <div
                        key={fe.id}
                        className="cal-task-dot"
                        style={{ backgroundColor: 'var(--danger)' }}
                        title={fe.title}
                      >
                        💰
                      </div>
                    ))}
                    {dayTasks.slice(0, Math.max(0, 3 - dayFinance.length)).map((task) => (
                      <div
                        key={task.id}
                        className="cal-task-dot"
                        style={{ backgroundColor: task.color }}
                        title={task.title}
                      />
                    ))}
                    {dayTasks.length + dayFinance.length > 3 && (
                      <span className="cal-more">+{dayTasks.length + dayFinance.length - 3}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected day tasks */}
          <div className="cal-selected-tasks">
            <h3 className="cal-selected-title">
              المهام والاستحقاقات لـ{' '}
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ar-SA', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </h3>

            {selectedDateTasks.length === 0 && selectedDateFinance.length === 0 ? (
              <p className="cal-empty">لا توجد مهام أو استحقاقات في هذا اليوم</p>
            ) : (
              <div className="cal-date-tasks" style={{ marginTop: '16px' }}>
                {selectedDateFinance.map((fe) => (
                  <div
                    key={fe.id}
                    className="cal-task-item"
                    style={{
                      borderRight: `3px solid var(--danger)`,
                      paddingRight: '8px',
                    }}
                  >
                    <span>{fe.icon}</span>
                    <span
                      style={{
                        color: 'var(--danger)',
                        flex: 1,
                      }}
                    >
                      {fe.title} ({(fe.amount || 0).toLocaleString('ar-SA')} ر.س)
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>⏳ مستحق</span>
                  </div>
                ))}
                {selectedDateTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isChecked={!!tm.checked[task.id]}
                    taskSubChecked={tm.taskSubCheckedMap[task.id]}
                  />
                ))}
              </div>
            )}

            {/* Upgraded Notes Panel */}
            <NotesPanel
              date={selectedDate}
              notes={selectedDateNotes}
              onAdd={addNote}
              onUpdate={updateNote}
              onDelete={deleteNote}
              onTogglePin={togglePin}
            />

            {/* ── History Panel (past days with snapshot) ── */}
            {selectedDate < today && (
              <div className="cal-history">
                <div className="cal-history__header">
                  <span className="cal-history__icon">📅</span>
                  <span className="cal-history__title">سجل الإنجاز</span>
                  {snapSummaries[selectedDate] && (
                    <span className="cal-history__badge">
                      {snapSummaries[selectedDate].progress}%
                    </span>
                  )}
                </div>

                {loadingSnapshot && <div className="cal-history__loading">جاري التحميل...</div>}

                {!loadingSnapshot && !selectedSnapshot && !snapSummaries[selectedDate] && (
                  <div className="cal-history__empty">
                    لا يوجد سجل محفوظ لهذا اليوم — يتم الحفظ تلقائياً عند استخدام &quot;يوم
                    جديد&quot;
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

                    {/* Task list */}
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
            )}

            {/* Sync status */}
            <div
              className={`sync-badge ${syncStatus}`}
              style={{ position: 'static', marginTop: '12px', width: 'fit-content' }}
              aria-live="polite"
            >
              {SYNC_LABELS[syncStatus]}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
