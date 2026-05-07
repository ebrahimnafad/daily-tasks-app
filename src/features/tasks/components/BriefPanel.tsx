import type { Brief } from '@/types';

interface BriefPanelProps {
  brief?: Brief;
}

export function BriefPanel({ brief }: BriefPanelProps) {
  if (!brief) return null;
  return (
    <div className="expand-panel">
      <div style={{ display: 'flex', gap: 'var(--space-lg)' }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 'var(--font-sm)',
              fontWeight: 700,
              color: '#d97e6a',
              marginBottom: 'var(--space-md)',
            }}
          >
            ⚠️ عوائق محتملة
          </div>
          {brief.blockers && brief.blockers.length > 0 ? (
            brief.blockers.map((b, i) => (
              <div key={i} className="brief-item">
                <div className="brief-item__dot" style={{ background: '#d97e6a', opacity: 0.75 }} />
                {b}
              </div>
            ))
          ) : (
            <div style={{ fontSize: 'var(--font-base)', color: 'rgba(var(--gold-rgb),.3)' }}>
              لا يوجد
            </div>
          )}
        </div>
        <div className="brief-divider" />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 'var(--font-sm)',
              fontWeight: 700,
              color: '#9bc87a',
              marginBottom: 'var(--space-md)',
            }}
          >
            ✅ مساعدات
          </div>
          {brief.helpers && brief.helpers.length > 0 ? (
            brief.helpers.map((h, i) => (
              <div key={i} className="brief-item">
                <div className="brief-item__dot" style={{ background: '#9bc87a', opacity: 0.85 }} />
                {h}
              </div>
            ))
          ) : (
            <div style={{ fontSize: 'var(--font-base)', color: 'rgba(var(--gold-rgb),.3)' }}>
              لا يوجد
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
