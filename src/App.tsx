import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
  Suspense,
  lazy,
} from 'react';
import './app.css';
import { useSync } from '@/lib/sync';
import { useNotifications, useToasts } from '@/shared/hooks';
import { AppShell, ErrorBoundary } from '@/shared/components';
import { TaskContext, useTaskManager, INITIAL_TASKS, TaskModal } from '@/features/tasks';
import { getLogicalDateISO } from '@/features/tasks/data/scheduleConfig';
import {
  TasksErrorFallback,
  FinanceErrorFallback,
  CalendarErrorFallback,
} from '@/shared/components/FeatureErrorFallback';
import { useAuth } from '@/features/auth/useAuth';
import LoginPage from '@/features/auth/LoginPage';
import type { CheckedMap, SubCheckedMap } from '@/types';

// Lazy load feature pages
const TasksPage = lazy(() => import('@/features/tasks/components/TasksPage'));
const CalendarView = lazy(() =>
  import('@/features/calendar/CalendarPage').then((m) => ({ default: m.default }))
);
const FinancePage = lazy(() => import('@/features/finance/components/FinancePage'));

// ── AppContent — all hooks live here (no early returns allowed above hooks) ──
function AppContent({ logout }: { logout: () => void }) {
  const [activeTab, setActiveTab] = useState('tasks');
  // M-5: Lifted here so the selected month/day survive tab switches
  const [calCurrentDate, setCalCurrentDate] = useState(() => new Date());
  const [calSelectedDate, setCalSelectedDate] = useState(() => {
    const dayStartHour = Number(localStorage.getItem('mhm_day_start_hour') || '0');
    return getLogicalDateISO(dayStartHour);
  });
  const toasts = useToasts();
  const { onNewDay, onQuota, addSyncToast } = toasts;

  // ── Auto-snapshot ref — always points to the latest shift-filtered snapshot fn ──
  // Defined before useSync so it can be passed as the 4th arg. The ref itself is
  // populated after useTaskManager (which provides the correct otherTasks / progress).
  // Using a ref+stableCallback pattern avoids adding useSync to the re-render cycle.
  const autoSnapshotFnRef = useRef<
    (date?: string, fallbackChecked?: CheckedMap, fallbackSubChecked?: SubCheckedMap) => void
  >(() => undefined);
  const stableAutoSnapshot = useCallback(
    (date?: string, fallbackChecked?: CheckedMap, fallbackSubChecked?: SubCheckedMap) =>
      autoSnapshotFnRef.current(date, fallbackChecked, fallbackSubChecked),
    []
  );

  const {
    tasks,
    setTasks,
    checked,
    setChecked,
    subChecked,
    setSubChecked,
    skipped,
    setSkipped,
    schedule,
    setSchedule,
    shift,
    setShift,
    syncStatus,
    dayStartHour,
    setDayStartHour,
    saveSnapshot,
  } = useSync(INITIAL_TASKS, onNewDay, onQuota, stableAutoSnapshot, addSyncToast);

  const { notifPerm, requestNotifPerm } = useNotifications(tasks);

  const tm = useTaskManager(
    tasks,
    setTasks,
    checked,
    setChecked,
    subChecked,
    setSubChecked,
    skipped,
    setSkipped,
    shift,
    schedule,
    saveSnapshot,
    addSyncToast
  );
  const { prayersDone, prayerTotal } = tm;

  // ── Keep autoSnapshotFnRef populated with the latest shift-filtered data ──────
  // No dependency array — intentional. We want this ref to always capture the
  // freshest render values so the midnight tick never reads stale progress data.
  // This is the correct data source: same otherTasks/progress/countDone/totalOther
  // the user sees on screen, not an ad-hoc recomputation over all tasks.
  //
  // When snapshotting a past date (e.g., 4 AM May 21 taking May 20 snapshot),
  // we must recalculate countDone/totalOther based on that day's actual tasks,
  // not today's filtered visibility. Otherwise, if May 20 had only "مرة واحدة" tasks
  // (deleted at midnight), the snapshot would show 0% progress despite tasks being done.
  useLayoutEffect(() => {
    autoSnapshotFnRef.current = (
      date?: string,
      fallbackChecked?: CheckedMap,
      fallbackSubChecked?: SubCheckedMap
    ) => {
      const targetDate = date || getLogicalDateISO(dayStartHour);
      const logicalToday = getLogicalDateISO(dayStartHour);

      const resolvedChecked = fallbackChecked ?? checked;
      const resolvedSubChecked = fallbackSubChecked ?? subChecked;

      let snapshotCountDone = tm.countDone;
      let snapshotTotalOther = tm.totalOther;
      let snapshotProgress = tm.progress;
      let snapshotTasks = tm.otherTasks;
      let snapshotPrayersDone = prayersDone;
      let snapshotPrayerTotal = prayerTotal;

      if (targetDate !== logicalToday) {
        const targetDateObj = new Date(targetDate + 'T12:00:00');
        const dayOfWeek = targetDateObj.getDay();

        const workExceptions = JSON.parse(localStorage.getItem('mhm_work_exceptions') || '[]');
        const vacationDays = JSON.parse(localStorage.getItem('mhm_vacation_days') || '[]');
        const isExceptionalOffDay =
          workExceptions.includes(targetDate) || vacationDays.includes(targetDate);
        const workday = isExceptionalOffDay
          ? false
          : (schedule.find((s) => s.id === shift)?.offDays || []).includes(dayOfWeek) === false;

        const allTasksForDate = tasks.filter((t) => {
          const taskShifts = t.shifts ?? ['morning', 'evening'];
          if (!taskShifts.includes(shift)) return false;

          // Exclude tasks that were created logically AFTER the snapshot target date
          // We must cast t to any because createdAt is not explicitly in the Task interface
          const createdStr = (t as any).createdAt;
          if (createdStr) {
            const logicalCreated = getLogicalDateISO(dayStartHour, new Date(createdStr));
            if (logicalCreated > targetDate) return false;
          }

          const rec = t.recurrence ?? 'يومي';
          if (rec === 'أيام العمل' && !workday) return false;
          if (rec === 'موعد محدد') {
            if (!t.date || t.date !== targetDate) return false;
          }
          if (rec === 'شهري') {
            if (!t.date) return true;
            const anchor = new Date(t.date + 'T12:00:00');
            return anchor.getDate() === targetDateObj.getDate();
          }
          if (rec === 'أسبوعي') {
            if (!t.date) return true;
            const anchor = new Date(t.date + 'T12:00:00');
            return anchor.getDay() === targetDateObj.getDay();
          }
          return true;
        });

        snapshotTasks = allTasksForDate.filter((t) => !t.isPrayerTask);

        const skippedOther = snapshotTasks.filter((t) => skipped[t.id]);
        snapshotTotalOther = snapshotTasks.length - skippedOther.length;

        snapshotCountDone = snapshotTasks.filter((t) => {
          if (t.subtasks && t.subtasks.length > 0) {
            const required = t.subtasks.filter((s) => !s.isOptional);
            if (required.length === 0) {
              return t.subtasks.every((s) => resolvedSubChecked[s.id]);
            }
            return required.every((s) => resolvedSubChecked[s.id]);
          }
          return resolvedChecked[t.id];
        }).length;

        const pt = allTasksForDate.find((t) => t.isPrayerTask);
        const reqSubs = pt ? pt.subtasks.filter((s) => !s.isOptional) : [];
        snapshotPrayerTotal = reqSubs.length;
        snapshotPrayersDone = reqSubs.filter((s) => resolvedSubChecked[s.id]).length;

        snapshotProgress =
          snapshotTotalOther > 0
            ? Math.round(
                ((snapshotCountDone + snapshotPrayersDone) /
                  (snapshotTotalOther + snapshotPrayerTotal)) *
                  100
              )
            : snapshotPrayerTotal > 0
              ? Math.round((snapshotPrayersDone / snapshotPrayerTotal) * 100)
              : 0;
      }

      void saveSnapshot({
        date: targetDate,
        tasks: snapshotTasks,
        checked: { ...resolvedChecked, ...resolvedSubChecked },
        skipped,
        progress: snapshotProgress,
        countDone: snapshotCountDone,
        totalOther: snapshotTotalOther,
      });
    };
  });

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
      setSkipped,
      scheduleConfig: schedule,
      setScheduleConfig: setSchedule,
      tasks,
      setTasks,
      prayersDone,
      prayerTotal,
      notifPerm,
      requestNotifPerm,
      dayStartHour,
      setDayStartHour,
      saveSnapshot,
    }),
    [
      tm,
      setChecked,
      setSubChecked,
      setSkipped,
      schedule,
      setSchedule,
      tasks,
      setTasks,
      prayersDone,
      prayerTotal,
      notifPerm,
      requestNotifPerm,
      dayStartHour,
      setDayStartHour,
      saveSnapshot,
    ]
  );

  const logicalDate = getLogicalDateISO(dayStartHour);
  const today = new Date(logicalDate + 'T12:00:00').toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <ErrorBoundary level="global">
      <AppShell
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        shift={shift}
        syncStatus={syncStatus}
        toasts={toasts}
        onLogout={logout}
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
          <TaskContext.Provider value={taskContextValue}>
            <ErrorBoundary level="feature" fallback={<TasksErrorFallback />}>
              {activeTab === 'tasks' && (
                <TasksPage today={today} shift={shift} setShift={setShift} />
              )}
            </ErrorBoundary>

            <ErrorBoundary level="feature" fallback={<CalendarErrorFallback />}>
              {activeTab === 'calendar' && (
                <CalendarView
                  tasks={tasks}
                  currentDate={calCurrentDate}
                  setCurrentDate={setCalCurrentDate}
                  selectedDate={calSelectedDate}
                  setSelectedDate={setCalSelectedDate}
                />
              )}
            </ErrorBoundary>
          </TaskContext.Provider>

          <ErrorBoundary level="feature" fallback={<FinanceErrorFallback />}>
            {activeTab === 'finance' && <FinancePage syncStatus={syncStatus} />}
          </ErrorBoundary>
        </Suspense>

        {/* Add/Edit Modal */}
        <TaskModal
          modal={tm.modal}
          form={tm.form}
          onFormField={tm.setFormField}
          onSave={tm.saveTask}
          onClose={() => tm.setModal(null)}
          schedule={schedule}
        />

        {/* Delete Confirm */}
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
      </AppShell>
    </ErrorBoundary>
  );
}

// ── App — auth gate only, no data hooks ──────────────────────────────────────
export default function App() {
  const { isAuthenticated, isLoading: authLoading, login, logout } = useAuth();

  if (authLoading) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          fontSize: '2.5rem',
          color: 'var(--gold)',
        }}
        aria-label="جاري التحميل"
      >
        ✦
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage login={login} />;
  }

  return <AppContent logout={logout} />;
}
