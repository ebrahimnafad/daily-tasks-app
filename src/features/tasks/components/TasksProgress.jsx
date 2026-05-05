export default function TasksProgress({
  progress,
  prayersDone,
  prayerTotal,
  countDone,
  totalOther,
}) {
  return (
    <section
      aria-label="إجمالي التقدم"
      style={{
        background: 'rgba(var(--gold-rgb),.07)',
        border: '1px solid rgba(var(--gold-rgb),.2)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-lg) var(--space-xl)',
        marginBottom: 'var(--space-xl)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-md)',
        }}
      >
        <span style={{ color: 'var(--text-gold)', fontSize: 'var(--font-base)' }}>
          إجمالي الإنجاز
        </span>
        <span
          style={{ color: 'var(--gold)', fontSize: 'var(--font-xl)', fontWeight: 700 }}
          aria-live="polite"
        >
          {progress}٪
        </span>
      </div>
      <div
        className="pbar"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`التقدم: ${progress}%`}
      >
        <div className="pfill" style={{ width: `${progress}%` }} />
      </div>
      <div
        style={{
          marginTop: 'var(--space-sm)',
          fontSize: 'var(--font-sm)',
          color: 'rgba(var(--gold-rgb),.45)',
          textAlign: 'left',
        }}
      >
        {prayersDone}/{prayerTotal} صلوات · {countDone}/{totalOther} مهام
      </div>
    </section>
  );
}
