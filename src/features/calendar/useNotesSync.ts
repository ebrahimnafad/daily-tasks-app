import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LS_KEYS } from '@/lib/storage/keys';
import { lsGet, lsSet } from '@/lib/storage/localStorage';
import { authFetch } from '@/features/auth/authFetch';
import { mergeArrays } from '@/lib/sync/reconcile';
import {
  enqueuePending,
  dequeuePendingEntity,
  flushPendingType,
  isNetworkError,
} from '@/lib/sync/syncQueue';
import type { CalendarNote } from './types';

// ── Keys ──────────────────────────────────────────────────────────────────
const LS_KEY = LS_KEYS.CALENDAR_NOTES_V2;
const LS_TS_KEY = LS_KEYS.CALENDAR_NOTES_V2_TS;
const LEGACY_KEY = LS_KEYS.CALENDAR_NOTES_LEGACY;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function migrateLegacy(): CalendarNote[] {
  try {
    const legacy = lsGet<Record<string, string> | null>(LEGACY_KEY, null);
    if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return [];
    const now = new Date().toISOString();
    const notes: CalendarNote[] = Object.entries(legacy)
      .filter(([, text]) => typeof text === 'string' && text.trim().length > 0)
      .map(([date, text]) => ({
        id: crypto.randomUUID(),
        date,
        text: text.trim(),
        createdAt: now,
        updatedAt: now,
        pinned: false,
      }));
    if (notes.length > 0) {
      lsSet(LS_KEY, notes);
      lsSet(LS_TS_KEY, now);
      localStorage.removeItem(LEGACY_KEY);
    }
    return notes;
  } catch {
    return [];
  }
}

function initialLoad(): CalendarNote[] {
  const existing = lsGet<CalendarNote[] | null>(LS_KEY, null);
  if (Array.isArray(existing) && existing.length > 0) {
    let mutated = false;
    const validated = existing.map((n) => {
      if (!UUID_REGEX.test(n.id)) {
        mutated = true;
        return { ...n, id: crypto.randomUUID() };
      }
      return n;
    });
    if (mutated) {
      lsSet(LS_KEY, validated);
    }
    return validated;
  }
  return migrateLegacy();
}

export type SyncStatus = 'syncing' | 'synced' | 'offline' | 'error';

interface UseNotesSyncReturn {
  notes: CalendarNote[];
  addNote: (date: string, text: string, tags?: string[]) => CalendarNote;
  updateNote: (id: string, data: Partial<Omit<CalendarNote, 'id'>>) => void;
  deleteNote: (id: string) => void;
  togglePin: (id: string) => void;
  syncStatus: SyncStatus;
  syncError: string | null;
  retrySync: () => void;
}

export const fetchNotes = async (): Promise<{ notes: CalendarNote[]; timestamp: number }> => {
  try {
    const res = await authFetch('/api/notes', { cache: 'no-store' });
    if (!res.ok) throw new Error('Network error');
    const data = (await res.json()) as { notes: CalendarNote[] | null; updatedAt: string | null };
    const timestamp = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;

    if (Array.isArray(data.notes)) {
      const serverNotes = data.notes;
      const localNotes = initialLoad();
      const merged = mergeArrays(localNotes, serverNotes);
      lsSet(LS_KEY, merged);
      lsSet(LS_TS_KEY, timestamp || new Date().toISOString());
      return { notes: merged, timestamp };
    }
  } catch (err) {
    console.error('Fetch notes failed, using local fallback:', err);
  }
  return {
    notes: initialLoad(),
    timestamp: new Date(lsGet<string>(LS_TS_KEY, new Date().toISOString())).getTime(),
  };
};

