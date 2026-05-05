export function BriefPanel({ brief }) {
  if (!brief) return null;
  return (
    <div className="panel">
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
          {brief.blockers?.length > 0 ? (
            brief.blockers.map((b, i) => (
              <div key={i} className="bitem">
                <div className="bdot" style={{ background: '#d97e6a', opacity: 0.75 }} />
                {b}
              </div>
            ))
          ) : (
            <div style={{ fontSize: 'var(--font-base)', color: 'rgba(var(--gold-rgb),.3)' }}>
              لا يوجد
            </div>
          )}
        </div>
        <div className="dvv" />
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
          {brief.helpers?.length > 0 ? (
            brief.helpers.map((h, i) => (
              <div key={i} className="bitem">
                <div className="bdot" style={{ background: '#9bc87a', opacity: 0.85 }} />
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
