import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LS_KEYS } from '@/lib/storage/keys';
import { lsGet, lsSet } from '@/lib/storage/localStorage';
import { authFetch } from '@/features/auth/authFetch';
import { mergeArrays } from '@/lib/sync/reconcile';
import { enqueuePending, flushPendingType, isNetworkError } from '@/lib/sync/syncQueue';
import type { SyncStatus } from '@/types';

// ── Domain types ─────────────────────────────────────────────────────────────

export type OkrStatus = 'active' | 'archived' | 'draft';
export type KRType = 'numeric' | 'binary';
export type KRUnit = 'count' | 'percent' | 'currency' | 'custom';
export type CheckInSource = 'manual' | 'task';

export interface OkrCycle {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: OkrStatus;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface OkrObjective {
  id: string;
  cycleId: string;
  title: string;
  icon?: string | null;
  color?: string | null;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface OkrKeyResult {
  id: string;
  objectiveId: string;
  title: string;
  type: KRType;
  unit: KRUnit;
  customUnit?: string | null;
  /** Stored as a string from the DB (numeric column), use Number() when computing */
  targetValue: string;
  /** Denormalized; updated atomically on check-in insert. Read-only from the client. */
  currentValue: string;
  sortOrder: number;
  linkedTaskId?: string | null;
  linkedFinanceGoalId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface OkrCheckIn {
  id: string;
  keyResultId: string;
  checkInDate: string;
  /** Delta value (positive number as string from DB) */
  value: string;
  note?: string | null;
  source: CheckInSource;
  createdAt?: string;
}

export interface OkrData {
  cycles: OkrCycle[];
  objectives: OkrObjective[];
  keyResults: OkrKeyResult[];
  checkIns: OkrCheckIn[];
}

// ── Fetch function ────────────────────────────────────────────────────────────

export const fetchOkr = async (): Promise<{ data: OkrData; timestamp: number }> => {
  try {
    const since = lsGet<string | null>(LS_KEYS.OKR_TIMESTAMP, null);
    const url = since
      ? `/api/okr?resource=sync-all&since=${encodeURIComponent(since)}`
      : '/api/okr?resource=sync-all';

    const res = await authFetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Network error');
    const serverResp = await res.json();

    const localData: OkrData = {
      cycles: lsGet<OkrCycle[]>(LS_KEYS.OKR_CYCLES, []),
      objectives: lsGet<OkrObjective[]>(LS_KEYS.OKR_OBJECTIVES, []),
      keyResults: lsGet<OkrKeyResult[]>(LS_KEYS.OKR_KEY_RESULTS, []),
      checkIns: lsGet<OkrCheckIn[]>(LS_KEYS.OKR_CHECK_INS, []),
    };

    // Merge server data with local (check-ins are append-only: mergeArrays by id)
    const merged: OkrData = {
      cycles: mergeArrays(localData.cycles, serverResp.cycles ?? []),
      objectives: mergeArrays(localData.objectives, serverResp.objectives ?? []),
      keyResults: mergeArrays(localData.keyResults, serverResp.keyResults ?? []),
      // Check-ins are append-only — just union by id (mergeArrays handles dedup)
      checkIns: mergeArrays(localData.checkIns, serverResp.checkIns ?? []),
    };

    lsSet(LS_KEYS.OKR_CYCLES, merged.cycles);
    lsSet(LS_KEYS.OKR_OBJECTIVES, merged.objectives);
    lsSet(LS_KEYS.OKR_KEY_RESULTS, merged.keyResults);
    lsSet(LS_KEYS.OKR_CHECK_INS, merged.checkIns);
    // Record the sync time so subsequent fetches can use ?since= for incremental check-ins
    lsSet(LS_KEYS.OKR_TIMESTAMP, new Date().toISOString());

    return { data: merged, timestamp: Date.now() };
  } catch (err) {
    console.error('Fetch OKR failed, using local fallback:', err);
  }

  const localData: OkrData = {
    cycles: lsGet<OkrCycle[]>(LS_KEYS.OKR_CYCLES, []),
    objectives: lsGet<OkrObjective[]>(LS_KEYS.OKR_OBJECTIVES, []),
    keyResults: lsGet<OkrKeyResult[]>(LS_KEYS.OKR_KEY_RESULTS, []),
    checkIns: lsGet<OkrCheckIn[]>(LS_KEYS.OKR_CHECK_INS, []),
  };
  return { data: localData, timestamp: 0 };
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export default function useOkrSync(
  onQuota?: () => void,
  notify?: (msg: string, type: 'offline' | 'error' | 'warn') => void
) {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const [hasError, setHasError] = useState(false);
  const didMountRef = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Query ─────────────────────────────────────────────────────────────────
  const { data: okrResp, isFetching: fetchingOkr } = useQuery<{
    data: OkrData;
    timestamp: number;
  }>({
    queryKey: ['okr'],
    queryFn: fetchOkr,
    initialData: () => ({
      data: {
        cycles: lsGet<OkrCycle[]>(LS_KEYS.OKR_CYCLES, []),
        objectives: lsGet<OkrObjective[]>(LS_KEYS.OKR_OBJECTIVES, []),
        keyResults: lsGet<OkrKeyResult[]>(LS_KEYS.OKR_KEY_RESULTS, []),
        checkIns: lsGet<OkrCheckIn[]>(LS_KEYS.OKR_CHECK_INS, []),
      },
      timestamp: 0,
    }),
    initialDataUpdatedAt: 0,
    enabled: isOnline,
    retry: isOnline ? 3 : false,
  });

  const okrData: OkrData = okrResp?.data ?? {
    cycles: [],
    objectives: [],
    keyResults: [],
    checkIns: [],
  };

  // ── Mutation: upsert cycles/objectives/keyResults ─────────────────────────
  const { mutate: updateOkrMut, mutateAsync: updateOkrMutAsync } = useMutation<
    { ok: boolean },
    Error,
    OkrData,
    { prevData: { data: OkrData; timestamp: number } | undefined }
  >({
    mutationFn: async (newData) => {
      // Split into per-resource POSTs following the API design
      const postResource = async (resource: string, field: string, items: unknown[]) => {
        if (items.length === 0) return;
        const res = await authFetch(`/api/okr?resource=${resource}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: items }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const err: any = new Error(errData?.error || `OKR sync error ${res.status}`);
          err.status = res.status;
          throw err;
        }
      };

      await postResource('cycles', 'cycles', newData.cycles);
      await postResource('objectives', 'objectives', newData.objectives);
      await postResource('key-results', 'keyResults', newData.keyResults);

      return { ok: true };
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['okr'] });
      const prevData = queryClient.getQueryData<{ data: OkrData; timestamp: number }>(['okr']);
      queryClient.setQueryData(['okr'], { data: newData, timestamp: Date.now() });
      return { prevData };
    },
    onSuccess: () => setHasError(false),
    onError: async (err: Error & { status?: number }, variables, context) => {
      const isOfflineStatus = !navigator.onLine || isNetworkError(err);
      if (isOfflineStatus) {
        enqueuePending('okr', variables);
        notify?.('أنت غير متصل — تم حفظ أهدافك محلياً وستُزامَن عند اتصالك', 'offline');
        return;
      }
      if (context?.prevData) {
        queryClient.setQueryData(['okr'], context.prevData);
      }
      console.error('OKR sync error:', err);
      notify?.(`خطأ في مزامنة الأهداف: ${err.message}`, 'error');
      setHasError(true);
    },
  });

  // ── Mutation: addCheckIn (append-only) ────────────────────────────────────
  const { mutateAsync: addCheckInAsync } = useMutation<
    { ok: boolean },
    Error,
    OkrCheckIn,
    { prevData: { data: OkrData; timestamp: number } | undefined }
  >({
    mutationFn: async (checkIn) => {
      const res = await authFetch('/api/okr?resource=check-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkIns: [checkIn] }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || `Check-in sync error ${res.status}`);
      }
      return res.json();
    },
    onMutate: async (newCheckIn) => {
      await queryClient.cancelQueries({ queryKey: ['okr'] });
      const prevData = queryClient.getQueryData<{ data: OkrData; timestamp: number }>(['okr']);

      // Optimistic update: append check-in + increment currentValue on the KR
      queryClient.setQueryData<{ data: OkrData; timestamp: number }>(['okr'], (old) => {
        if (!old) return old;
        const updatedKeyResults = old.data.keyResults.map((kr) => {
          if (kr.id !== newCheckIn.keyResultId) return kr;
          const delta = Number(newCheckIn.value);
          return {
            ...kr,
            currentValue: String(Number(kr.currentValue) + delta),
            updatedAt: new Date().toISOString(),
          };
        });
        return {
          ...old,
          data: {
            ...old.data,
            checkIns: [...old.data.checkIns, newCheckIn],
            keyResults: updatedKeyResults,
          },
        };
      });

      // Persist optimistically to localStorage
      const current = queryClient.getQueryData<{ data: OkrData; timestamp: number }>(['okr']);
      if (current) {
        lsSet(LS_KEYS.OKR_CHECK_INS, current.data.checkIns, onQuota);
        lsSet(LS_KEYS.OKR_KEY_RESULTS, current.data.keyResults, onQuota);
      }

      return { prevData };
    },
    onSuccess: () => {
      setHasError(false);
      // Refresh key-results so currentValue stays in sync with the server's authoritative value
      void queryClient.invalidateQueries({ queryKey: ['okr'] });
    },
    onError: (err: Error, _variables, context) => {
      if (context?.prevData) {
        queryClient.setQueryData(['okr'], context.prevData);
      }
      const isOfflineStatus = !navigator.onLine || isNetworkError(err);
      if (isOfflineStatus) {
        notify?.('أنت غير متصل — لم يُسجَّل التقدم، يرجى المحاولة عند اتصالك', 'offline');
        return;
      }
      notify?.(`خطأ في تسجيل التقدم: ${err.message}`, 'error');
      setHasError(true);
    },
  });

  const addCheckIn = useCallback(
    (checkIn: OkrCheckIn) => addCheckInAsync(checkIn),
    [addCheckInAsync]
  );

  /**
   * deleteCheckIn is intentionally a no-op — check-ins are immutable append-only records.
   * Calling this will log a warning but take no action.
   */
  const deleteCheckIn = useCallback((id: string) => {
    console.warn(
      `[useOkrSync] deleteCheckIn("${id}") called, but check-ins are append-only and cannot be deleted.`
    );
  }, []);

  // ── Debounced upsert helpers ──────────────────────────────────────────────
  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const latest = queryClient.getQueryData<{ data: OkrData; timestamp: number }>(['okr'])?.data;
      if (latest) updateOkrMut(latest);
    }, 1500);
  }, [queryClient, updateOkrMut]);

  const upsertCycle = useCallback(
    (cycle: OkrCycle) => {
      queryClient.setQueryData<{ data: OkrData; timestamp: number }>(['okr'], (old) => {
        if (!old) return old;
        const exists = old.data.cycles.find((c) => c.id === cycle.id);
        const cycles = exists
          ? old.data.cycles.map((c) => (c.id === cycle.id ? { ...c, ...cycle } : c))
          : [...old.data.cycles, cycle];
        lsSet(LS_KEYS.OKR_CYCLES, cycles, onQuota);
        return { ...old, data: { ...old.data, cycles } };
      });
      scheduleSync();
    },
    [queryClient, scheduleSync, onQuota]
  );

  const upsertObjective = useCallback(
    (objective: OkrObjective) => {
      queryClient.setQueryData<{ data: OkrData; timestamp: number }>(['okr'], (old) => {
        if (!old) return old;
        const exists = old.data.objectives.find((o) => o.id === objective.id);
        const objectives = exists
          ? old.data.objectives.map((o) => (o.id === objective.id ? { ...o, ...objective } : o))
          : [...old.data.objectives, objective];
        lsSet(LS_KEYS.OKR_OBJECTIVES, objectives, onQuota);
        return { ...old, data: { ...old.data, objectives } };
      });
      scheduleSync();
    },
    [queryClient, scheduleSync, onQuota]
  );

  const upsertKeyResult = useCallback(
    (keyResult: OkrKeyResult) => {
      queryClient.setQueryData<{ data: OkrData; timestamp: number }>(['okr'], (old) => {
        if (!old) return old;
        const exists = old.data.keyResults.find((kr) => kr.id === keyResult.id);
        const keyResults = exists
          ? old.data.keyResults.map((kr) => (kr.id === keyResult.id ? { ...kr, ...keyResult } : kr))
          : [...old.data.keyResults, keyResult];
        lsSet(LS_KEYS.OKR_KEY_RESULTS, keyResults, onQuota);
        return { ...old, data: { ...old.data, keyResults } };
      });
      scheduleSync();
    },
    [queryClient, scheduleSync, onQuota]
  );

  // ── Online / offline handling ─────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setHasError(false);

      const items = flushPendingType('okr');
      if (items.length > 0) {
        const latest = items[items.length - 1].payload as OkrData;
        await updateOkrMutAsync(latest).catch(console.error);
      } else {
        if (didMountRef.current) {
          void queryClient.invalidateQueries({ queryKey: ['okr'] });
        }
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    didMountRef.current = true;

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queryClient, updateOkrMutAsync]);

  // Flush pending on unmount
  useEffect(() => {
    return () => {
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        const latest = queryClient.getQueryData<{ data: OkrData; timestamp: number }>([
          'okr',
        ])?.data;
        if (latest) enqueuePending('okr', latest);
      }
    };
  }, [queryClient]);

  const syncStatus: SyncStatus = !isOnline
    ? 'offline'
    : hasError
      ? 'error'
      : fetchingOkr
        ? 'syncing'
        : 'synced';

  return {
    cycles: okrData.cycles,
    objectives: okrData.objectives,
    keyResults: okrData.keyResults,
    checkIns: okrData.checkIns,
    upsertCycle,
    upsertObjective,
    upsertKeyResult,
    addCheckIn,
    /** No-op — check-ins are immutable append-only. Logs a warning. */
    deleteCheckIn,
    isSyncing: fetchingOkr,
    syncStatus,
  };
}
