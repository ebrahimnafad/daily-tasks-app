import { useCallback } from 'react';
import useOkrSync from './useOkrSync';

const uuidv4 = () => crypto.randomUUID();

import type { OkrCycle, OkrObjective, OkrKeyResult, OkrCheckIn } from './useOkrSync';

export type { OkrCycle, OkrObjective, OkrKeyResult, OkrCheckIn };

// ── Quarter helpers ───────────────────────────────────────────────────────────

const ARABIC_QUARTERS = ['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'];

export function quarterLabel(startDate: string): string {
  const d = new Date(startDate + 'T12:00:00');
  const q = Math.floor(d.getMonth() / 3);
  return `${ARABIC_QUARTERS[q]} ${d.getFullYear()}`;
}

/** Returns the start and end dates of the current calendar quarter as YYYY-MM-DD. */
export function currentQuarterDates(): { startDate: string; endDate: string } {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const startMonth = q * 3;
  const start = new Date(now.getFullYear(), startMonth, 1);
  const end = new Date(now.getFullYear(), startMonth + 3, 0); // last day of quarter
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

// ── Manager hook ─────────────────────────────────────────────────────────────

export default function useOkrManager(
  onQuota?: () => void,
  notify?: (msg: string, type: 'offline' | 'error' | 'warn') => void
) {
  const sync = useOkrSync(onQuota, notify);
  const { cycles, objectives, keyResults, checkIns } = sync;

  // ── Derived state ──────────────────────────────────────────────────────────

  const activeCycle = cycles.find((c) => c.status === 'active' && !c.deletedAt) ?? null;

  const objectivesForCycle = useCallback(
    (cycleId: string): OkrObjective[] =>
      objectives
        .filter((o) => o.cycleId === cycleId && !o.deletedAt)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [objectives]
  );

  const keyResultsForObjective = useCallback(
    (objectiveId: string): OkrKeyResult[] =>
      keyResults
        .filter((kr) => kr.objectiveId === objectiveId && !kr.deletedAt)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [keyResults]
  );

  const checkInsForKR = useCallback(
    (keyResultId: string): OkrCheckIn[] =>
      checkIns
        .filter((ci) => ci.keyResultId === keyResultId)
        .sort((a, b) => {
          // Sort by date desc, then createdAt desc
          const dateComp = b.checkInDate.localeCompare(a.checkInDate);
          if (dateComp !== 0) return dateComp;
          return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
        }),
    [checkIns]
  );

  const computeObjectiveProgress = useCallback(
    (objectiveId: string): number => {
      const krs = keyResults.filter((kr) => kr.objectiveId === objectiveId && !kr.deletedAt);
      if (krs.length === 0) return 0;
      const total = krs.reduce((sum, kr) => {
        const current = Number(kr.currentValue);
        const target = Number(kr.targetValue);
        if (target <= 0) return sum;
        if (kr.type === 'binary') {
          return sum + (current >= 1 ? 100 : 0);
        }
        return sum + Math.min(100, (current / target) * 100);
      }, 0);
      return Math.round(total / krs.length);
    },
    [keyResults]
  );

  const computeCycleProgress = useCallback(
    (cycleId: string): number => {
      const objs = objectives.filter((o) => o.cycleId === cycleId && !o.deletedAt);
      if (objs.length === 0) return 0;
      const total = objs.reduce((sum, o) => sum + computeObjectiveProgress(o.id), 0);
      return Math.round(total / objs.length);
    },
    [objectives, computeObjectiveProgress]
  );

  const daysRemaining = useCallback((cycle: OkrCycle): number => {
    const end = new Date(cycle.endDate + 'T23:59:59');
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, []);

  const getActiveKRsForLinking = useCallback(() => {
    if (!activeCycle) return [];
    const activeObjs = objectivesForCycle(activeCycle.id);
    const result: Array<{ id: string; title: string; objectiveTitle: string }> = [];
    activeObjs.forEach((o) => {
      const krs = keyResultsForObjective(o.id);
      krs.forEach((kr) => {
        result.push({
          id: kr.id,
          title: kr.title,
          objectiveTitle: o.title,
        });
      });
    });
    return result;
  }, [activeCycle, objectivesForCycle, keyResultsForObjective]);

  // ── CRUD actions ───────────────────────────────────────────────────────────

  const guardSingleActiveCycle = useCallback(() => {
    const hasActive = cycles.some((c) => c.status === 'active' && !c.deletedAt);
    if (hasActive) {
      notify?.('لا يمكن تفعيل دورتين في نفس الوقت. أرشف الدورة النشطة أولاً', 'warn');
      return false;
    }
    return true;
  }, [cycles, notify]);

  const guardNoDateOverlap = useCallback(
    (startDate: string, endDate: string, excludeId?: string) => {
      const overlaps = cycles.some(
        (c) =>
          c.id !== excludeId &&
          !c.deletedAt &&
          c.status !== 'archived' &&
          startDate <= c.endDate &&
          endDate >= c.startDate
      );
      if (overlaps) {
        notify?.('التواريخ تتداخل مع دورة موجودة. اختر نطاقاً زمنياً مختلفاً', 'warn');
        return false;
      }
      return true;
    },
    [cycles, notify]
  );

  const createCycle = useCallback(
    (title: string, startDate: string, endDate: string) => {
      if (!guardSingleActiveCycle()) return;
      if (!guardNoDateOverlap(startDate, endDate)) return;

      const cycle: OkrCycle = {
        id: uuidv4(),
        title,
        startDate,
        endDate,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      sync.upsertCycle(cycle);
      return cycle;
    },
    [sync, guardSingleActiveCycle, guardNoDateOverlap]
  );

  const updateCycle = useCallback(
    (id: string, partial: Pick<OkrCycle, 'title' | 'startDate' | 'endDate'>) => {
      const existing = cycles.find((c) => c.id === id);
      if (!existing) return;
      if (!guardNoDateOverlap(partial.startDate, partial.endDate, id)) return;
      sync.upsertCycle({ ...existing, ...partial, updatedAt: new Date().toISOString() });
    },
    [cycles, sync, guardNoDateOverlap]
  );

  const deleteCycle = useCallback(
    (id: string) => {
      const existing = cycles.find((c) => c.id === id);
      if (!existing) return;
      // Soft delete cycle
      sync.upsertCycle({
        ...existing,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      // Soft delete all its objectives
      const cycleObjs = objectives.filter((o) => o.cycleId === id);
      cycleObjs.forEach((o) => {
        sync.upsertObjective({
          ...o,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });
    },
    [cycles, objectives, sync]
  );

  const reactivateCycle = useCallback(
    (id: string) => {
      if (!guardSingleActiveCycle()) return;
      const existing = cycles.find((c) => c.id === id);
      if (!existing) return;
      sync.upsertCycle({ ...existing, status: 'active', updatedAt: new Date().toISOString() });
    },
    [cycles, sync, guardSingleActiveCycle]
  );

  const duplicateCycle = useCallback(
    (sourceCycleId: string, newTitle: string, newStartDate: string, newEndDate: string) => {
      if (!guardSingleActiveCycle()) return null;
      if (!guardNoDateOverlap(newStartDate, newEndDate)) return null;

      const newCycleId = uuidv4();
      const cycle: OkrCycle = {
        id: newCycleId,
        title: newTitle,
        startDate: newStartDate,
        endDate: newEndDate,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      sync.upsertCycle(cycle);

      // Duplicate objectives and their KRs
      const sourceObjs = objectives.filter((o) => o.cycleId === sourceCycleId && !o.deletedAt);
      sourceObjs.forEach((o) => {
        const newObjId = uuidv4();
        sync.upsertObjective({
          ...o,
          id: newObjId,
          cycleId: newCycleId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        const sourceKrs = keyResults.filter((kr) => kr.objectiveId === o.id && !kr.deletedAt);
        sourceKrs.forEach((kr) => {
          sync.upsertKeyResult({
            ...kr,
            id: uuidv4(),
            objectiveId: newObjId,
            currentValue: '0', // Reset check-ins progress
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        });
      });

      return newCycleId;
    },
    [objectives, keyResults, sync, guardSingleActiveCycle, guardNoDateOverlap]
  );

  const archiveCycle = useCallback(
    (id: string) => {
      const existing = cycles.find((c) => c.id === id);
      if (!existing) return;
      sync.upsertCycle({ ...existing, status: 'archived', updatedAt: new Date().toISOString() });
    },
    [cycles, sync]
  );

  const createObjective = useCallback(
    (cycleId: string, title: string, icon: string, color: string) => {
      const cycleObjs = objectives.filter((o) => o.cycleId === cycleId && !o.deletedAt);
      const maxOrder = cycleObjs.reduce((m, o) => Math.max(m, o.sortOrder), -1);
      const obj: OkrObjective = {
        id: uuidv4(),
        cycleId,
        title,
        icon,
        color,
        sortOrder: maxOrder + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      sync.upsertObjective(obj);
      return obj;
    },
    [objectives, sync]
  );

  const updateObjective = useCallback(
    (id: string, partial: Partial<OkrObjective>) => {
      const existing = objectives.find((o) => o.id === id);
      if (!existing) return;
      sync.upsertObjective({ ...existing, ...partial, updatedAt: new Date().toISOString() });
    },
    [objectives, sync]
  );

  const deleteObjective = useCallback(
    (id: string) => {
      const existing = objectives.find((o) => o.id === id);
      if (!existing) return;
      sync.upsertObjective({
        ...existing,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
    [objectives, sync]
  );

  const createKeyResult = useCallback(
    (
      objectiveId: string,
      data: Omit<
        OkrKeyResult,
        'id' | 'objectiveId' | 'sortOrder' | 'currentValue' | 'createdAt' | 'updatedAt'
      >
    ) => {
      const objKRs = keyResults.filter((kr) => kr.objectiveId === objectiveId && !kr.deletedAt);
      const maxOrder = objKRs.reduce((m, kr) => Math.max(m, kr.sortOrder), -1);
      const kr: OkrKeyResult = {
        id: uuidv4(),
        objectiveId,
        currentValue: '0',
        sortOrder: maxOrder + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data,
      };
      sync.upsertKeyResult(kr);
      return kr;
    },
    [keyResults, sync]
  );

  const updateKeyResult = useCallback(
    (id: string, partial: Partial<OkrKeyResult>) => {
      const existing = keyResults.find((kr) => kr.id === id);
      if (!existing) return;
      sync.upsertKeyResult({ ...existing, ...partial, updatedAt: new Date().toISOString() });
    },
    [keyResults, sync]
  );

  const deleteKeyResult = useCallback(
    (id: string) => {
      const existing = keyResults.find((kr) => kr.id === id);
      if (!existing) return;
      sync.upsertKeyResult({
        ...existing,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
    [keyResults, sync]
  );

  const recordCheckIn = useCallback(
    (keyResultId: string, value: number, note?: string, source: 'manual' | 'task' = 'manual') => {
      const today = new Date().toISOString().slice(0, 10);
      const checkIn: OkrCheckIn = {
        id: uuidv4(),
        keyResultId,
        checkInDate: today,
        value: String(value),
        note: note ?? null,
        source,
        createdAt: new Date().toISOString(),
      };
      return sync.addCheckIn(checkIn);
    },
    [sync]
  );

  return {
    // Sync state
    cycles,
    objectives,
    keyResults,
    checkIns,
    isSyncing: sync.isSyncing,
    syncStatus: sync.syncStatus,

    // Derived
    activeCycle,
    objectivesForCycle,
    keyResultsForObjective,
    checkInsForKR,
    computeObjectiveProgress,
    computeCycleProgress,
    daysRemaining,
    quarterLabel,
    currentQuarterDates,
    getActiveKRsForLinking,

    // CRUD
    createCycle,
    updateCycle,
    deleteCycle,
    reactivateCycle,
    duplicateCycle,
    archiveCycle,
    createObjective,
    updateObjective,
    deleteObjective,
    createKeyResult,
    updateKeyResult,
    deleteKeyResult,
    recordCheckIn,
  };
}
