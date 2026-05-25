import { useCallback, useRef, useEffect } from 'react';
import { LS_KEYS } from '@/lib/storage/keys';
import type { Dispatch, SetStateAction } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CheckedMap, SubCheckedMap, DailySnapshot } from '@/types';
import { lsGet, lsSet } from '@/lib/storage/localStorage';
import { authFetch } from '@/features/auth/authFetch';
import { getLogicalDateISO } from '@/features/tasks/data/scheduleConfig';
import {
  enqueuePending,
  enqueueSnapshot,
  isNetworkError,
  LAST_MANUAL_SNAPSHOT_KEY,
} from './syncQueue';

export interface DailyState {
  checked: CheckedMap;
  subChecked: SubCheckedMap;
  skipped: CheckedMap;
}

export interface DailyResponse {
  checked: CheckedMap;
  subChecked: SubCheckedMap;
  skipped?: CheckedMap;
  updatedAt: string | null;
}

export const fetchDaily = async (
  dayStartHour: number
): Promise<{ daily: DailyState; timestamp: number }> => {
  const today = getLogicalDateISO(dayStartHour);
  try {
    const res = await authFetch(`/api/daily?date=${today}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Network error');
    const data = (await res.json()) as DailyResponse;
    const timestamp = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
    if (data.checked || data.subChecked || data.skipped) {
      const checked = data.checked ?? {};
      const subChecked = data.subChecked ?? {};
      const skipped = data.skipped ?? {};
      lsSet(LS_KEYS.CHECKED, checked);
      lsSet(LS_KEYS.SUB_CHECKED, subChecked);
      lsSet(LS_KEYS.SKIPPED, skipped);
      lsSet(LS_KEYS.DATE, today);
      lsSet(LS_KEYS.DAILY_TIMESTAMP, timestamp);
      return { daily: { checked, subChecked, skipped }, timestamp };
    }
  } catch (err) {
    console.error('Fetch daily failed, using local fallback:', err);
  }
  const savedDate = lsGet<string | null>(LS_KEYS.DATE, null);
  if (savedDate === today) {
    return {
      daily: {
        checked: lsGet<CheckedMap>(LS_KEYS.CHECKED, {}),
        subChecked: lsGet<SubCheckedMap>(LS_KEYS.SUB_CHECKED, {}),
        skipped: lsGet<CheckedMap>(LS_KEYS.SKIPPED, {}),
      },
      timestamp: lsGet<number>(LS_KEYS.DAILY_TIMESTAMP, 0),
    };
  }
  return { daily: { checked: {}, subChecked: {}, skipped: {} }, timestamp: 0 };
};

export interface UseDailySyncProps {
  dayStartHour: number;
  isOnline: boolean;
  onQuota?: () => void;
  notify: (msg: string, type: 'offline' | 'error' | 'warn') => void;
  setHasError: (val: boolean) => void;
}

export function useDailySync({
  dayStartHour,
  isOnline,
  onQuota,
  notify,
  setHasError,
}: UseDailySyncProps) {
  const queryClient = useQueryClient();
  const pendingDailyRef = useRef<DailyState | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: dailyResp, isFetching: fetchingDaily } = useQuery<{
    daily: DailyState;
    timestamp: number;
  }>({
    queryKey: ['daily', getLogicalDateISO(dayStartHour)],
    queryFn: () => fetchDaily(dayStartHour),
    initialData: () => {
      const savedDate = lsGet<string | null>(LS_KEYS.DATE, null);
      if (savedDate === getLogicalDateISO(dayStartHour)) {
        return {
          daily: {
            checked: lsGet<CheckedMap>(LS_KEYS.CHECKED, {}),
            subChecked: lsGet<SubCheckedMap>(LS_KEYS.SUB_CHECKED, {}),
            skipped: lsGet<CheckedMap>(LS_KEYS.SKIPPED, {}),
          },
          timestamp: 0,
        };
      }
      return { daily: { checked: {}, subChecked: {}, skipped: {} }, timestamp: 0 };
    },
    initialDataUpdatedAt: 0,
    enabled: isOnline,
    retry: isOnline ? 3 : false,
  });

  const { checked, subChecked, skipped } = dailyResp?.daily ?? {
    checked: {},
    subChecked: {},
    skipped: {},
  };

  const { mutate: updateDailyMut, mutateAsync: updateDailyMutAsync } = useMutation<
    void,
    Error,
    DailyState
  >({
    mutationFn: async ({ checked: c, subChecked: sc, skipped: sk }) => {
      const today = getLogicalDateISO(dayStartHour);
      const res = await authFetch('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, checked: c, subChecked: sc, skipped: sk }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Daily Sync API error ${res.status}: ${text}`);
      }
    },
    onMutate: async ({ checked: c, subChecked: sc, skipped: sk }) => {
      const today = getLogicalDateISO(dayStartHour);
      await queryClient.cancelQueries({ queryKey: ['daily', today] });
      const prevDaily = queryClient.getQueryData<{ daily: DailyState; timestamp: number }>([
        'daily',
        today,
      ]);
      queryClient.setQueryData(['daily', today], {
        daily: { checked: c, subChecked: sc, skipped: sk },
        timestamp: Date.now(),
      });
      lsSet(LS_KEYS.CHECKED, c, onQuota);
      lsSet(LS_KEYS.SUB_CHECKED, sc, onQuota);
      lsSet(LS_KEYS.SKIPPED, sk, onQuota);
      lsSet(LS_KEYS.DATE, today, onQuota);
      return { prevDaily };
    },
    onSuccess: () => setHasError(false),
    onError: async (err, variables) => {
      const isOfflineStatus = !navigator.onLine || isNetworkError(err);
      if (isOfflineStatus) {
        enqueuePending('daily', variables);
        notify('أنت غير متصل — تم حفظ الحالة اليومية محلياً وستُزامَن عند اتصالك', 'offline');
        return;
      }
      console.error('Daily sync error:', err);
      notify(`خطأ في مزامنة الحالة اليومية: ${err.message}`, 'error');
      setHasError(true);
      await queryClient.invalidateQueries({ queryKey: ['daily', getLogicalDateISO(dayStartHour)] });
    },
  });

  const setDaily = useCallback(
    (updater: ((prev: DailyState) => DailyState) | DailyState) => {
      const cached = queryClient.getQueryData<{ daily: DailyState; timestamp: number }>([
        'daily',
        getLogicalDateISO(dayStartHour),
      ])?.daily ?? { checked: {}, subChecked: {}, skipped: {} };
      const prev = pendingDailyRef.current ?? cached;
      const next = typeof updater === 'function' ? updater(prev) : updater;
      pendingDailyRef.current = next;

      // Persist to localStorage immediately for offline resilience
      const today = getLogicalDateISO(dayStartHour);
      lsSet(LS_KEYS.CHECKED, next.checked, onQuota);
      lsSet(LS_KEYS.SUB_CHECKED, next.subChecked, onQuota);
      lsSet(LS_KEYS.SKIPPED, next.skipped, onQuota);
      lsSet(LS_KEYS.DATE, today, onQuota);

      // Coalesce all synchronous calls into a single mutation
      if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => {
        const payload = pendingDailyRef.current;
        if (payload === null) return;
        pendingDailyRef.current = null;
        flushTimerRef.current = null;
        updateDailyMut(payload);
      }, 0);
    },
    [queryClient, dayStartHour, onQuota, updateDailyMut]
  );

  useEffect(
    () => () => {
      if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current);
    },
    []
  );

  const setChecked = useCallback<Dispatch<SetStateAction<CheckedMap>>>(
    (updater) =>
      setDaily((prev) => ({
        ...prev,
        checked: typeof updater === 'function' ? updater(prev.checked) : updater,
      })),
    [setDaily]
  );

  const setSubChecked = useCallback<Dispatch<SetStateAction<SubCheckedMap>>>(
    (updater) =>
      setDaily((prev) => ({
        ...prev,
        subChecked: typeof updater === 'function' ? updater(prev.subChecked) : updater,
      })),
    [setDaily]
  );

  const setSkipped = useCallback<Dispatch<SetStateAction<CheckedMap>>>(
    (updater) =>
      setDaily((prev) => ({
        ...prev,
        skipped: typeof updater === 'function' ? updater(prev.skipped) : updater,
      })),
    [setDaily]
  );

  const saveSnapshot = useCallback(async (data: DailySnapshot): Promise<void> => {
    try {
      const res = await authFetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: data.date, snapshot: data }),
      });
      if (!res.ok) {
        console.warn('Snapshot save failed:', res.status, '— queuing for retry');
        enqueueSnapshot(data);
      } else {
        // Mark successful manual save so other tabs skip their auto-snapshot
        lsSet(LAST_MANUAL_SNAPSHOT_KEY, Date.now());
      }
    } catch (err) {
      console.warn('Snapshot save error — queuing for retry (offline?):', err);
      enqueueSnapshot(data);
    }
  }, []);

  return {
    dailyResp,
    checked,
    setChecked,
    subChecked,
    setSubChecked,
    skipped,
    setSkipped,
    fetchingDaily,
    updateDailyMut,
    updateDailyMutAsync,
    saveSnapshot,
  };
}
