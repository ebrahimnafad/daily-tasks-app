interface TasksHeaderProps {
  today: string;
  notifPerm: NotificationPermission;
  requestNotifPerm: () => void;
  sendToSheets: () => void;
  resetNewDay: () => void;
  shift: string;
  setShift: (shift: string) => void;
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
          <button className="bbtn th-btn-notif" onClick={requestNotifPerm}>
            🔔 تفعيل الإشعارات
          </button>
        )}
        <button className="bbtn th-btn-sheets" onClick={sendToSheets}>
          📊 إرسال التقرير لـ Sheets
        </button>
        <button className="bbtn th-btn-reset" onClick={resetNewDay}>
          🔄 بدء يوم جديد
        </button>
        <div className="th-shift-group">
          <button
            className={`bbtn th-btn-shift ${shift === 'morning' ? 'on' : ''}`}
            onClick={() => setShift('morning')}
            aria-pressed={shift === 'morning' ? 'true' : 'false'}
          >
            ☀️ صباحي
          </button>
          <button
            className={`bbtn th-btn-shift ${shift === 'night' ? 'on' : ''}`}
            onClick={() => setShift('night')}
            aria-pressed={shift === 'night' ? 'true' : 'false'}
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
