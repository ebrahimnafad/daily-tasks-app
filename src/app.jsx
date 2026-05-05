import { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import './app.css';
import { useSync } from '@/lib/sync';
import { useNotifications, useToasts } from '@/shared/hooks';
import { AppShell } from '@/shared/components';
import { TaskContext, useTaskManager, INITIAL_TASKS, TaskModal } from '@/features/tasks';

// Lazy load feature pages
const TasksPage = lazy(() => import('@/features/tasks/components/TasksPage.jsx'));
const FinancePage = lazy(() => import('@/features/finance/components/FinancePage.jsx'));

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('tasks');
  const toasts = useToasts();
  const { onNewDay } = toasts;

  const {
    tasks,
    setTasks,
    checked,
    setChecked,
    subChecked,
    setSubChecked,
    shift,
    setShift,
    syncStatus,
  } = useSync(INITIAL_TASKS, onNewDay);

  const { notifPerm, requestNotifPerm } = useNotifications(tasks);

  // ── UI State ─────────────────────────────────────────────────────────────
  const tm = useTaskManager(tasks, setTasks, checked, setChecked, subChecked, setSubChecked);
  const { prayersDone, prayerTotal } = tm;

  // ── Dynamic Theme ─────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      const h = new Date().getHours();
      const theme =
        h >= 4 && h < 8
          ? 'dawn'
          : h < 12
            ? 'morning'
            : h < 17
              ? 'afternoon'
              : h < 19
                ? 'sunset'
                : 'night';
      document.documentElement.setAttribute('data-theme', theme);
    };
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, []);

  const taskContextValue = useMemo(
    () => ({
      tm,
      setChecked,
      setSubChecked,
      prayersDone,
      prayerTotal,
      notifPerm,
      requestNotifPerm,
    }),
    [tm, setChecked, setSubChecked, prayersDone, prayerTotal, notifPerm, requestNotifPerm]
  );

  const today = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      shift={shift}
      syncStatus={syncStatus}
      toasts={toasts}
    >
      <Suspense
        fallback={
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-xl)',
              color: 'var(--gold)',
              fontSize: 'var(--font-lg)',
            }}
          >
            جاري التحميل...
          </div>
        }
      >
        {activeTab === 'tasks' && (
          <TaskContext.Provider value={taskContextValue}>
            <TasksPage today={today} shift={shift} setShift={setShift} />
          </TaskContext.Provider>
        )}
        {activeTab === 'finance' && <FinancePage />}
      </Suspense>

      {/* Add/Edit Modal */}
      <TaskModal
        modal={tm.modal}
        form={tm.form}
        onFormField={tm.setFormField}
        onSave={tm.saveTask}
        onClose={() => tm.setModal(null)}
      />

      {/* Delete Confirm */}
      {tm.deleteConfirm !== null && (
        <div className="cov" role="dialog" aria-modal="true" aria-labelledby="del-title">
          <div className="cbox">
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
                onClick={() => tm.deleteTask(tm.deleteConfirm)}
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
    </AppShell>
  );
}
