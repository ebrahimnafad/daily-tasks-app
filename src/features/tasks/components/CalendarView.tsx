import { useMemo, useState } from 'react';
import type { Task } from '@/types';

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

          return (
            <div
              key={day}
              className={`cal-cell ${isToday ? 'cal-cell--today' : ''} ${dayTasks.length > 0 ? 'cal-cell--has-tasks' : ''}`}
            >
              <span className="cal-day-num">{day}</span>
              <div className="cal-tasks">
                {dayTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    className="cal-task-dot"
                    style={{ backgroundColor: task.color }}
                    title={task.title}
                  />
                ))}
                {dayTasks.length > 3 && <span className="cal-more">+{dayTasks.length - 3}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected day tasks */}
      <div className="cal-selected-tasks">
        <h3 className="cal-selected-title">مهام الشهر</h3>
        {Object.entries(tasksByDate)
          .filter(([date]) => date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, dateTasks]) => (
            <div key={date} className="cal-date-group">
              <div className="cal-date-label">
                {new Date(date + 'T00:00:00').toLocaleDateString('ar-SA', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </div>
              <div className="cal-date-tasks">
                {dateTasks.map((task) => (
                  <div key={task.id} className="cal-task-item">
                    <span>{task.icon}</span>
                    <span style={{ color: task.color }}>{task.category}</span>
                    <span>{task.title}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        {Object.keys(tasksByDate).filter((d) =>
          d.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)
        ).length === 0 && <p className="cal-empty">لا توجد مهام مجدولة هذا الشهر</p>}
      </div>
    </div>
  );
}
