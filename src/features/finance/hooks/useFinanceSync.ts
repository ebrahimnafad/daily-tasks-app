import { useState, useEffect, useRef, useCallback } from 'react';
import type { Income, Obligation, Payment, Goal } from '../types';

// ── LocalStorage keys ───────────────────────────────────────────────────────
const KEYS = {
  income: 'mhm_fin_income',
  obligations: 'mhm_fin_obligations',
  payments: 'mhm_fin_payments',
  goals: 'mhm_fin_goals',
  localTs: 'mhm_fin_local_ts',
};

function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: any, onQuota?: () => void) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e: any) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      onQuota?.();
    }
    return false;
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────
export default function useFinanceSync(onQuota?: () => void) {
  const [income, setIncomeState] = useState<Income[]>(() => lsGet(KEYS.income, []));
  const [obligations, setObligationsState] = useState<Obligation[]>(() =>
    lsGet(KEYS.obligations, [])
  );
  const [payments, setPaymentsState] = useState<Payment[]>(() => lsGet(KEYS.payments, []));
  const [goals, setGoalsState] = useState<Goal[]>(() => lsGet(KEYS.goals, []));
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'offline' | 'error'>(
    'offline'
  );

  const dbAvailable = useRef(false);
  const syncTimer = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(false);
  const pendingData = useRef<{
    income: Income[];
    obligations: Obligation[];
    payments: Payment[];
    goals: Goal[];
  } | null>(null);

  // ── Setters ─────────────────────────────────────────────────────────────
  const setIncome = useCallback(
    (v: Income[] | ((prev: Income[]) => Income[])) => {
      setIncomeState((prev) => {
        const next = typeof v === 'function' ? v(prev) : v;
        lsSet(KEYS.income, next, onQuota);
        lsSet(KEYS.localTs, new Date().toISOString(), onQuota);
        return next;
      });
    },
    [onQuota]
  );

  const setObligations = useCallback(
    (v: Obligation[] | ((prev: Obligation[]) => Obligation[])) => {
      setObligationsState((prev) => {
        const next = typeof v === 'function' ? v(prev) : v;
        lsSet(KEYS.obligations, next, onQuota);
        lsSet(KEYS.localTs, new Date().toISOString(), onQuota);
        return next;
      });
    },
    [onQuota]
  );

  const setPayments = useCallback(
    (v: Payment[] | ((prev: Payment[]) => Payment[])) => {
      setPaymentsState((prev) => {
        const next = typeof v === 'function' ? v(prev) : v;
        lsSet(KEYS.payments, next, onQuota);
        lsSet(KEYS.localTs, new Date().toISOString(), onQuota);
        return next;
      });
    },
    [onQuota]
  );

  const setGoals = useCallback(
    (v: Goal[] | ((prev: Goal[]) => Goal[])) => {
      setGoalsState((prev) => {
        const next = typeof v === 'function' ? v(prev) : v;
        lsSet(KEYS.goals, next, onQuota);
        lsSet(KEYS.localTs, new Date().toISOString(), onQuota);
        return next;
      });
    },
    [onQuota]
  );

  // ── دالة المزامنة ───────────────────────────────────────────────────────
  const doSync = useCallback(
    async (inc: Income[], obl: Obligation[], pay: Payment[], gls: Goal[]) => {
      try {
        const results = await Promise.all([
          fetch('/api/db?resource=income', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ income: inc }),
          }),
          fetch('/api/db?resource=obligations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ obligations: obl }),
          }),
          fetch('/api/db?resource=payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payments: pay }),
          }),
          fetch('/api/db?resource=goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goals: gls }),
          }),
        ]);
        if (results.some((r) => !r.ok)) throw new Error('API error');
        setSyncStatus('synced');
        pendingData.current = null;
      } catch {
        setSyncStatus('error');
        pendingData.current = { income: inc, obligations: obl, payments: pay, goals: gls };
      }
    },
    []
  );

  // ── Debounced Sync ──────────────────────────────────────────────────────
  const scheduleSync = useCallback(
    (inc: Income[], obl: Obligation[], pay: Payment[], gls: Goal[]) => {
      if (!dbAvailable.current) return;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      setSyncStatus('syncing');
      pendingData.current = { income: inc, obligations: obl, payments: pay, goals: gls };
      syncTimer.current = setTimeout(() => doSync(inc, obl, pay, gls), 1500);
    },
    [doSync]
  );

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    scheduleSync(income, obligations, payments, goals);
  }, [income, obligations, payments, goals, scheduleSync]);

  useEffect(() => {
    const load = async () => {
      try {
        const [incR, oblR, payR, glsR] = await Promise.all([
          fetch('/api/db?resource=income'),
          fetch('/api/db?resource=obligations'),
          fetch('/api/db?resource=payments'),
          fetch('/api/db?resource=goals'),
        ]);
        if (!incR.ok || !oblR.ok || !payR.ok || !glsR.ok) return;

        const [incD, oblD, payD, glsD] = await Promise.all([
          incR.json(),
          oblR.json(),
          payR.json(),
          glsR.json(),
        ]);
        dbAvailable.current = true;

        const localTs = lsGet<string | null>(KEYS.localTs, null);
        const localTime = localTs ? new Date(localTs).getTime() : 0;

        const dbTimes = [incD, oblD, payD, glsD].map((d) =>
          d.updatedAt ? new Date(d.updatedAt).getTime() : 0
        );
        const dbNewest = Math.max(...dbTimes);

        if (dbNewest > localTime) {
          if (incD.income?.length) {
            setIncomeState(incD.income);
            lsSet(KEYS.income, incD.income, onQuota);
          }
          if (oblD.obligations?.length) {
            setObligationsState(oblD.obligations);
            lsSet(KEYS.obligations, oblD.obligations, onQuota);
          }
          if (payD.payments?.length) {
            setPaymentsState(payD.payments);
            lsSet(KEYS.payments, payD.payments, onQuota);
          }
          if (glsD.goals?.length) {
            setGoalsState(glsD.goals);
            lsSet(KEYS.goals, glsD.goals, onQuota);
          }
        }
        setSyncStatus('synced');
      } catch {
        setSyncStatus('offline');
      }
    };
    load();
  }, []);

  useEffect(() => {
    const handle = () => {
      if (!pendingData.current || !dbAvailable.current) return;
      const { income: i, obligations: o, payments: p, goals: g } = pendingData.current;
      setSyncStatus('syncing');
      doSync(i, o, p, g);
    };
    window.addEventListener('online', handle);
    return () => window.removeEventListener('online', handle);
  }, [doSync]);

  useEffect(() => {
    const handle = () => {
      if (!pendingData.current || !dbAvailable.current) return;
      const { income: i, obligations: o, payments: p, goals: g } = pendingData.current;
      try {
        const blob = (d: any) => new Blob([JSON.stringify(d)], { type: 'application/json' });
        navigator.sendBeacon('/api/db?resource=income', blob({ income: i }));
        navigator.sendBeacon('/api/db?resource=obligations', blob({ obligations: o }));
        navigator.sendBeacon('/api/db?resource=payments', blob({ payments: p }));
        navigator.sendBeacon('/api/db?resource=goals', blob({ goals: g }));
      } catch (e) {
        console.warn('[useFinanceSync] sendBeacon failed:', e);
      }
    };
    window.addEventListener('beforeunload', handle);
    return () => window.removeEventListener('beforeunload', handle);
  }, []);

  useEffect(
    () => () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    },
    []
  );

  return {
    income,
    setIncome,
    obligations,
    setObligations,
    payments,
    setPayments,
    goals,
    setGoals,
    syncStatus,
  };
}
