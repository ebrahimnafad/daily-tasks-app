import { useState, useEffect, useRef, useCallback } from 'react';
import { lsGet, lsSet } from '@/lib/storage/localStorage';
import { authFetch } from '@/features/auth/authFetch';
import { mergeArrays } from '@/lib/sync/reconcile';
import type { CalendarNote } from './types';

// ── Keys ──────────────────────────────────────────────────────────────────
const LS_KEY = 'mhm_calendar_notes_v2';
const LS_TS_KEY = 'mhm_calendar_notes_v2_ts';
const LEGACY_KEY = 'mhm_calendar_notes';

// ── Migration from old format Record<string,string> ───────────────────────
function migrateLegacy(onQuota?: () => void): CalendarNote[] {
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
      lsSet(LS_KEY, notes, onQuota);
      lsSet(LS_TS_KEY, now, onQuota);
      // Remove old key so migration runs once only
      localStorage.removeItem(LEGACY_KEY);
    }
    return notes;
  } catch {
    return [];
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function initialLoad(onQuota?: () => void): CalendarNote[] {
  const existing = lsGet<CalendarNote[] | null>(LS_KEY, null);
  if (Array.isArray(existing) && existing.length > 0) {
    // Migrate any legacy Math.random() or "legacy-date" IDs to valid UUIDs
    // to prevent Postgres from crashing with "invalid input syntax for type uuid"
    let mutated = false;
    const validated = existing.map((n) => {
      if (!UUID_REGEX.test(n.id)) {
        mutated = true;
        return { ...n, id: crypto.randomUUID() };
      }
      return n;
    });
    if (mutated) {
      lsSet(LS_KEY, validated, onQuota);
    }
    return validated;
  }
  // Try legacy migration
  return migrateLegacy(onQuota);
}

// ── Hook ─────────────────────────────────────────────────────────────────
export type SyncStatus = 'syncing' | 'synced' | 'offline' | 'error';

interface UseNotesSyncReturn {
  notes: CalendarNote[];
  addNote: (date: string, text: string, tags?: string[]) => CalendarNote;
  updateNote: (id: string, data: Partial<Omit<CalendarNote, 'id'>>) => void;
  deleteNote: (id: string) => void;
  togglePin: (id: string) => void;
  syncStatus: SyncStatus;
  /** Non-null when the last sync attempt failed. Contains Arabic message. */
  syncError: string | null;
  /** Manually re-trigger the sync after a failure. */
  retrySync: () => void;
}

function nanoid(): string {
  return crypto.randomUUID();
}

export default function useNotesSync(onQuota?: () => void): UseNotesSyncReturn {
  const [notes, setNotesState] = useState<CalendarNote[]>(() => initialLoad(onQuota));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');
  const [syncError, setSyncError] = useState<string | null>(null);

  const dbAvailable = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(false);
  /**
   * Tracks the last array successfully acknowledged by the server.
   * On failure we roll back notesState to this snapshot so the UI
   * never shows data that is only in the local state but not on the server.
   */
  const committedRef = useRef<CalendarNote[]>(notes);

  // ── Persist helper ────────────────────────────────────────────────────
  const persist = useCallback(
    (next: CalendarNote[]) => {
      lsSet(LS_KEY, next, onQuota);
      lsSet(LS_TS_KEY, new Date().toISOString(), onQuota);
    },
    [onQuota]
  );

  // ── Setters ───────────────────────────────────────────────────────────
  const addNote = useCallback(
    (date: string, text: string, tags: string[] = []): CalendarNote => {
      const now = new Date().toISOString();
      const note: CalendarNote = { id: nanoid(), date, text, tags, createdAt: now, updatedAt: now };
      setNotesState((prev) => {
        const next = [note, ...prev];
        persist(next);
        return next;
      });
      return note;
    },
    [persist]
  );

  const updateNote = useCallback(
    (id: string, data: Partial<Omit<CalendarNote, 'id'>>) => {
      setNotesState((prev) => {
        const next = prev.map((n) =>
          n.id === id ? { ...n, ...data, updatedAt: new Date().toISOString() } : n
        );
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const deleteNote = useCallback(
    (id: string) => {
      setNotesState((prev) => {
        const next = prev.filter((n) => n.id !== id);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const togglePin = useCallback(
    (id: string) => {
      setNotesState((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n));
        persist(next);
        return next;
      });
    },
    [persist]
  );

  // ── Cloud sync ────────────────────────────────────────────────────────
  const doSync = useCallback(
    async (currentNotes: CalendarNote[]) => {
      try {
        const res = await authFetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: currentNotes }),
        });
        if (!res.ok) {
          let errData;
          try {
            errData = await res.json();
          } catch (e) {
            /* ignore */
          }

          if (res.status === 409 || res.status === 410) {
            const serverData = errData?.serverData;
            const entityId = errData?.entityId;
            if (entityId) {
              setNotesState((prev) => {
                let next;
                if (res.status === 410) {
                  next = prev.filter((p) => String(p.id) !== String(entityId));
                } else if (serverData) {
                  next = prev.map((p) =>
                    String(p.id) === String(entityId) ? { ...p, ...serverData } : p
                  );
                } else {
                  next = prev;
                }
                persist(next);
                committedRef.current = next;
                return next;
              });

              setSyncError(
                res.status === 410
                  ? 'تم حذف ملاحظة لتزامن الحذف من جهاز آخر'
                  : 'تم استرجاع نسخة أحدث من ملاحظة'
              );
              return; // state update triggers retry
            }
          }
          throw new Error('API error');
        }
        // Success — advance the committed snapshot and clear any error
        committedRef.current = currentNotes;
        setSyncStatus('synced');
        setSyncError(null);
      } catch {
        const isOffline = !navigator.onLine;
        setSyncStatus(isOffline ? 'offline' : 'error');
        // Roll back UI to the last version the server acknowledged
        const rollbackTo = committedRef.current;
        setNotesState(rollbackTo);
        persist(rollbackTo);
        setSyncError(
          isOffline
            ? 'لا يوجد اتصال بالإنترنت — تم التراجع عن التغييرات الأخيرة. أعد المحاولة عند الاتصال.'
            : 'فشل حفظ الملاحظات على السيرفر — تم التراجع عن التغيير الأخير. اضغط "إعادة المحاولة" للمحاولة مجدداً.'
        );
      }
    },
    [persist]
  );

  const scheduleSync = useCallback(
    (currentNotes: CalendarNote[]) => {
      if (!dbAvailable.current) return;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      setSyncStatus('syncing');
      syncTimer.current = setTimeout(() => doSync(currentNotes), 1500);
    },
    [doSync]
  );

  const retrySync = useCallback(() => {
    if (!dbAvailable.current) return;
    setSyncError(null);
    setSyncStatus('syncing');
    void doSync(committedRef.current);
  }, [doSync]);

  const loadFromServer = useCallback(async () => {
    try {
      const res = await authFetch('/api/notes', { cache: 'no-store' });
      if (!res.ok) {
        setSyncStatus('offline');
        return;
      }
      const data = (await res.json()) as { notes: CalendarNote[] | null; updatedAt: string | null };
      dbAvailable.current = true;

      if (Array.isArray(data.notes)) {
        setNotesState((prevLocal) => {
          const merged = mergeArrays(prevLocal, data.notes as CalendarNote[]);
          persist(merged);
          committedRef.current = merged;
          return merged;
        });

        lsSet(LS_TS_KEY, data.updatedAt || new Date().toISOString(), onQuota);
      }
      setSyncStatus('synced');
      setSyncError(null);
    } catch {
      setSyncStatus('offline');
    }
  }, [onQuota, persist]);

  // Trigger sync whenever notes change (after mount)
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      loadFromServer();
      return;
    }
    scheduleSync(notes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  // Online retry — L-9: explicit void to mark intentional fire-and-forget
  useEffect(() => {
    const handle = () => {
      setSyncStatus('syncing');
      if (dbAvailable.current) {
        void doSync(notes);
      } else {
        void loadFromServer();
      }
    };
    window.addEventListener('online', handle);
    return () => window.removeEventListener('online', handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, doSync, loadFromServer]);

  // Cleanup
  useEffect(
    () => () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    },
    []
  );

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
