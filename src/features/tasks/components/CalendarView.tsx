import { useMemo, useState } from 'react';
import type { Task } from '@/types';
import type { Expense, Transaction } from '@/features/finance/types';
import { KEYS } from '@/features/finance/hooks/useFinanceSync';
import { lsGet } from '@/lib/storage/localStorage';

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
  const [currentDate, setCurrentDate] = useState(new Date());

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

    // 1. Paid Transactions
    transactions.forEach((t) => {
      if (t.date.startsWith(monthStr) && t.status === 'paid') {
        if (!map[t.date]) map[t.date] = [];
        const exp = expenses.find((e) => e.id === t.expenseId);
        map[t.date].push({
          id: t.id,
          title: exp?.title || t.notes || 'دفعة',
          icon: exp?.icon || '💸',
          amount: t.amount,
          isPaid: true,
          type: 'paid',
        });
      }
    });

    // 2. Due Expenses
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
          // Prevent duplicates if already paid (but shouldn't happen based on above check)
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
    tasks.forEach((task) => {
      if (task.date) {
        if (!map[task.date]) map[task.date] = [];
        map[task.date].push(task);
      }
    });
    return map;
  }, [tasks]);

  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const today = new Date().toISOString().split('T')[0];

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
          const dayTasks = tasksByDate[dateStr] || [];
          const dayFinance = financeEventsByDate[dateStr] || [];

          return (
            <div
              key={day}
              className={`cal-cell ${isToday ? 'cal-cell--today' : ''} ${dayTasks.length > 0 || dayFinance.length > 0 ? 'cal-cell--has-tasks' : ''}`}
            >
              <span className="cal-day-num">{day}</span>
              <div className="cal-tasks">
                {dayFinance.slice(0, 2).map((fe) => (
                  <div
                    key={fe.id}
                    className="cal-task-dot"
                    style={{ backgroundColor: fe.isPaid ? 'var(--text-muted)' : 'var(--danger)' }}
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
        <h3 className="cal-selected-title">المهام والاستحقاقات</h3>
        {Array.from(new Set([...Object.keys(tasksByDate), ...Object.keys(financeEventsByDate)]))
          .filter((date) => date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
          .sort((a, b) => a.localeCompare(b))
          .map((date) => {
            const dateTasks = tasksByDate[date] || [];
            const dateFinance = financeEventsByDate[date] || [];
            if (dateTasks.length === 0 && dateFinance.length === 0) return null;

            return (
              <div key={date} className="cal-date-group">
                <div className="cal-date-label">
                  {new Date(date + 'T00:00:00').toLocaleDateString('ar-SA', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </div>
                <div className="cal-date-tasks">
                  {dateFinance.map((fe) => (
                    <div
                      key={fe.id}
                      className="cal-task-item"
                      style={{
                        opacity: fe.isPaid ? 0.6 : 1,
                        borderRight: `3px solid ${fe.isPaid ? 'var(--text-muted)' : 'var(--danger)'}`,
                        paddingRight: '8px',
                      }}
                    >
                      <span>{fe.icon}</span>
                      <span
                        style={{
                          color: fe.isPaid ? 'var(--text-muted)' : 'var(--danger)',
                          flex: 1,
                        }}
                      >
                        {fe.title} ({(fe.amount || 0).toLocaleString('ar-SA')} ر.س)
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {fe.isPaid ? '✅ مدفوع' : '⏳ مستحق'}
                      </span>
                    </div>
                  ))}
                  {dateTasks.map((task) => (
                    <div key={task.id} className="cal-task-item">
                      <span>{task.icon}</span>
                      <span style={{ color: task.color }}>{task.category}</span>
                      <span>{task.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        {Object.keys(tasksByDate).filter((d) =>
          d.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)
        ).length === 0 &&
          Object.keys(financeEventsByDate).filter((d) =>
            d.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)
          ).length === 0 && <p className="cal-empty">لا توجد مهام أو استحقاقات مجدولة هذا الشهر</p>}
      </div>
    </div>
  );
}