export default function useNotesSync(onQuota?: () => void): UseNotesSyncReturn {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const [syncError, setSyncError] = useState<string | null>(null);
  const didMountRef = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    (next: CalendarNote[]) => {
      lsSet(LS_KEY, next, onQuota);
      lsSet(LS_TS_KEY, new Date().toISOString(), onQuota);
    },
    [onQuota]
  );

  const { data: notesResp, isFetching: fetchingNotes } = useQuery<{
    notes: CalendarNote[];
    timestamp: number;
  }>({
    queryKey: ['notes'],
    queryFn: fetchNotes,
    initialData: () => {
      return {
        notes: initialLoad(),
        timestamp: new Date(lsGet<string>(LS_TS_KEY, new Date().toISOString())).getTime(),
      };
    },
    initialDataUpdatedAt: 0,
    enabled: isOnline,
    retry: isOnline ? 3 : false,
  });

  const notes = notesResp?.notes ?? [];

  const { mutate: updateNotesMut, mutateAsync: updateNotesMutAsync } = useMutation<
    { ok: boolean },
    Error,
    CalendarNote[],
    { prevData: { notes: CalendarNote[]; timestamp: number } | undefined }
  >({
    mutationFn: async (newNotes) => {
      const res = await authFetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: newNotes }),
      });
      if (!res.ok) {
        let errData;
        try {
          errData = await res.json();
        } catch {
          /* ignore */
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err: any = new Error(errData?.error || `Notes Sync API error ${res.status}`);
        err.status = res.status;
        err.serverData = errData?.serverData;
        err.entityId = errData?.entityId;
        throw err;
      }
      return res.json();
    },
    onMutate: async (newNotes) => {
      await queryClient.cancelQueries({ queryKey: ['notes'] });
      const prevData = queryClient.getQueryData<{ notes: CalendarNote[]; timestamp: number }>([
        'notes',
      ]);
      queryClient.setQueryData(['notes'], { notes: newNotes, timestamp: Date.now() });
      persist(newNotes);
      return { prevData };
    },
    onSuccess: () => {
      setSyncError(null);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: async (err: any, variables, context) => {
      const isOfflineStatus = !navigator.onLine || isNetworkError(err);
      if (isOfflineStatus) {
        enqueuePending('notes', variables);
        setSyncError('لا يوجد اتصال بالإنترنت — تم حفظ التغييرات محلياً.');
        return;
      }

      if (err.status === 409 || err.status === 410) {
        if (err.entityId) {
          dequeuePendingEntity('notes', err.entityId);
        }

        let updatedNotes: CalendarNote[] = [];
        queryClient.setQueryData<{ notes: CalendarNote[]; timestamp: number }>(['notes'], (old) => {
          if (!old) return old;
          updatedNotes = old.notes;
          if (err.status === 410) {
            updatedNotes = updatedNotes.filter((p) => String(p.id) !== String(err.entityId));
          } else if (err.status === 409 && err.serverData) {
            updatedNotes = updatedNotes.map((p) =>
              String(p.id) === String(err.entityId) ? { ...p, ...err.serverData } : p
            );
          }
          persist(updatedNotes);
          return { ...old, notes: updatedNotes };
        });

        if (updatedNotes.length > 0) {
          updateNotesMutAsync(updatedNotes).catch(() => {});
        }

        setSyncError(
          err.status === 410
            ? 'تم حذف ملاحظة لتزامن الحذف من جهاز آخر'
            : 'تم استرجاع نسخة أحدث من ملاحظة'
        );
        return;
      }

      console.error('Notes sync error:', err);
      setSyncError('فشل حفظ الملاحظات على السيرفر.');

      // Rollback to previous data
      if (context?.prevData) {
        queryClient.setQueryData(['notes'], context.prevData);
        persist(context.prevData.notes);
      }
    },
  });

  const triggerMutate = useCallback(
    (nextNotes: CalendarNote[]) => {
      // Optimistically update the cache right away
      queryClient.setQueryData(['notes'], { notes: nextNotes, timestamp: Date.now() });
      persist(nextNotes);

      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        const latestData = queryClient.getQueryData<{ notes: CalendarNote[]; timestamp: number }>([
          'notes',
        ])?.notes;
        if (latestData) updateNotesMut(latestData);
      }, 1500);
    },
    [queryClient, updateNotesMut, persist]
  );

  const addNote = useCallback(
    (date: string, text: string, tags: string[] = []): CalendarNote => {
      const now = new Date().toISOString();
      // Notes uses client-generated stable UUIDs, so no temporary ID reconciliation needed.
      const note: CalendarNote = {
        id: crypto.randomUUID(),
        date,
        text,
        tags,
        createdAt: now,
        updatedAt: now,
        pinned: false,
      };

      const currentNotes =
        queryClient.getQueryData<{ notes: CalendarNote[]; timestamp: number }>(['notes'])?.notes ??
        [];
      const nextNotes = [note, ...currentNotes];
      triggerMutate(nextNotes);
      return note;
    },
    [queryClient, triggerMutate]
  );

  const updateNote = useCallback(
    (id: string, data: Partial<Omit<CalendarNote, 'id'>>) => {
      const currentNotes =
        queryClient.getQueryData<{ notes: CalendarNote[]; timestamp: number }>(['notes'])?.notes ??
        [];
      const nextNotes = currentNotes.map((n) =>
        n.id === id ? { ...n, ...data, updatedAt: new Date().toISOString() } : n
      );
      triggerMutate(nextNotes);
    },
    [queryClient, triggerMutate]
  );

  const deleteNote = useCallback(
    (id: string) => {
      const currentNotes =
        queryClient.getQueryData<{ notes: CalendarNote[]; timestamp: number }>(['notes'])?.notes ??
        [];
      const nextNotes = currentNotes.filter((n) => n.id !== id);
      triggerMutate(nextNotes);
    },
    [queryClient, triggerMutate]
  );

  const togglePin = useCallback(
    (id: string) => {
      const currentNotes =
        queryClient.getQueryData<{ notes: CalendarNote[]; timestamp: number }>(['notes'])?.notes ??
        [];
      const nextNotes = currentNotes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n));
      triggerMutate(nextNotes);
    },
    [queryClient, triggerMutate]
  );

  const retrySync = useCallback(() => {
    setSyncError(null);
    const currentNotes =
      queryClient.getQueryData<{ notes: CalendarNote[]; timestamp: number }>(['notes'])?.notes ??
      [];
    updateNotesMut(currentNotes);
  }, [queryClient, updateNotesMut]);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setSyncError(null);

      const items = flushPendingType('notes');
      if (items.length > 0) {
        const latest = items[items.length - 1].payload as CalendarNote[];
        await updateNotesMutAsync(latest).catch(console.error);
      } else {
        if (didMountRef.current) {
          void queryClient.invalidateQueries({ queryKey: ['notes'] });
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
  }, [queryClient, updateNotesMutAsync]);

  useEffect(() => {
    return () => {
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        // Flush pending changes to offline queue if unmounted before mutation
        const latestData = queryClient.getQueryData<{ notes: CalendarNote[]; timestamp: number }>([
          'notes',
        ])?.notes;
        if (latestData) {
          enqueuePending('notes', latestData);
        }
      }
    };
  }, [queryClient]);

  const syncStatus: SyncStatus = !isOnline
    ? 'offline'
    : syncError
      ? 'error'
      : fetchingNotes
        ? 'syncing'
        : 'synced';

  return {
    notes,
    addNote,
    updateNote,
    deleteNote,
    togglePin,
    syncStatus,
    syncError,
    retrySync,
  };
}
