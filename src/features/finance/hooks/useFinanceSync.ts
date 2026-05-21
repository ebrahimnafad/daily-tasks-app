import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  Income,
  Expense,
  ExpenseCategory,
  Transaction,
  Goal,
  FinanceSettings,
} from '../types';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '../constants';
import { lsGet, lsSet } from '@/lib/storage/localStorage';
import { authFetch } from '@/features/auth/authFetch';
import { mergeArrays } from '@/lib/sync/reconcile';

// ── LocalStorage keys ───────────────────────────────────────────────────────
export const KEYS = {
  income: 'mhm_fin2_income',
  categories: 'mhm_fin2_categories',
  expenses: 'mhm_fin2_expenses',
  transactions: 'mhm_fin2_transactions',
  goals: 'mhm_fin2_goals',
  settings: 'mhm_fin2_settings',
};

type SetterFn<T> = T | ((prev: T) => T);

// ── Hook ────────────────────────────────────────────────────────────────────
export default function useFinanceSync(onQuota?: () => void) {
  const [income, setIncomeState] = useState<Income[]>(() => lsGet(KEYS.income, []));
  const [categories, setCategoriesState] = useState<ExpenseCategory[]>(() =>
    lsGet(KEYS.categories, DEFAULT_CATEGORIES)
  );
  const [expenses, setExpensesState] = useState<Expense[]>(() => lsGet(KEYS.expenses, []));
  const [transactions, setTransactionsState] = useState<Transaction[]>(() =>
    lsGet(KEYS.transactions, [])
  );
  const [goals, setGoalsState] = useState<Goal[]>(() => lsGet(KEYS.goals, []));
  const [settings, setSettingsState] = useState<FinanceSettings>(() => {
    const s = lsGet(KEYS.settings, DEFAULT_SETTINGS) as FinanceSettings & Record<string, unknown>;
    // Migration from old settings
    if (s.currency) {
      if (s.currency === 'SAR') s.currencySymbol = 'ر.س';
      if (s.currency === 'EGP') s.currencySymbol = 'ج.م';
      delete s.currency;
    }
    if (s.showExchangeRate !== undefined) {
      s.showSecondaryCurrency = Boolean(s.showExchangeRate);
      s.secondaryCurrencySymbol = 'ج.م'; // Previous secondary was always EGP
      delete s.showExchangeRate;
    }
    if (!s.currencySymbol) s.currencySymbol = 'ر.س';
    return s as FinanceSettings;
  });
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'offline' | 'error'>(
    'syncing'
  );

  const dbAvailable = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(false);

  const setIncome = useCallback(
    (v: SetterFn<Income[]>) => {
      setIncomeState((prev) => {
        const next = typeof v === 'function' ? (v as (p: Income[]) => Income[])(prev) : v;
        lsSet(KEYS.income, next, onQuota);
        return next;
      });
    },
    [onQuota]
  );

  const setCategories = useCallback(
    (v: SetterFn<ExpenseCategory[]>) => {
      setCategoriesState((prev) => {
        const next =
          typeof v === 'function' ? (v as (p: ExpenseCategory[]) => ExpenseCategory[])(prev) : v;
        lsSet(KEYS.categories, next, onQuota);
        return next;
      });
    },
    [onQuota]
  );

  const setExpenses = useCallback(
    (v: SetterFn<Expense[]>) => {
      setExpensesState((prev) => {
        const next = typeof v === 'function' ? (v as (p: Expense[]) => Expense[])(prev) : v;
        lsSet(KEYS.expenses, next, onQuota);
        return next;
      });
    },
    [onQuota]
  );

  const setTransactions = useCallback(
    (v: SetterFn<Transaction[]>) => {
      setTransactionsState((prev) => {
        const next = typeof v === 'function' ? (v as (p: Transaction[]) => Transaction[])(prev) : v;
        lsSet(KEYS.transactions, next, onQuota);
        return next;
      });
    },
    [onQuota]
  );

  const setGoals = useCallback(
    (v: SetterFn<Goal[]>) => {
      setGoalsState((prev) => {
        const next = typeof v === 'function' ? (v as (p: Goal[]) => Goal[])(prev) : v;
        lsSet(KEYS.goals, next, onQuota);
        return next;
      });
    },
    [onQuota]
  );

  const setSettings = useCallback(
    (v: SetterFn<FinanceSettings>) => {
      setSettingsState((prev) => {
        const next =
          typeof v === 'function' ? (v as (p: FinanceSettings) => FinanceSettings)(prev) : v;
        lsSet(KEYS.settings, next, onQuota);
        return next;
      });
    },
    [onQuota]
  );

  // ── Cloud sync ─────────────────────────────────────────────────────────────
  const doSync = useCallback(async () => {
    try {
      const resources = [
        { key: 'income', data: income },
        { key: 'categories', data: categories },
        { key: 'expenses', data: expenses },
        { key: 'transactions', data: transactions },
        { key: 'goals', data: goals },
      ];
      const results = await Promise.all(
        resources.map((r) =>
          authFetch(`/api/finance?resource=${r.key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [r.key]: r.data }),
          })
        )
      );

      let needsRetry = false;
      for (let i = 0; i < results.length; i++) {
        const res = results[i];
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
            if (serverData && entityId) {
              const setter = [
                setIncomeState,
                setCategoriesState,
                setExpensesState,
                setTransactionsState,
                setGoalsState,
              ][i];
              const lsKey = [
                KEYS.income,
                KEYS.categories,
                KEYS.expenses,
                KEYS.transactions,
                KEYS.goals,
              ][i];

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (setter as React.Dispatch<React.SetStateAction<any[]>>)((prev) => {
                let next;
                if (res.status === 410) {
                  next = prev.filter((p) => String(p.id) !== String(entityId));
                } else {
                  next = prev.map((p) =>
                    String(p.id) === String(entityId) ? { ...p, ...serverData } : p
                  );
                }
                lsSet(lsKey, next, onQuota);
                return next;
              });
              needsRetry = true;
            }
          } else {
            throw new Error('API error');
          }
        }
      }

      if (needsRetry) {
        return; // State updates will trigger another sync
      }
      setSyncStatus('synced');
    } catch {
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
    }
  }, [income, categories, expenses, transactions, goals, onQuota]);

  const scheduleSync = useCallback(() => {
    if (!dbAvailable.current) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    setSyncStatus('syncing');
    syncTimer.current = setTimeout(doSync, 1500);
  }, [doSync]);

  // Load data from server (initial load + online retry)
  const loadFromServer = useCallback(async () => {
    try {
      const resources = ['income', 'categories', 'expenses', 'transactions', 'goals'];
      const responses = await Promise.all(
        resources.map((r) => authFetch(`/api/finance?resource=${r}`, { cache: 'no-store' }))
      );
      if (responses.some((r) => !r.ok)) {
        setSyncStatus('offline');
        return;
      }

      const data = await Promise.all(responses.map((r) => r.json()));
      dbAvailable.current = true;

      const setters = [
        setIncomeState,
        setCategoriesState,
        setExpensesState,
        setTransactionsState,
        setGoalsState,
      ] as const;
      const keys = [KEYS.income, KEYS.categories, KEYS.expenses, KEYS.transactions, KEYS.goals];

      resources.forEach((field, i) => {
        const serverArr = data[i]?.[field];
        if (Array.isArray(serverArr)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (setters[i] as React.Dispatch<React.SetStateAction<any[]>>)((prevLocalArr) => {
            const merged = mergeArrays(prevLocalArr, serverArr);
            lsSet(keys[i], merged, onQuota);
            return merged;
          });
        }
      });

      setSyncStatus('synced');
    } catch {
      setSyncStatus('offline');
    }
  }, [onQuota]);

  // Initial load from DB and trigger sync on changes
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      loadFromServer();
      return;
    }
    scheduleSync();
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [income, categories, expenses, transactions, goals, scheduleSync, loadFromServer]);

  // Online retry
  useEffect(() => {
    const handle = () => {
      setSyncStatus('syncing');
      if (dbAvailable.current) {
        doSync();
      } else {
        loadFromServer();
      }
    };
    window.addEventListener('online', handle);
    return () => window.removeEventListener('online', handle);
  }, [doSync, loadFromServer]);

  // Cleanup
  useEffect(
    () => () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    },
    []
  );

  return {
    income,
    setIncome,
    categories,
    setCategories,
    expenses,
    setExpenses,
    transactions,
    setTransactions,
    goals,
    setGoals,
    settings,
    setSettings,
    syncStatus,
  };
}
