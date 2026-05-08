import { useTaskCardContext } from './TaskCardContext';
import { PrayerRing, SubRing, AccessibleCheckbox } from '@/shared/components';

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
    tm,
    prayersDone,
    prayerTotal,
  } = useTaskCardContext();

  return (
    <div
      style={{
        padding: 'var(--space-lg) var(--space-lg)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-md)',
      }}
    >
      {/* مؤشر التقدّم / مربع الاختيار */}
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

      <span style={{ fontSize: 'var(--font-lg)' }} aria-hidden="true">
        {task.icon}
      </span>

      {/* عنوان المهمة ومعلوماتها */}
      <div style={{ flex: 1, minWidth: '50px' }}>
        <div
          style={{
            color: done ? 'rgba(var(--gold-rgb),.38)' : 'var(--text-gold)',
            fontSize: 'var(--font-md)',
            fontWeight: 700,
            textDecoration: done ? 'line-through' : 'none',
            transition: 'all .3s',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {task.title}
        </div>
        <div
          style={{
            fontSize: 'var(--font-sm)',
            color: 'rgba(var(--gold-rgb),.48)',
            marginTop: 'var(--space-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            flexWrap: 'wrap',
          }}
        >
          <span>{task.time}</span>
          <span
            style={{
              fontSize: 'var(--font-sm)',
              background: 'rgba(255,255,255,0.05)',
              padding: 'var(--space-xs) var(--space-sm)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {task.recurrence || 'يومي'}
          </span>
          {task.alertTime && (
            <span
              style={{
                fontSize: 'var(--font-sm)',
                color: '#d97e6a',
                background: 'rgba(217,126,106,.08)',
                padding: 'var(--space-xs) var(--space-sm)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              🔔 {task.alertTime}
            </span>
          )}
          {hasSubs && (
            <span className="sub-progress">
              {subsDone}/{task.subtasks.length}
            </span>
          )}
        </div>
      </div>

      {/* أزرار الجانب */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 'var(--space-sm)',
          flexShrink: 0,
        }}
      >
        <span
          className="task-badge"
          style={{
            background: `color-mix(in srgb, ${task.color} 11%, transparent)`,
            color: task.color,
            border: `1px solid color-mix(in srgb, ${task.color} 22%, transparent)`,
          }}
        >
          {task.category}
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
          {/* زر القائمة الفرعية */}
          {!task.isPrayerTask && (
            <button
              className={`toggle-btn--list ${isSubtaskOpen ? 'on' : ''}`}
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
          {/* زر الصلوات */}
          {task.isPrayerTask && (
            <button
              className={`toggle-btn ${isExpanded ? 'on' : ''}`}
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
          {/* زر البريف */}
          <button
            className={`toggle-btn ${isBriefOpen ? 'on' : ''}`}
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
          {/* زر التعديل */}
          <button
            className="icon-btn icon-btn--edit"
            aria-label={`تعديل مهمة: ${task.title}`}
            onClick={(e) => tm.openEdit(task, e)}
          >
            ✏️
          </button>
          {/* زر الحذف */}
          <button
            className="icon-btn icon-btn--delete"
            aria-label={`حذف مهمة: ${task.title}`}
            onClick={(e) => {
              e.stopPropagation();
              tm.setDeleteConfirm(task.id);
            }}
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}
