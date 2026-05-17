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

// ── LocalStorage keys ───────────────────────────────────────────────────────
export const KEYS = {
  income: 'mhm_fin2_income',
  categories: 'mhm_fin2_categories',
  expenses: 'mhm_fin2_expenses',
  transactions: 'mhm_fin2_transactions',
  goals: 'mhm_fin2_goals',
  settings: 'mhm_fin2_settings',
  localTs: 'mhm_fin2_local_ts',
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
        lsSet(KEYS.localTs, new Date().toISOString(), onQuota);
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
        lsSet(KEYS.localTs, new Date().toISOString(), onQuota);
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
        lsSet(KEYS.localTs, new Date().toISOString(), onQuota);
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
        lsSet(KEYS.localTs, new Date().toISOString(), onQuota);
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
        lsSet(KEYS.localTs, new Date().toISOString(), onQuota);
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
        lsSet(KEYS.localTs, new Date().toISOString(), onQuota);
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
          fetch(`/api/finance/${r.key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [r.key]: r.data }),
          })
        )
      );
      if (results.some((r) => !r.ok)) throw new Error('API error');
      setSyncStatus('synced');
    } catch {
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
    }
  }, [income, categories, expenses, transactions, goals]);

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
        resources.map((r) => fetch(`/api/finance/${r}`, { cache: 'no-store' }))
      );
      if (responses.some((r) => !r.ok)) {
        setSyncStatus('offline');
        return;
      }

      const data = await Promise.all(responses.map((r) => r.json()));
      dbAvailable.current = true;

      const localTs = lsGet<string | null>(KEYS.localTs, null);
      const localTime = localTs ? new Date(localTs).getTime() : 0;
      const dbTimes = data.map((d) => (d.updatedAt ? new Date(d.updatedAt).getTime() : 0));
      const dbNewest = Math.max(...dbTimes);

      if (dbNewest > localTime) {
        const setters = [
          setIncomeState,
          setCategoriesState,
          setExpensesState,
          setTransactionsState,
          setGoalsState,
        ] as const;
        const keys = [KEYS.income, KEYS.categories, KEYS.expenses, KEYS.transactions, KEYS.goals];
        const fields = resources;

        fields.forEach((field, i) => {
          const arr = data[i]?.[field];
          if (Array.isArray(arr) && arr.length > 0) {
            (setters[i] as React.Dispatch<React.SetStateAction<unknown[]>>)(arr);
            lsSet(keys[i], arr, onQuota);
          }
        });
      }
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
