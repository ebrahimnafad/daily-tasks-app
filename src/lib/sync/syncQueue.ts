import { lsGet, lsSet } from '@/lib/storage/localStorage';
import { LS_KEYS } from '@/lib/storage/keys';
import { authFetch } from '@/features/auth/authFetch';
import type { DailySnapshot } from '@/types';

// ── Snapshot offline retry queue ────────────────────────────────────────────
export const SNAPSHOT_QUEUE_KEY = LS_KEYS.SNAPSHOT_QUEUE;
/** localStorage key — epoch ms of the last SUCCESSFUL manual saveSnapshot call.
 *  Read by the auto-snapshot path to prevent a stale tab from overwriting a
 *  correct manual snapshot (two-tab race guard). Shared across tabs via localStorage. */
export const LAST_MANUAL_SNAPSHOT_KEY = LS_KEYS.LAST_MANUAL_SNAPSHOT;
/** Grace window: if a manual snapshot was saved within this many ms, skip auto. */
export const MANUAL_SNAPSHOT_GRACE_MS = 5 * 60 * 1000; // 5 minutes

/** Persist a failed snapshot to the local retry queue (dedup by date). */
export const enqueueSnapshot = (snap: DailySnapshot): void => {
  const queue = lsGet<DailySnapshot[]>(SNAPSHOT_QUEUE_KEY, []);
  lsSet(SNAPSHOT_QUEUE_KEY, [...queue.filter((s) => s.date !== snap.date), snap]);
};

/**
 * Flush any locally-queued snapshots that failed to POST while offline.
 * Called when the browser regains connectivity. Each snapshot is retried once;
 * persistent failures stay in the queue for the next online event.
 */
export const flushSnapshotQueue = async (): Promise<void> => {
  const queue = lsGet<DailySnapshot[]>(SNAPSHOT_QUEUE_KEY, []);
  if (queue.length === 0) return;
  const remaining: DailySnapshot[] = [];
  for (const snap of queue) {
    try {
      const res = await authFetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: snap.date, snapshot: snap }),
      });
      if (!res.ok) remaining.push(snap); // server error — keep for next retry
    } catch {
      remaining.push(snap); // network error — keep for next retry
    }
  }
  lsSet(SNAPSHOT_QUEUE_KEY, remaining);
};

// ── Pending Sync offline queue (Phase 3) ────────────────────────────────────
export const PENDING_SYNC_KEY = LS_KEYS.PENDING_SYNC;

export type PendingItem = {
  type: 'tasks' | 'daily' | 'schedule' | 'finance' | 'notes' | 'okr';
  payload: unknown;
  queuedAt: number;
  entityId?: string | number;
};

export function enqueuePending(
  type: PendingItem['type'],
  payload: unknown,
  entityId?: string | number
): void {
  const queue: PendingItem[] = lsGet<PendingItem[]>(PENDING_SYNC_KEY, []) || [];
  // If entityId is provided, filter out only the previous mutation for this exact entity.
  // Otherwise, filter out all previous mutations of this type (legacy behavior).
  const filtered = entityId
    ? queue.filter((q) => !(q.type === type && q.entityId === entityId))
    : queue.filter((q) => q.type !== type);
  filtered.push({ type, payload, queuedAt: Date.now(), entityId });
  lsSet(PENDING_SYNC_KEY, filtered);
}

export function dequeuePendingEntity(type: PendingItem['type'], entityId: string | number): void {
  const queue: PendingItem[] = lsGet<PendingItem[]>(PENDING_SYNC_KEY, []) || [];
  const filtered = queue.filter((q) => !(q.type === type && q.entityId === entityId));
  lsSet(PENDING_SYNC_KEY, filtered);
}

export function flushPending(): PendingItem[] {
  const queue: PendingItem[] = lsGet<PendingItem[]>(PENDING_SYNC_KEY, []) || [];
  lsSet(PENDING_SYNC_KEY, []);
  return queue;
}

export function flushPendingType(type: PendingItem['type']): PendingItem[] {
  const queue: PendingItem[] = lsGet<PendingItem[]>(PENDING_SYNC_KEY, []) || [];
  const items = queue.filter((q) => q.type === type);
  const remaining = queue.filter((q) => q.type !== type);
  lsSet(PENDING_SYNC_KEY, remaining);
  return items;
}

export function hasStaleItems(queue: PendingItem[]): boolean {
  const ONE_HOUR = 60 * 60 * 1000;
  return queue.some((q) => Date.now() - q.queuedAt > ONE_HOUR);
}

export function isNetworkError(err: unknown): boolean {
  return (
    err instanceof TypeError &&
    (err.message.includes('fetch') ||
      err.message.includes('network') ||
      err.message.includes('Failed to fetch'))
  );
}
