import { TabBar } from '@/shared/components';
import type { ToastsReturn } from '@/shared/hooks/useToasts';
import { getSyncBadgeInfo } from '@/lib/sync/syncBadge';
import type { SyncStatus } from '@/types';

interface AppShellProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  shift: string;
  syncStatus: SyncStatus;
  toasts: ToastsReturn;
  onLogout?: () => void;
}

function SyncBadge({ status }: { status: SyncStatus }) {
  const { icon, text, cls } = getSyncBadgeInfo(status);

  // Hide if synced or offline, but using CSS opacity for a smooth fade out
  const isHidden = status === 'synced' || status === 'offline';

  return (
    <div
      className={`sync-badge ${cls}`}
      role="status"
      aria-live="polite"
      style={{
        opacity: isHidden ? 0 : 1,
        pointerEvents: 'none',
        transition: isHidden ? 'opacity 0.5s ease 1.5s' : 'opacity 0.2s ease',
      }}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

export default function AppShell({
  children,
  activeTab,
  setActiveTab,
  shift,
  syncStatus,
  toasts,
  onLogout,
}: AppShellProps) {
  const { newDayToast, quotaError, needRefresh, updateServiceWorker } = toasts;

  return (
    <div
      dir="rtl"
      data-shift={shift}
      style={{
        minHeight: '100vh',
        background: 'var(--bg-gradient)',
        fontFamily: "'Amiri',serif",
        transition: 'background 0.6s ease',
      }}
    >
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} financeBadge={0} />
      {activeTab !== 'finance' && <SyncBadge status={syncStatus} />}

      {/* Logout button */}
      {onLogout && (
        <button
          id="logout-btn"
          onClick={onLogout}
          title="تسجيل الخروج"
          aria-label="تسجيل الخروج"
          style={{
            position: 'fixed',
            top: 12,
            left: 12,
            zIndex: 200,
            background: 'rgba(var(--gold-rgb), 0.08)',
            border: '1px solid rgba(var(--gold-rgb), 0.2)',
            borderRadius: 'var(--radius-sm)',
            color: 'rgba(var(--gold-rgb), 0.5)',
            fontSize: '16px',
            padding: '4px 8px',
            cursor: 'pointer',
            lineHeight: 1,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--gold)';
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              'rgba(var(--gold-rgb), 0.45)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(var(--gold-rgb), 0.5)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(var(--gold-rgb), 0.2)';
          }}
        >
          🚪
        </button>
      )}

      {newDayToast && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: 'var(--space-lg)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 300,
            background: 'rgba(155,200,122,0.15)',
            border: '1px solid rgba(155,200,122,0.4)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-md) var(--space-xl)',
            color: '#9bc87a',
            fontSize: 'var(--font-base)',
            fontFamily: "'Amiri',serif",
            backdropFilter: 'blur(8px)',
          }}
        >
          🌅 يوم جديد — تم تصفير المهام اليومية تلقائياً
        </div>
      )}

      {quotaError && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: 'var(--space-lg)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 300,
            background: 'rgba(217,126,106,0.15)',
            border: '1px solid rgba(217,126,106,0.4)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-md) var(--space-xl)',
            color: '#d97e6a',
            fontSize: 'var(--font-base)',
            fontFamily: "'Amiri',serif",
            backdropFilter: 'blur(8px)',
          }}
        >
          ⚠️ ذاكرة المتصفح ممتلئة — لن يتم حفظ التغييرات محلياً
        </div>
      )}

      {needRefresh && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            bottom: 56,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 300,
            background: 'rgba(110,159,207,0.15)',
            border: '1px solid rgba(110,159,207,0.4)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-md) var(--space-lg)',
            color: '#6e9fcf',
            fontSize: 'var(--font-base)',
            fontFamily: "'Amiri',serif",
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-md)',
            whiteSpace: 'nowrap',
          }}
        >
          <span>🔄 يتوفر تحديث جديد للتطبيق</span>
          <button
            onClick={() => updateServiceWorker(true)}
            style={{
              background: 'rgba(110,159,207,0.2)',
              border: '1px solid rgba(110,159,207,0.4)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-xs) var(--space-md)',
              color: '#6e9fcf',
              fontFamily: "'Amiri',serif",
              fontSize: 'var(--font-base)',
              cursor: 'pointer',
            }}
          >
            تحديث الآن
          </button>
        </div>
      )}

      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: `radial-gradient(circle at 20% 20%,rgba(var(--gold-rgb),.06) 0%,transparent 50%),radial-gradient(circle at 80% 80%,rgba(var(--gold-rgb),.04) 0%,transparent 50%)`,
        }}
        aria-hidden="true"
      />

      {children}
    </div>
  );
}
