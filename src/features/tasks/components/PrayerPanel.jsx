import { useAccessibleClick } from '@/shared/hooks';
import { Tick } from '@/shared/components';

export function PrayerPanel({ subtasks, subChecked, onToggleSub }) {
  const handleKeyDown = useAccessibleClick();

  return (
    <div className="panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
      {subtasks.map((s) => {
        const done = !!subChecked[s.id];
        return (
          <div
            key={s.id}
            role="checkbox"
            aria-checked={done}
            aria-label={s.text}
            tabIndex={0}
            onClick={() => onToggleSub(s.id)}
            onKeyDown={(e) => handleKeyDown(e, () => onToggleSub(s.id))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              cursor: 'pointer',
              background: done ? 'rgba(var(--gold-rgb),.12)' : 'rgba(255,255,255,.03)',
              border: `1px solid ${done ? 'rgba(var(--gold-rgb),.38)' : 'rgba(var(--gold-rgb),.1)'}`,
              borderRadius: 'var(--radius-pill)',
              padding: '5px 12px 5px 9px',
              transition: 'all .2s',
            }}
          >
            <div className={`schk ${done ? 'on' : ''}`} aria-hidden="true">
              {done && <Tick size={10} />}
            </div>
            <span
              style={{
                fontSize: 'var(--font-base)',
                color: done ? 'var(--gold)' : 'rgba(var(--gold-rgb),.68)',
                fontWeight: done ? 700 : 400,
                textDecoration: done ? 'line-through' : 'none',
                transition: 'all .2s',
              }}
            >
              {s.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
