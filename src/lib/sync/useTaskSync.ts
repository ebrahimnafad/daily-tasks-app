import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task } from '@/types';
import { lsGet, lsSet } from '@/lib/storage/localStorage';
import { authFetch } from '@/features/auth/authFetch';
import { LEGACY_TIME_TO_BLOCK } from '@/features/tasks/data/scheduleConfig';
import { enqueuePending, isNetworkError } from './syncQueue';

export interface TasksResponse {
  tasks: Task[];
  updatedAt: string | null;
}

export const migrateTasks = (tasks: Task[]): Task[] =>
  tasks.map((t) => ({
    ...t,
    shifts: t.shifts ?? ['morning', 'evening'],
    timeBlock: t.timeBlock ?? (t.time ? (LEGACY_TIME_TO_BLOCK[t.time] ?? 'anytime') : 'anytime'),
  }));

export const fetchTasks = async (): Promise<{ tasks: Task[]; timestamp: number }> => {
  try {
    const res = await authFetch('/api/tasks', { cache: 'no-store' });
    if (!res.ok) throw new Error('Network error');
    const data = (await res.json()) as TasksResponse;
    const timestamp = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
    if (data.tasks) {
      const migrated = migrateTasks(data.tasks);
      lsSet('mhm_tasks', migrated);
      lsSet('mhm_tasks_timestamp', timestamp);
      return { tasks: migrated, timestamp };
    }
  } catch (err) {
    console.error('Fetch tasks failed, using local fallback:', err);
  }
  const localTasks = migrateTasks(lsGet<Task[]>('mhm_tasks', []));
  return { tasks: localTasks, timestamp: lsGet<number>('mhm_tasks_timestamp', 0) };
};

export interface UseTaskSyncProps {
  initialTasks: Task[];
  isOnline: boolean;
  onQuota?: () => void;
  notify: (msg: string, type: 'offline' | 'error' | 'warn') => void;
  setHasError: (val: boolean) => void;
}

export function useTaskSync({
  initialTasks,
  isOnline,
  onQuota,
  notify,
  setHasError,
}: UseTaskSyncProps) {
  const queryClient = useQueryClient();

  const { data: tasksResp, isFetching: fetchingTasks } = useQuery<{
    tasks: Task[];
    timestamp: number;
  }>({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
    initialData: () => {
      const local = lsGet<Task[]>('mhm_tasks', []);
      const localMigrated = local.length > 0 ? migrateTasks(local) : initialTasks;
      return { tasks: localMigrated, timestamp: lsGet<number>('mhm_tasks_timestamp', 0) };
    },
    initialDataUpdatedAt: 0,
    enabled: isOnline,
    retry: isOnline ? 3 : false,
  });

  const tasks = tasksResp?.tasks ?? initialTasks;

  const { mutate: updateTasksMut, mutateAsync: updateTasksMutAsync } = useMutation<
    { tasks?: Task[] },
    Error,
    Task[]
  >({
    mutationFn: async (newTasks) => {
      const res = await authFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: newTasks }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Tasks Sync API error ${res.status}: ${text}`);
      }
      return res.json();
    },
    onMutate: async (newTasks) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const prevTasks = queryClient.getQueryData<{ tasks: Task[]; timestamp: number }>(['tasks']);
      queryClient.setQueryData(['tasks'], { tasks: newTasks, timestamp: Date.now() });
      lsSet('mhm_tasks', newTasks, onQuota);
      return { prevTasks };
    },
    onSuccess: (response) => {
      if (response && response.tasks) {
        // Server is ground truth. Replace optimistic state entirely with DB-assigned IDs.
        queryClient.setQueryData(['tasks'], { tasks: response.tasks, timestamp: Date.now() });
        lsSet('mhm_tasks', response.tasks);
      }
      setHasError(false);
    },
    onError: async (err, variables) => {
      const isOfflineStatus = !navigator.onLine || isNetworkError(err);
      if (isOfflineStatus) {
        enqueuePending('tasks', variables);
        notify('أنت غير متصل — تم حفظ المهام محلياً وستُزامَن عند اتصالك', 'offline');
        return;
      }
      console.error('Tasks sync error:', err);
      notify(`خطأ في مزامنة المهام: ${err.message}`, 'error');
      setHasError(true);
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const setTasks = useCallback<Dispatch<SetStateAction<Task[]>>>(
    (updater) => {
      const current =
        queryClient.getQueryData<{ tasks: Task[]; timestamp: number }>(['tasks'])?.tasks ??
        initialTasks;
      const next = typeof updater === 'function' ? updater(current) : updater;
      updateTasksMut(next);
    },
    [queryClient, updateTasksMut, initialTasks]
  );

  return {
    tasksResp,
    tasks,
    setTasks,
    fetchingTasks,
    updateTasksMut,
    updateTasksMutAsync,
  };
}
