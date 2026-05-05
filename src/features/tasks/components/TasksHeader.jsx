export default function TasksHeader({
  today,
  notifPerm,
  requestNotifPerm,
  sendToSheets,
  resetNewDay,
  shift,
  setShift,
}) {
  return (
    <header style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
      <div
        style={{
          fontSize: 'var(--font-base)',
          color: 'rgba(var(--gold-rgb),.55)',
          marginBottom: 'var(--space-sm)',
        }}
      >
        {today}
      </div>
      <h1
        style={{
          margin: 0,
          fontSize: 'calc(var(--font-xl) * 1.5)',
          fontWeight: 700,
          color: 'var(--text-gold)',
          textShadow: '0 2px 20px rgba(var(--gold-rgb),.3)',
        }}
      >
        مهام اليوم
      </h1>
      <div
        style={{
          marginTop: 'var(--space-xs)',
          fontSize: 'var(--font-base)',
          color: 'rgba(var(--gold-rgb),.45)',
        }}
      >
        بسم الله الرحمن الرحيم
      </div>

      <div
        style={{
          marginTop: 'var(--space-lg)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 'var(--space-md)',
        }}
      >
        {notifPerm !== 'granted' && (
          <button
            className="bbtn"
            onClick={requestNotifPerm}
            style={{
              fontSize: 'var(--font-base)',
              padding: 'var(--space-sm) var(--space-lg)',
              background: 'color-mix(in srgb, #d97e6a 10%, transparent)',
              color: '#d97e6a',
              borderColor: 'color-mix(in srgb, #d97e6a 30%, transparent)',
            }}
          >
            🔔 تفعيل الإشعارات
          </button>
        )}
        <button
          className="bbtn"
          onClick={sendToSheets}
          style={{
            fontSize: 'var(--font-base)',
            padding: 'var(--space-sm) var(--space-lg)',
            background: 'color-mix(in srgb, #6e9fcf 10%, transparent)',
            color: '#6e9fcf',
            borderColor: 'color-mix(in srgb, #6e9fcf 30%, transparent)',
          }}
        >
          📊 إرسال التقرير لـ Sheets
        </button>
        <button
          className="bbtn"
          onClick={resetNewDay}
          style={{
            fontSize: 'var(--font-base)',
            padding: 'var(--space-sm) var(--space-lg)',
            background: 'rgba(var(--gold-rgb),.1)',
          }}
        >
          🔄 بدء يوم جديد
        </button>
        <div
          style={{
            background: 'rgba(var(--gold-rgb),.05)',
            borderRadius: 'var(--radius-pill)',
            padding: 'var(--space-xs)',
            display: 'flex',
            gap: 'var(--space-xs)',
          }}
        >
          <button
            className={`bbtn ${shift === 'morning' ? 'on' : ''}`}
            onClick={() => setShift('morning')}
            style={{ fontSize: 'var(--font-base)', padding: 'var(--space-sm) var(--space-lg)' }}
            aria-pressed={shift === 'morning'}
          >
            ☀️ صباحي
          </button>
          <button
            className={`bbtn ${shift === 'night' ? 'on' : ''}`}
            onClick={() => setShift('night')}
            style={{ fontSize: 'var(--font-base)', padding: 'var(--space-sm) var(--space-lg)' }}
            aria-pressed={shift === 'night'}
          >
            🌙 مسائي
          </button>
        </div>
      </div>
      <div
        style={{
          marginTop: 'var(--space-sm)',
          fontSize: 'var(--font-sm)',
          color: 'rgba(var(--gold-rgb),.55)',
        }}
      >
        {shift === 'morning' ? '🌅 أنت في الأسبوع الصباحي' : '🌆 أنت في الأسبوع المسائي'}
      </div>
    </header>
  );
}
