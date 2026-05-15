// L-12: Extracted from CalendarPage — sync status badge + error banner
type SyncStatus = 'syncing' | 'synced' | 'offline' | 'error';

const SYNC_LABELS: Record<string, string> = {
  syncing: '🔄 جاري الحفظ...',
  synced: '✓ محفوظ',
  offline: '📴 غير متصل',
  error: '⚠️ خطأ في الحفظ',
};

interface SyncStatusBarProps {
  syncStatus: SyncStatus;
  syncError: string | null;
  onRetry: () => void;
}

export default function SyncStatusBar({ syncStatus, syncError, onRetry }: SyncStatusBarProps) {
  return (
    <>
      <div
        className={`sync-badge ${syncStatus}`}
        style={{ position: 'static', marginTop: '12px', width: 'fit-content' }}
        aria-live="polite"
      >
        {SYNC_LABELS[syncStatus]}
      </div>

      {/* C-1: Non-dismissable sync error banner with retry */}
      {syncError && (
        <div
          className="cal-sync-error"
          role="alert"
          aria-live="assertive"
          style={{
            marginTop: '10px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(217,126,106,0.15)',
            border: '1px solid rgba(217,126,106,0.5)',
            color: 'var(--text-primary, #e8e0d0)',
            fontSize: 'var(--font-sm, 0.85rem)',
            lineHeight: 1.6,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <span>⚠️ {syncError}</span>
          <button
            onClick={onRetry}
            style={{
              alignSelf: 'flex-start',
              padding: '4px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(217,126,106,0.6)',
              background: 'rgba(217,126,106,0.2)',
              color: 'inherit',
              fontFamily: "'Amiri', serif",
              fontSize: 'var(--font-sm, 0.85rem)',
              cursor: 'pointer',
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      )}
    </>
  );
}
