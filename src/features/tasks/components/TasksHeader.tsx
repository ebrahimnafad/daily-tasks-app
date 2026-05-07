import type { ShiftType } from '@/features/tasks/data/scheduleConfig';

interface TasksHeaderProps {
  today: string;
  notifPerm: NotificationPermission;
  requestNotifPerm: () => void;
  sendToSheets: () => void;
  resetNewDay: () => void;
  shift: ShiftType;
  setShift: (shift: ShiftType) => void;
}

export default function TasksHeader({
  today,
  notifPerm,
  requestNotifPerm,
  sendToSheets,
  resetNewDay,
  shift,
  setShift,
}: TasksHeaderProps) {
  return (
    <header className="th-header">
      <div className="th-date">{today}</div>
      <h1 className="th-title">مهام اليوم</h1>
      <div className="th-subtitle">بسم الله الرحمن الرحيم</div>

      <div className="th-actions">
        {notifPerm !== 'granted' && (
          <button className="toggle-btn th-btn-notif" onClick={requestNotifPerm}>
            🔔 تفعيل الإشعارات
          </button>
        )}
        <button className="toggle-btn th-btn-sheets" onClick={sendToSheets}>
          📊 إرسال التقرير لـ Sheets
        </button>
        <button className="toggle-btn th-btn-reset" onClick={resetNewDay}>
          🔄 بدء يوم جديد
        </button>
        <div className="th-shift-group">
          <button
            className={`toggle-btn th-btn-shift ${shift === 'morning' ? 'on' : ''}`}
            onClick={() => setShift('morning')}
            aria-pressed={shift === 'morning' ? 'true' : 'false'}
          >
            ☀️ صباحي
          </button>
          <button
            className={`toggle-btn th-btn-shift ${shift === 'evening' ? 'on' : ''}`}
            onClick={() => setShift('evening')}
            aria-pressed={shift === 'evening' ? 'true' : 'false'}
          >
            🌙 مسائي
          </button>
        </div>
      </div>
      <div className="th-shift-hint">
        {shift === 'morning' ? '🌅 أنت في الأسبوع الصباحي' : '🌆 أنت في الأسبوع المسائي'}
      </div>
    </header>
  );
}
