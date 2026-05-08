export type FeatureErrorProps = {
  featureName?: string;
};

export function TasksErrorFallback({ featureName = 'المهام' }: FeatureErrorProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-xl)',
        textAlign: 'center',
        minHeight: '300px',
        color: 'var(--text-gold)',
      }}
    >
      <div style={{ fontSize: '36px', marginBottom: 'var(--space-md)' }} aria-hidden="true">
        ⚠️
      </div>
      <h3
        style={{
          fontSize: 'var(--font-lg)',
          fontWeight: 700,
          marginBottom: 'var(--space-sm)',
          fontFamily: "'Amiri',serif",
        }}
      >
        عذراً — قسم {featureName} غير متاح
      </h3>
      <p
        style={{
          color: 'rgba(var(--gold-rgb),0.7)',
          fontSize: 'var(--font-base)',
          marginBottom: 'var(--space-lg)',
          fontFamily: "'Amiri',serif",
        }}
      >
        حدث خطأ في تحميل هذا القسم. حاول تحديث الصفحة.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: 'var(--space-sm) var(--space-lg)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(var(--gold-rgb),0.3)',
          background: 'rgba(var(--gold-rgb),0.1)',
          color: 'var(--gold)',
          fontFamily: "'Amiri',serif",
          fontSize: 'var(--font-base)',
          cursor: 'pointer',
        }}
      >
        تحديث الصفحة
      </button>
    </div>
  );
}

export function FinanceErrorFallback() {
  return <TasksErrorFallback featureName="المالية" />;
}

export function CalendarErrorFallback() {
  return <TasksErrorFallback featureName="التقويم" />;
}
