import { useState, useEffect, useLayoutEffect, useRef, useCallback, Suspense, lazy } from 'react';
import './app.css';
import { useSync } from '@/lib/sync';
import { useNotifications, useToasts } from '@/shared/hooks';
import { AppShell, ErrorBoundary } from '@/shared/components';
import { useTaskManager, INITIAL_TASKS, TaskProvider, TaskDialogs } from '@/features/tasks';
import { useDailySnapshot } from '@/features/tasks/hooks/useDailySnapshot';
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

  // ── Snapshot shim ref ──────────────────────────────────────────────────────
  // A stable ref-based shim is declared here so it can be passed to useSync
  // before useDailySnapshot is called (useSync needs it at construction time).
  // useDailySnapshot, called after all deps are available, wires the real
  // implementation into this ref via its internal useLayoutEffect.
  //
  // STALE CLOSURE: stableAutoSnapshot reads exclusively from snapshotFnRef.current,
  // which is populated by useDailySnapshot's useLayoutEffect before any paint.
  // The empty useCallback dep array is therefore safe — no state is closed over.
  const snapshotFnRef = useRef<
    (date?: string, fallbackChecked?: CheckedMap, fallbackSubChecked?: SubCheckedMap) => void
  >(() => undefined);
  const stableAutoSnapshot = useCallback(
    (date?: string, fallbackChecked?: CheckedMap, fallbackSubChecked?: SubCheckedMap) =>
      snapshotFnRef.current(date, fallbackChecked, fallbackSubChecked),
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

  // ── Wire useDailySnapshot into the shim ───────────────────────────────────
  // All deps (tasks, tm, checked, etc.) are now real. useDailySnapshot stores
  // them in its own internal ref and exposes snapshotImpl — a stable callback
  // that reads from that ref. We assign it to snapshotFnRef so that the
  // stableAutoSnapshot shim above forwards to it correctly.
  //
  // useLayoutEffect inside the hook (no dep array) runs before every paint,
  // keeping the internal ref fresh — identical to the original App.tsx pattern.
  const { snapshotImpl } = useDailySnapshot({
    dayStartHour,
    checked,
    subChecked,
    skipped,
    schedule,
    shift,
    tasks,
    tm,
    saveSnapshot,
  });

  // Wire the implementation into the shim ref before every paint.
  // useLayoutEffect (no dep array) runs synchronously after every render,
  // mirroring the pattern inside useDailySnapshot itself.
  //
  // ⚠️  STABILITY CONTRACT: snapshotImpl has an empty useCallback dep array
  // inside useDailySnapshot, making it permanently stable. If dependencies
  // are ever added to that useCallback, snapshotImpl will change on every
  // render — correct behaviour via the shim — but the STABILITY CONTRACT
  // comment in useDailySnapshot.ts must be updated to reflect the new contract.
  useLayoutEffect(() => {
    snapshotFnRef.current = snapshotImpl;
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
          <TaskProvider
            tm={tm}
            setChecked={setChecked}
            setSubChecked={setSubChecked}
            setSkipped={setSkipped}
            schedule={schedule}
            setSchedule={setSchedule}
            tasks={tasks}
            setTasks={setTasks}
            notifPerm={notifPerm}
            requestNotifPerm={requestNotifPerm}
            dayStartHour={dayStartHour}
            setDayStartHour={setDayStartHour}
            saveSnapshot={saveSnapshot}
          >
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

            <TaskDialogs />
          </TaskProvider>

          <ErrorBoundary level="feature" fallback={<FinanceErrorFallback />}>
            {activeTab === 'finance' && <FinancePage syncStatus={syncStatus} />}
          </ErrorBoundary>
        </Suspense>
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
