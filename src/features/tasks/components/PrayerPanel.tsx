import { useAccessibleClick } from '@/shared/hooks';
import { Tick } from '@/shared/components';
import type { Subtask, SubCheckedMap } from '@/types';

interface PrayerPanelProps {
  subtasks: Subtask[];
  subChecked: SubCheckedMap;
  onToggleSub: (subId: string | number) => void;
}

function PrayerChip({
  subtask,
  done,
  isOptional,
  onToggle,
}: {
  subtask: Subtask;
  done: boolean;
  isOptional: boolean;
  onToggle: () => void;
}) {
  const handleKeyDown = useAccessibleClick();

  return (
    <div
      role="checkbox"
      aria-checked={done}
      aria-label={subtask.text}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => handleKeyDown(e, onToggle)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        cursor: 'pointer',
        background: done
          ? isOptional
            ? 'rgba(var(--gold-rgb),.08)'
            : 'rgba(var(--gold-rgb),.12)'
          : 'rgba(255,255,255,.03)',
        border: `1px solid ${
          done
            ? isOptional
              ? 'rgba(var(--gold-rgb),.22)'
              : 'rgba(var(--gold-rgb),.38)'
            : 'rgba(var(--gold-rgb),.1)'
        }`,
        borderRadius: 'var(--radius-pill)',
        padding: '5px 12px 5px 9px',
        transition: 'all .2s',
        minWidth: '80px',
        flexShrink: 0,
        opacity: isOptional ? 0.85 : 1,
      }}
    >
      {isOptional ? (
        <span
          style={{
            fontSize: '14px',
            color: done ? 'var(--gold)' : 'rgba(var(--gold-rgb),.4)',
            lineHeight: 1,
            transition: 'color .2s',
          }}
          aria-hidden="true"
        >
          {done ? '★' : '☆'}
        </span>
      ) : (
        <div className={`task-checkbox--small ${done ? 'on' : ''}`} aria-hidden="true">
          {done && <Tick size={10} />}
        </div>
      )}
      <span
        style={{
          fontSize: 'var(--font-base)',
          color: done
            ? isOptional
              ? 'rgba(var(--gold-rgb),.8)'
              : 'var(--gold)'
            : 'rgba(var(--gold-rgb),.68)',
          fontWeight: done ? 700 : 400,
          textDecoration: done ? 'line-through' : 'none',
          transition: 'all .2s',
        }}
      >
        {subtask.text}
      </span>
    </div>
  );
}

export function PrayerPanel({ subtasks, subChecked, onToggleSub }: PrayerPanelProps) {
  const required = subtasks.filter((s) => !s.isOptional);
  const optional = subtasks.filter((s) => s.isOptional);

  return (
    <div className="expand-panel">
      {/* ── Fard prayers ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-sm)',
          justifyContent: 'center',
        }}
      >
        {required.map((s) => (
          <PrayerChip
            key={s.id}
            subtask={s}
            done={!!subChecked[s.id]}
            isOptional={false}
            onToggle={() => onToggleSub(s.id)}
          />
        ))}
      </div>

      {/* ── Optional (sunnah) prayers ── */}
      {optional.length > 0 && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '10px 0 6px',
            }}
          >
            <div
              style={{
                flex: 1,
                height: '1px',
                background: 'rgba(var(--gold-rgb),.12)',
              }}
            />
            <span
              style={{
                fontSize: '0.72em',
                color: 'rgba(var(--gold-rgb),.45)',
                whiteSpace: 'nowrap',
              }}
            >
              ☆ نوافل
            </span>
            <div
              style={{
                flex: 1,
                height: '1px',
                background: 'rgba(var(--gold-rgb),.12)',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-sm)',
              justifyContent: 'center',
            }}
          >
            {optional.map((s) => (
              <PrayerChip
                key={s.id}
                subtask={s}
                done={!!subChecked[s.id]}
                isOptional={true}
                onToggle={() => onToggleSub(s.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
