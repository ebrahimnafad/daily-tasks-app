import { useState, useEffect, useRef, useCallback } from 'react';
import { lsGet, lsSet } from '@/lib/storage/localStorage';
import { authFetch } from '@/features/auth/authFetch';
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
        id: `legacy-${date}`,
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

function initialLoad(onQuota?: () => void): CalendarNote[] {
  const existing = lsGet<CalendarNote[] | null>(LS_KEY, null);
  if (Array.isArray(existing) && existing.length > 0) return existing;
  // Try migration
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
}

function nanoid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export default function useNotesSync(onQuota?: () => void): UseNotesSyncReturn {
  const [notes, setNotesState] = useState<CalendarNote[]>(() => initialLoad(onQuota));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');

  const dbAvailable = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(false);

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
  const doSync = useCallback(async (currentNotes: CalendarNote[]) => {
    try {
      const res = await authFetch('/api/db?resource=notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: currentNotes }),
      });
      if (!res.ok) throw new Error('API error');
      setSyncStatus('synced');
    } catch {
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
    }
  }, []);

  const scheduleSync = useCallback(
    (currentNotes: CalendarNote[]) => {
      if (!dbAvailable.current) return;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      setSyncStatus('syncing');
      syncTimer.current = setTimeout(() => doSync(currentNotes), 1500);
    },
    [doSync]
  );

  const loadFromServer = useCallback(async () => {
    try {
      const res = await authFetch('/api/db?resource=notes', { cache: 'no-store' });
      if (!res.ok) {
        setSyncStatus('offline');
        return;
      }
      const data = (await res.json()) as { notes: CalendarNote[] | null; updatedAt: string | null };
      dbAvailable.current = true;

      const localTs = lsGet<string | null>(LS_TS_KEY, null);
      const localTime = localTs ? new Date(localTs).getTime() : 0;
      const dbTime = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;

      if (dbTime > localTime && Array.isArray(data.notes) && data.notes.length > 0) {
        setNotesState(data.notes);
        lsSet(LS_KEY, data.notes, onQuota);
        lsSet(LS_TS_KEY, data.updatedAt!, onQuota);
      }
      setSyncStatus('synced');
    } catch {
      setSyncStatus('offline');
    }
  }, [onQuota]);

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

  // Online retry
  useEffect(() => {
    const handle = () => {
      setSyncStatus('syncing');
      if (dbAvailable.current) {
        doSync(notes);
      } else {
        loadFromServer();
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

  return { notes, addNote, updateNote, deleteNote, togglePin, syncStatus };
}
