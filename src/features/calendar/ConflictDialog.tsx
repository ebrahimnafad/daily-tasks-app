// L-12: Extracted from CalendarPage — C-3 multi-device conflict resolution dialog
interface ConflictDialogProps {
  visible: boolean;
  onKeepLocal: () => void;
  onUseServer: () => void;
}

export default function ConflictDialog({ visible, onKeepLocal, onUseServer }: ConflictDialogProps) {
  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cal-conflict-title"
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        width: 'min(420px, 94vw)',
        padding: '16px 20px',
        borderRadius: '12px',
        background: 'var(--bg-card, #1e1a14)',
        border: '1px solid rgba(230,168,85,0.4)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div
        id="cal-conflict-title"
        style={{ color: 'var(--gold, #e6a855)', fontWeight: 700, fontSize: 'var(--font-md)' }}
      >
        ⚠️ تعارض في الملاحظات
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', lineHeight: 1.6 }}>
        يحتوي الجهاز على ملاحظات أحدث من نسخة السيرفر. اختر أيّهما تريد الاحتفاظ به:
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={onKeepLocal}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(155,200,122,0.5)',
            background: 'rgba(155,200,122,0.15)',
            color: 'var(--text-primary)',
            fontFamily: "'Amiri', serif",
            fontSize: 'var(--font-sm)',
            cursor: 'pointer',
          }}
        >
          احتفظ بالتغييرات المحلية
        </button>
        <button
          onClick={onUseServer}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(217,126,106,0.5)',
            background: 'rgba(217,126,106,0.15)',
            color: 'var(--text-primary)',
            fontFamily: "'Amiri', serif",
            fontSize: 'var(--font-sm)',
            cursor: 'pointer',
          }}
        >
          استخدم نسخة السيرفر
        </button>
      </div>
    </div>
  );
}
