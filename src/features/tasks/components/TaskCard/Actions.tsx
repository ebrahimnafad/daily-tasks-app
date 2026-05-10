import { useTaskCardContext } from './TaskCardContext';

export default function Actions() {
  const { isActionsOpen, task, tm, isSkipped } = useTaskCardContext();

  if (!isActionsOpen) return null;

  return (
    <div className="expand-panel">
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 'var(--space-md)',
          justifyContent: 'space-between',
        }}
      >
        <button
          style={{
            flex: 1,
            textAlign: 'center',
            padding: 'var(--space-sm) var(--space-md)',
            background: 'rgba(var(--gold-rgb), 0.1)',
            border: '1px solid rgba(var(--gold-rgb), 0.2)',
            color: 'var(--text-gold)',
            fontFamily: 'inherit',
            fontSize: 'var(--font-base)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(var(--gold-rgb), 0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(var(--gold-rgb), 0.1)')}
          aria-label={`تعديل مهمة: ${task.title}`}
          onClick={(e) => {
            e.stopPropagation();
            tm.openEdit(task, e);
          }}
        >
          ✏️ تعديل
        </button>

        <button
          style={{
            flex: 1,
            textAlign: 'center',
            padding: 'var(--space-sm) var(--space-md)',
            background: 'rgba(217, 126, 106, 0.1)',
            border: '1px solid rgba(217, 126, 106, 0.2)',
            color: '#d97e6a',
            fontFamily: 'inherit',
            fontSize: 'var(--font-base)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(217, 126, 106, 0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(217, 126, 106, 0.1)')}
          aria-label={`حذف مهمة: ${task.title}`}
          onClick={(e) => {
            e.stopPropagation();
            tm.setDeleteConfirm(task.id);
          }}
        >
          🗑️ حذف
        </button>

        <button
          style={{
            flex: 1,
            textAlign: 'center',
            padding: 'var(--space-sm) var(--space-md)',
            background: 'rgba(var(--gold-rgb), 0.1)',
            border: '1px solid rgba(var(--gold-rgb), 0.2)',
            color: 'var(--text-gold)',
            fontFamily: 'inherit',
            fontSize: 'var(--font-base)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(var(--gold-rgb), 0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(var(--gold-rgb), 0.1)')}
          aria-label={isSkipped ? `إلغاء تخطي مهمة: ${task.title}` : `تخطي مهمة: ${task.title}`}
          onClick={(e) => {
            e.stopPropagation();
            tm.toggleSkipTask(task.id);
          }}
        >
          {isSkipped ? '↩️ إلغاء التخطي' : '⏭️ تخطي'}
        </button>

        <button
          style={{
            flex: 1,
            textAlign: 'center',
            padding: 'var(--space-sm) var(--space-md)',
            background: 'rgba(var(--gold-rgb), 0.1)',
            border: '1px solid rgba(var(--gold-rgb), 0.2)',
            color: 'var(--text-gold)',
            fontFamily: 'inherit',
            fontSize: 'var(--font-base)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(var(--gold-rgb), 0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(var(--gold-rgb), 0.1)')}
          aria-label={
            task.isPinned ? `إزالة تثبيت مهمة: ${task.title}` : `تثبيت مهمة: ${task.title}`
          }
          onClick={(e) => {
            e.stopPropagation();
            tm.togglePinTask(task.id);
          }}
        >
          {task.isPinned ? '📌 إزالة التثبيت' : '📌 تثبيت'}
        </button>
      </div>
    </div>
  );
}
