import { useState } from 'react';
import type { OkrObjective, OkrKeyResult, OkrCheckIn } from '../hooks/useOkrManager';
import KeyResultRow from './KeyResultRow';
import OkrProgress from './OkrProgress';

interface ObjectiveCardProps {
  objective: OkrObjective;
  keyResults: OkrKeyResult[];
  checkInsMap: Record<string, OkrCheckIn[]>;
  progress: number; // 0–100 from computeObjectiveProgress
  onAddKR: (objectiveId: string) => void;
  onEditObjective: (obj: OkrObjective) => void;
  onDeleteObjective: (id: string) => void;
  onRecordProgress: (kr: OkrKeyResult) => void;
  onEditKR: (kr: OkrKeyResult) => void;
  onDeleteKR: (id: string) => void;
}

export default function ObjectiveCard({
  objective,
  keyResults,
  checkInsMap,
  progress,
  onAddKR,
  onEditObjective,
  onDeleteObjective,
  onRecordProgress,
  onEditKR,
  onDeleteKR,
}: ObjectiveCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const accentColor = objective.color ?? 'var(--gold)';

  return (
    <div
      className="okr-objective-card"
      style={{ '--obj-accent': accentColor } as React.CSSProperties}
    >
      {/* Header — flex row. Expand toggle is its own button; overflow/ring are siblings. */}
      <div className="okr-objective-card__header">
        {/* Accent bar */}
        <div
          className="okr-objective-card__accent"
          style={{ background: accentColor }}
          aria-hidden
        />

        {/* Expand button covers icon + title block */}
        <button
          className="okr-objective-card__expand-btn"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'طي' : 'توسيع'} هدف: ${objective.title}`}
        >
          <span className="okr-objective-card__icon" aria-hidden>
            {objective.icon ?? '🎯'}
          </span>
          <div className="okr-objective-card__title-block">
            <span className="okr-objective-card__title">{objective.title}</span>
            <span className="okr-objective-card__kr-count">{keyResults.length} نتائج</span>
          </div>
          <span
            className="tpg-pinned-header__chevron"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            aria-hidden
          >
            ▼
          </span>
        </button>

        {/* Progress ring — non-interactive wrapper */}
        <OkrProgress progress={progress} size={52} strokeWidth={5} />

        {/* Overflow menu */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            className="icon-btn"
            style={{ background: 'transparent', border: 'none', opacity: 0.5, fontSize: '18px' }}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="خيارات الهدف"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                onClick={() => setMenuOpen(false)}
                aria-hidden
              />
              <div className="okr-overflow-menu" role="menu">
                <button
                  className="okr-overflow-menu__item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onEditObjective(objective);
                  }}
                >
                  ✏️ تعديل الهدف
                </button>
                <button
                  className="okr-overflow-menu__item okr-overflow-menu__item--danger"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onDeleteObjective(objective.id);
                  }}
                >
                  🗑️ حذف الهدف
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* KR list (expandable) */}
      {expanded && (
        <div className="okr-kr-list">
          {keyResults.length === 0 ? (
            <p
              className="okr-empty"
              style={{ margin: 'var(--space-md) 0', fontSize: 'var(--font-sm)' }}
            >
              لا توجد نتائج رئيسية بعد
            </p>
          ) : (
            keyResults.map((kr) => (
              <KeyResultRow
                key={kr.id}
                kr={kr}
                checkIns={checkInsMap[kr.id] ?? []}
                onRecordProgress={onRecordProgress}
                onEdit={onEditKR}
                onDelete={onDeleteKR}
              />
            ))
          )}

          <button
            className="fin-add-btn"
            style={{ marginTop: 'var(--space-md)' }}
            onClick={() => onAddKR(objective.id)}
          >
            ＋ نتيجة رئيسية
          </button>
        </div>
      )}
    </div>
  );
}
