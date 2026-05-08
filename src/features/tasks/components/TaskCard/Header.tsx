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
        padding: 'var(--space-md) var(--space-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
      }}
    >
      {/* ── Line 1: [indicator] [icon] [title] ── [category] [recurrence] ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
        }}
      >
        {/* مؤشر التقدّم */}
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

        {/* الأيقونة */}
        <span style={{ fontSize: 'var(--font-lg)', flexShrink: 0 }} aria-hidden="true">
          {task.icon}
        </span>

        {/* العنوان – يأخذ كل المساحة المتبقية */}
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
          {task.title}
        </span>

        {/* شريحة الفئة */}
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

        {/* شريحة التكرار */}
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
      </div>

      {/* ── Line 2: [alert?] [قائمة/صلوات] [بريف] ── flex spacer ── [✏️] [🗑️] ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
        }}
      >
        {/* شريحة التنبيه (اختيارية) */}
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
  );
}
