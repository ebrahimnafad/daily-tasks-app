import { useMemo, useState } from 'react';
import type { Task } from '@/types';
import type { Expense, Transaction } from '@/features/finance/types';
import { KEYS } from '@/features/finance/hooks/useFinanceSync';
import { lsGet, lsSet } from '@/lib/storage/localStorage';
import { useTaskContext } from '@/features/tasks/context/TaskContext';
import { TaskCard } from '@/features/tasks/components/TaskCard/index.js';

interface FinanceEvent {
  id: string;
  title: string;
  icon: string;
  amount: number;
  isPaid: boolean;
  type: 'due' | 'paid';
}

interface CalendarViewProps {
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

export default function CalendarView({ tasks }: CalendarViewProps) {
  const { tm } = useTaskContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const [expenses] = useState<Expense[]>(() => lsGet(KEYS.expenses, []));
  const [transactions] = useState<Transaction[]>(() => lsGet(KEYS.transactions, []));
  const [notes, setNotes] = useState<Record<string, string>>(() => lsGet('mhm_calendar_notes', {}));

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotes((prev) => {
      const newNotes = { ...prev };
      if (!val.trim()) {
        delete newNotes[selectedDate];
      } else {
        newNotes[selectedDate] = val;
      }
      lsSet('mhm_calendar_notes', newNotes);
      return newNotes;
    });
  };

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
    setSelectedDate(now.toISOString().split('T')[0]);
  };

  const selectedDateTasks = tasksByDate[selectedDate] || [];
  const selectedDateFinance = financeEventsByDate[selectedDate] || [];

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

          // Heatmap calculations
          const dayTotalExpense = dayFinance.reduce((sum, e) => sum + (e.amount || 0), 0);
          const intensity = maxExpenseAmount > 0 ? dayTotalExpense / maxExpenseAmount : 0;
          const heatmapOpacity = Math.max(0.08, intensity * 0.75); // scales from 0.08 (baseline) up to 0.75 max
          const hasExpenses = dayFinance.length > 0;

          return (
            <div
              key={day}
              onClick={() => setSelectedDate(dateStr)}
              style={{
                cursor: 'pointer',
                border: isSelected ? '2px solid var(--gold)' : undefined,
                background: hasExpenses ? `rgba(var(--gold-rgb), ${heatmapOpacity})` : undefined,
              }}
              className={`cal-cell ${isToday ? 'cal-cell--today' : ''} ${dayTasks.length > 0 || hasExpenses ? 'cal-cell--has-tasks' : ''}`}
            >
              <span className="cal-day-num">{day}</span>
              {notes[dateStr] && (
                <span style={{ position: 'absolute', top: 4, right: 4, fontSize: '10px' }}>📝</span>
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

        {/* Note Editor */}
        <div style={{ marginTop: '24px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              color: 'var(--text-gold)',
              fontWeight: 600,
            }}
          >
            📝 ملاحظات اليوم
          </label>
          <textarea
            value={notes[selectedDate] || ''}
            onChange={handleNoteChange}
            placeholder="أضف ملاحظة لهذا اليوم..."
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '12px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(var(--gold-rgb), 0.2)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </div>
      </div>
    </div>
  );
}
