import { useTaskContext } from '@/features/tasks/context/TaskContext';
import TaskModal from '@/features/tasks/components/TaskModal';

export function TaskDialogs() {
  const { tm, scheduleConfig, tasks } = useTaskContext();

  return (
    <>
      <TaskModal
        modal={tm.modal}
        form={tm.form}
        onFormField={tm.setFormField}
        onSave={tm.saveTask}
        onClose={() => tm.setModal(null)}
        schedule={scheduleConfig}
      />

      {tm.deleteConfirm !== null && (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="del-title"
        >
          <div className="confirm-box">
            <div style={{ fontSize: '36px', marginBottom: 'var(--space-md)' }} aria-hidden="true">
              🗑️
            </div>
            <div
              id="del-title"
              style={{
                color: 'var(--text-gold)',
                fontSize: 'var(--font-lg)',
                fontWeight: 700,
                marginBottom: 'var(--space-sm)',
              }}
            >
              حذف المهمة؟
            </div>
            <div
              style={{
                color: 'rgba(var(--gold-rgb),.6)',
                fontSize: 'var(--font-base)',
                marginBottom: 'var(--space-xl)',
              }}
            >
              &quot;{tasks.find((t) => t.id === tm.deleteConfirm)?.title}&quot;
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button
                onClick={() => tm.deleteTask(tm.deleteConfirm!)}
                style={{
                  flex: 1,
                  padding: 'var(--space-md)',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: '#d97e6a',
                  color: 'white',
                  fontFamily: "'Amiri',serif",
                  fontSize: 'var(--font-md)',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                نعم، احذف
              </button>
              <button
                onClick={() => tm.setDeleteConfirm(null)}
                style={{
                  flex: 1,
                  padding: 'var(--space-md)',
                  borderRadius: 'var(--radius-md)',
                  background: 'transparent',
                  border: '1px solid rgba(var(--gold-rgb),.25)',
                  color: 'rgba(var(--gold-rgb),.7)',
                  fontFamily: "'Amiri',serif",
                  fontSize: 'var(--font-md)',
                  cursor: 'pointer',
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
