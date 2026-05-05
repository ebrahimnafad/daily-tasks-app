import { useState, useEffect, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, CheckedMap, SubCheckedMap, SyncStatus } from '@/types';

export const todayISO = (): string => new Date().toISOString().split('T')[0];

interface DailyState {
  checked: CheckedMap;
  subChecked: SubCheckedMap;
}

// ── localStorage helpers ──────────────────────────────────────────────────
function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — silent */
  }
}

// ── Fetchers ──────────────────────────────────────────────────────────────
const fetchTasks = async (): Promise<Task[]> => {
  const res = await fetch('/api/db?resource=tasks');
  if (!res.ok) throw new Error('Network error');
  const data = (await res.json()) as { tasks?: Task[] };
  if (data.tasks) {
    lsSet('mhm_tasks', data.tasks);
    return data.tasks;
  }
  return lsGet<Task[]>('mhm_tasks', []);
};

const fetchDaily = async (): Promise<DailyState> => {
  const today = todayISO();
  const res = await fetch(`/api/db?resource=daily&date=${today}`);
  if (!res.ok) throw new Error('Network error');
  const data = (await res.json()) as Partial<DailyState>;
  if (data.checked || data.subChecked) {
    const checked = data.checked ?? {};
    const subChecked = data.subChecked ?? {};
    lsSet('mhm_checked', checked);
    lsSet('mhm_sub_checked', subChecked);
    lsSet('mhm_date', today);
    return { checked, subChecked };
  }
  const savedDate = lsGet<string | null>('mhm_date', null);
  if (savedDate === today) {
    return {
      checked: lsGet<CheckedMap>('mhm_checked', {}),
      subChecked: lsGet<SubCheckedMap>('mhm_sub_checked', {}),
    };
  }
  return { checked: {}, subChecked: {} };
};

// ── Hook ──────────────────────────────────────────────────────────────────
export interface UseSyncReturn {
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  checked: CheckedMap;
  setChecked: Dispatch<SetStateAction<CheckedMap>>;
  subChecked: SubCheckedMap;
  setSubChecked: Dispatch<SetStateAction<SubCheckedMap>>;
  shift: string;
  setShift: (v: string) => void;
  syncStatus: SyncStatus;
}

export default function useSync(initialTasks: Task[], onNewDay?: () => void): UseSyncReturn {
  const queryClient = useQueryClient();

  const [shift, setShiftState] = useState<string>(() => lsGet('mhm_shift', 'morning'));
  const setShift = useCallback((v: string) => {
    setShiftState(v);
    lsSet('mhm_shift', v);
  }, []);

  const { data: tasks = initialTasks, isFetching: fetchingTasks } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
    initialData: () => lsGet<Task[]>('mhm_tasks', initialTasks),
  });

  const { data: daily = { checked: {}, subChecked: {} }, isFetching: fetchingDaily } =
    useQuery<DailyState>({
      queryKey: ['daily', todayISO()],
      queryFn: fetchDaily,
      initialData: () => {
        const savedDate = lsGet<string | null>('mhm_date', null);
        if (savedDate === todayISO()) {
          return {
            checked: lsGet<CheckedMap>('mhm_checked', {}),
            subChecked: lsGet<SubCheckedMap>('mhm_sub_checked', {}),
          };
        }
        return { checked: {}, subChecked: {} };
      },
    });

  const { checked, subChecked } = daily;

  // ── Mutations ─────────────────────────────────────────────────────────
  const { mutate: updateTasksMut } = useMutation<void, Error, Task[]>({
    mutationFn: async (newTasks) => {
      await fetch('/api/db?resource=tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: newTasks }),
      });
    },
    onMutate: async (newTasks) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const prevTasks = queryClient.getQueryData<Task[]>(['tasks']);
      queryClient.setQueryData(['tasks'], newTasks);
      lsSet('mhm_tasks', newTasks);
      return { prevTasks };
    },
    onError: (_err, _newTasks, context) => {
      const ctx = context as { prevTasks?: Task[] } | undefined;
      if (ctx?.prevTasks) {
        queryClient.setQueryData(['tasks'], ctx.prevTasks);
        lsSet('mhm_tasks', ctx.prevTasks);
      }
    },
  });

  const { mutate: updateDailyMut } = useMutation<void, Error, DailyState>({
    mutationFn: async ({ checked: c, subChecked: sc }) => {
      const today = todayISO();
      await fetch('/api/db?resource=daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, checked: c, subChecked: sc }),
      });
    },
    onMutate: async ({ checked: c, subChecked: sc }) => {
      const today = todayISO();
      await queryClient.cancelQueries({ queryKey: ['daily', today] });
      const prevDaily = queryClient.getQueryData<DailyState>(['daily', today]);
      queryClient.setQueryData(['daily', today], { checked: c, subChecked: sc });
      lsSet('mhm_checked', c);
      lsSet('mhm_sub_checked', sc);
      lsSet('mhm_date', today);
      return { prevDaily };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { prevDaily?: DailyState } | undefined;
      if (ctx?.prevDaily) {
        queryClient.setQueryData(['daily', todayISO()], ctx.prevDaily);
      }
    },
  });

  // ── Setters ───────────────────────────────────────────────────────────
  const setTasks = useCallback<Dispatch<SetStateAction<Task[]>>>(
    (updater) => {
      const current = queryClient.getQueryData<Task[]>(['tasks']) ?? initialTasks;
      const next = typeof updater === 'function' ? updater(current) : updater;
      updateTasksMut(next);
    },
    [queryClient, updateTasksMut, initialTasks]
  );

  const setChecked = useCallback<Dispatch<SetStateAction<CheckedMap>>>(
    (updater) => {
      const cur = queryClient.getQueryData<DailyState>(['daily', todayISO()]) ?? {
        checked: {},
        subChecked: {},
      };
      const next = typeof updater === 'function' ? updater(cur.checked) : updater;
      updateDailyMut({ checked: next, subChecked: cur.subChecked });
    },
    [queryClient, updateDailyMut]
  );

  const setSubChecked = useCallback<Dispatch<SetStateAction<SubCheckedMap>>>(
    (updater) => {
      const cur = queryClient.getQueryData<DailyState>(['daily', todayISO()]) ?? {
        checked: {},
        subChecked: {},
      };
      const next = typeof updater === 'function' ? updater(cur.subChecked) : updater;
      updateDailyMut({ checked: cur.checked, subChecked: next });
    },
    [queryClient, updateDailyMut]
  );

  // ── Midnight auto-reset ───────────────────────────────────────────────
  useEffect(() => {
    const checkDate = () => {
      const today = todayISO();
      const storedDate = lsGet<string | null>('mhm_date', null);
      if (storedDate && storedDate !== today) {
        queryClient.setQueryData(['daily', today], { checked: {}, subChecked: {} });
        lsSet('mhm_checked', {});
        lsSet('mhm_sub_checked', {});
        lsSet('mhm_date', today);
        onNewDay?.();
      }
    };
    const t = setInterval(checkDate, 60_000);
    return () => clearInterval(t);
  }, [onNewDay, queryClient]);

  const syncStatus: SyncStatus = fetchingTasks || fetchingDaily ? 'syncing' : 'synced';

  return {
    tasks,
    setTasks,
    checked,
    setChecked,
    subChecked,
    setSubChecked,
    shift,
    setShift,
    syncStatus,
  };
}
