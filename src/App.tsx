import { useState, useEffect, Suspense, lazy } from 'react';
import { LS_KEYS } from '@/lib/storage/keys';
import './app.css';
import { useSync } from '@/lib/sync';
import { useNotifications, useToasts } from '@/shared/hooks';
import { AppShell, ErrorBoundary } from '@/shared/components';
import { useTaskManager, INITIAL_TASKS, TaskProvider, TaskDialogs } from '@/features/tasks';
import { useDailySnapshot } from '@/features/tasks/hooks/useDailySnapshot';
import { SyncManager } from '@/features/tasks/components/SyncManager';
import { getLogicalDateISO } from '@/features/tasks/data/scheduleConfig';
import { useStreak } from '@/lib/streak/useStreak';
import {
  TasksErrorFallback,
  FinanceErrorFallback,
  CalendarErrorFallback,
  OkrErrorFallback,
} from '@/shared/components/FeatureErrorFallback';
import { useAuth } from '@/features/auth/useAuth';
import LoginPage from '@/features/auth/LoginPage';
import useOkrManager from '@/features/okr/hooks/useOkrManager';

// Lazy load feature pages
const DashboardPage = lazy(() => import('@/features/dashboard/components/DashboardPage'));
const TasksPage = lazy(() => import('@/features/tasks/components/TasksPage'));
const CalendarView = lazy(() =>
  import('@/features/calendar/CalendarPage').then((m) => ({ default: m.default }))
);
const FinancePage = lazy(() => import('@/features/finance/components/FinancePage'));
const OkrPage = lazy(() => import('@/features/okr/components/OkrPage'));

// ── AppContent — all hooks live here (no early returns allowed above hooks) ──
function AppContent({ logout }: { logout: () => void }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  // M-5: Lifted here so the selected month/day survive tab switches
  const [calCurrentDate, setCalCurrentDate] = useState(() => new Date());
  const [calSelectedDate, setCalSelectedDate] = useState(() => {
    const dayStartHour = Number(localStorage.getItem(LS_KEYS.DAY_START_HOUR) || '0');
    return getLogicalDateISO(dayStartHour);
  });
  const toasts = useToasts();
  const { onNewDay, onQuota, addSyncToast } = toasts;

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
  } = useSync(INITIAL_TASKS, onNewDay, onQuota, addSyncToast);

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

  const okrMgr = useOkrManager();
  const availableKeyResults = okrMgr.getActiveKRsForLinking();

  const { activeCycle, cycles, objectives, computeCycleProgress, isSyncing } = okrMgr;
  const okrSummary = activeCycle
    ? {
        cycleTitle: activeCycle.title,
        cycleProgress: computeCycleProgress(activeCycle.id),
        objectives: okrMgr.objectivesForCycle(activeCycle.id).map((o) => ({
          title: o.title,
          progress: okrMgr.computeObjectiveProgress(o.id),
        })),
      }
    : null;
  const activeCycleProgress = activeCycle ? computeCycleProgress(activeCycle.id) : null;

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
    okrSummary,
  });

  const { streak, setThreshold: setStreakThreshold } = useStreak(dayStartHour, schedule);

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
        <SyncManager snapshotImpl={snapshotImpl} okrSummary={okrSummary} />
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
            availableKeyResults={availableKeyResults}
            streak={streak}
            setStreakThreshold={setStreakThreshold}
          >
            <ErrorBoundary level="feature" fallback={<TasksErrorFallback />}>
              {activeTab === 'tasks' && (
                <TasksPage today={today} shift={shift} setShift={setShift} />
              )}
            </ErrorBoundary>

            <ErrorBoundary
              level="feature"
              fallback={
                <div style={{ padding: '20px', color: 'red' }}>حدث خطأ في تحميل الإحصائيات</div>
              }
            >
              {activeTab === 'dashboard' && (
                <DashboardPage streak={streak} okrSummary={okrSummary} />
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
                  okrCycles={isSyncing ? [] : cycles}
                  okrObjectives={isSyncing ? [] : objectives}
                  activeCycleProgress={activeCycleProgress}
                  setActiveTab={setActiveTab}
                />
              )}
            </ErrorBoundary>

            <TaskDialogs />
          </TaskProvider>

          <ErrorBoundary level="feature" fallback={<FinanceErrorFallback />}>
            {activeTab === 'finance' && <FinancePage syncStatus={syncStatus} />}
          </ErrorBoundary>

          <ErrorBoundary level="feature" fallback={<OkrErrorFallback />}>
            {activeTab === 'okr' && <OkrPage availableTasks={tasks} streak={streak} />}
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
