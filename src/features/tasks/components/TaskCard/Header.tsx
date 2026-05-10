import { useTaskCardContext } from './TaskCardContext';
import { PrayerRing, SubRing, AccessibleCheckbox } from '@/shared/components';

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
};

export default function Header() {
  const {
    task,
    isChecked,
    setChecked,
    hasSubs,
    subsDone,
    done,
    isExpanded,
    onToggleExpanded,
    isBriefOpen,
    onToggleBrief,
    isSubtaskOpen,
    onToggleSubtask,
    isActionsOpen,
    onToggleActions,
    prayersDone,
    prayerTotal,
  } = useTaskCardContext();

  return (
    <div
      style={{
        padding: 'var(--space-md) var(--space-lg)',
        display: 'flex',
        alignItems: 'stretch',
        gap: 'var(--space-md)',
        direction: 'rtl',
      }}
    >
      {/* ── Right column: circle spans full height of both rows ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {task.isPrayerTask ? (
          <PrayerRing done={prayersDone} total={prayerTotal} />
        ) : hasSubs ? (
          <SubRing done={subsDone} total={task.subtasks.length} color={task.color} />
        ) : (
          <AccessibleCheckbox
            checked={isChecked}
            color={task.color}
            onToggle={() => setChecked((p) => ({ ...p, [task.id]: !p[task.id] }))}
            label={`تأشير مهمة: ${task.title}`}
          />
        )}
      </div>

      {/* ── Content column: 2 rows, excludes area under circle ── */}
      <div
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-xs)',
        }}
      >
        {/* Row 1: icon · title · category chip · recurrence chip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
          }}
        >
          <span style={{ fontSize: 'var(--font-lg)', flexShrink: 0 }} aria-hidden="true">
            {task.icon}
          </span>

          <span
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: done ? 'rgba(var(--gold-rgb),.38)' : 'var(--text-gold)',
              fontSize: 'var(--font-md)',
              fontWeight: 700,
              textDecoration: done ? 'line-through' : 'none',
              transition: 'color .3s',
            }}
          >
            {task.isPinned && '📌 '}
            {task.title}
          </span>

          <span
            style={{
              flexShrink: 0,
              fontSize: 'var(--font-sm)',
              background: `color-mix(in srgb, ${task.color} 11%, transparent)`,
              color: task.color,
              border: `1px solid color-mix(in srgb, ${task.color} 22%, transparent)`,
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              whiteSpace: 'nowrap',
            }}
          >
            {task.category}
          </span>

          <span
            style={{
              flexShrink: 0,
              fontSize: 'var(--font-sm)',
              color: 'rgba(var(--gold-rgb),.48)',
              background: 'rgba(255,255,255,0.05)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              whiteSpace: 'nowrap',
            }}
          >
            {task.recurrence || 'يومي'}
          </span>
          {task.date && (
            <span
              style={{
                flexShrink: 0,
                fontSize: 'var(--font-sm)',
                color: 'var(--gold)',
                background: 'rgba(var(--gold-rgb),.1)',
                border: '1px solid rgba(var(--gold-rgb),.3)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                whiteSpace: 'nowrap',
              }}
            >
              📅 {formatDate(task.date)}
            </span>
          )}
        </div>

        {/* Row 2: full width of content column — alert · قائمة/صلوات · بريف · edit · delete */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            width: '100%',
          }}
        >
          {task.alertTime && (
            <span
              style={{
                fontSize: 'var(--font-sm)',
                color: '#d97e6a',
                background: 'rgba(217,126,106,.08)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                whiteSpace: 'nowrap',
              }}
            >
              🔔 {task.alertTime}
            </span>
          )}

          {!task.isPrayerTask && (
            <button
              className={`toggle-btn ${isSubtaskOpen ? 'on' : ''}`}
              style={{ flex: 1, textAlign: 'center' }}
              aria-expanded={isSubtaskOpen}
              aria-label={isSubtaskOpen ? 'إخفاء القائمة الفرعية' : 'عرض القائمة الفرعية'}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSubtask();
              }}
            >
              <span style={{ fontSize: 'var(--font-sm)' }} aria-hidden="true">
                {isSubtaskOpen ? '▲' : '▼'}
              </span>
              قائمة
            </button>
          )}

          {task.isPrayerTask && (
            <button
              className={`toggle-btn ${isExpanded ? 'on' : ''}`}
              style={{ flex: 1, textAlign: 'center' }}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'إخفاء الصلوات' : 'عرض الصلوات'}
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpanded();
              }}
            >
              <span style={{ fontSize: 'var(--font-sm)' }} aria-hidden="true">
                {isExpanded ? '▲' : '▼'}
              </span>
              صلوات
            </button>
          )}

          <button
            className={`toggle-btn ${isBriefOpen ? 'on' : ''}`}
            style={{ flex: 1, textAlign: 'center' }}
            aria-expanded={isBriefOpen}
            aria-label={isBriefOpen ? 'إخفاء البريف' : 'عرض البريف'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleBrief();
            }}
          >
            <span style={{ fontSize: 'var(--font-sm)' }} aria-hidden="true">
              {isBriefOpen ? '▲' : '▼'}
            </span>
            بريف
          </button>

          <button
            className={`toggle-btn ${isActionsOpen ? 'on' : ''}`}
            style={{ flex: 1, textAlign: 'center' }}
            aria-expanded={isActionsOpen}
            aria-label={isActionsOpen ? 'إغلاق الإجراءات' : 'فتح الإجراءات'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleActions();
            }}
          >
            <span style={{ fontSize: 'var(--font-sm)' }} aria-hidden="true">
              {isActionsOpen ? '▲' : '▼'}
            </span>
            إجراءات
          </button>
        </div>
      </div>
    </div>
  );
}
