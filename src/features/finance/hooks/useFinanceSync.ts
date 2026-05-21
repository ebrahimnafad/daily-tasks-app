import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { enqueuePending, flushPendingType, isNetworkError } from '@/lib/sync/syncQueue';

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

export interface FinanceData {
  income: Income[];
  categories: ExpenseCategory[];
  expenses: Expense[];
  transactions: Transaction[];
  goals: Goal[];
}

export const fetchFinance = async (): Promise<{ data: FinanceData; timestamp: number }> => {
  try {
    const res = await authFetch('/api/finance?resource=sync-all', { cache: 'no-store' });
    if (!res.ok) throw new Error('Network error');
    const serverResp = await res.json();
    const timestamp = serverResp.updatedAt ? new Date(serverResp.updatedAt).getTime() : 0;

    // Server data might not be completely formed if empty
    const serverData: FinanceData = {
      income: serverResp.income || [],
      categories: serverResp.categories || [],
      expenses: serverResp.expenses || [],
      transactions: serverResp.transactions || [],
      goals: serverResp.goals || [],
    };

    const localData: FinanceData = {
      income: lsGet(KEYS.income, []),
      categories: lsGet(KEYS.categories, DEFAULT_CATEGORIES),
      expenses: lsGet(KEYS.expenses, []),
      transactions: lsGet(KEYS.transactions, []),
      goals: lsGet(KEYS.goals, []),
    };

    const merged: FinanceData = {
      income: mergeArrays(localData.income, serverData.income),
      categories: mergeArrays(localData.categories, serverData.categories),
      expenses: mergeArrays(localData.expenses, serverData.expenses),
      transactions: mergeArrays(localData.transactions, serverData.transactions),
      goals: mergeArrays(localData.goals, serverData.goals),
    };

    lsSet(KEYS.income, merged.income);
    lsSet(KEYS.categories, merged.categories);
    lsSet(KEYS.expenses, merged.expenses);
    lsSet(KEYS.transactions, merged.transactions);
    lsSet(KEYS.goals, merged.goals);
    lsSet('mhm_fin2_timestamp', timestamp);

    return { data: merged, timestamp };
  } catch (err) {
    console.error('Fetch finance failed, using local fallback:', err);
  }

  const localData: FinanceData = {
    income: lsGet(KEYS.income, []),
    categories: lsGet(KEYS.categories, DEFAULT_CATEGORIES),
    expenses: lsGet(KEYS.expenses, []),
    transactions: lsGet(KEYS.transactions, []),
    goals: lsGet(KEYS.goals, []),
  };
  return { data: localData, timestamp: lsGet<number>('mhm_fin2_timestamp', 0) };
};

// ── Hook ────────────────────────────────────────────────────────────────────
export default function useFinanceSync(
  onQuota?: () => void,
  notify?: (msg: string, type: 'offline' | 'error' | 'warn') => void
) {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const [hasError, setHasError] = useState(false);
  const didMountRef = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      s.secondaryCurrencySymbol = 'ج.م';
      delete s.showExchangeRate;
    }
    if (!s.currencySymbol) s.currencySymbol = 'ر.س';
    return s as FinanceSettings;
  });

  const { data: financeResp, isFetching: fetchingFinance } = useQuery<{
    data: FinanceData;
    timestamp: number;
  }>({
    queryKey: ['finance'],
    queryFn: fetchFinance,
    initialData: () => {
      const localData: FinanceData = {
        income: lsGet(KEYS.income, []),
        categories: lsGet(KEYS.categories, DEFAULT_CATEGORIES),
        expenses: lsGet(KEYS.expenses, []),
        transactions: lsGet(KEYS.transactions, []),
        goals: lsGet(KEYS.goals, []),
      };
      return { data: localData, timestamp: lsGet<number>('mhm_fin2_timestamp', 0) };
    },
    initialDataUpdatedAt: 0,
    enabled: isOnline,
    retry: isOnline ? 3 : false,
  });

  const financeData = financeResp?.data ?? {
    income: [],
    categories: DEFAULT_CATEGORIES,
    expenses: [],
    transactions: [],
    goals: [],
  };

  const { mutate: updateFinanceMut, mutateAsync: updateFinanceMutAsync } = useMutation<
    { ok: boolean },
    Error,
    FinanceData,
    { prevData: { data: FinanceData; timestamp: number } | undefined }
  >({
    mutationFn: async (newData) => {
      const res = await authFetch('/api/finance?resource=sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData),
      });
      if (!res.ok) {
        let errData;
        try {
          errData = await res.json();
        } catch (e) {
          /* ignore */
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err: any = new Error(errData?.error || `Finance Sync API error ${res.status}`);
        err.status = res.status;
        err.serverData = errData?.serverData;
        err.entityId = errData?.entityId;
        err.resource = errData?.resource;
        throw err;
      }
      return res.json();
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['finance'] });
      const prevData = queryClient.getQueryData<{ data: FinanceData; timestamp: number }>([
        'finance',
      ]);
      queryClient.setQueryData(['finance'], { data: newData, timestamp: Date.now() });
      return { prevData };
    },
    onSuccess: () => {
      setHasError(false);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: async (err: any, variables, context) => {
      const isOfflineStatus = !navigator.onLine || isNetworkError(err);
      if (isOfflineStatus) {
        enqueuePending('finance', variables);
        notify?.('أنت غير متصل — تم حفظ بياناتك المالية محلياً وستُزامَن عند اتصالك', 'offline');
        return;
      }

      // Restore to previous data
      if (context?.prevData) {
        queryClient.setQueryData(['finance'], context.prevData);
        lsSet(KEYS.income, context.prevData.data.income);
        lsSet(KEYS.categories, context.prevData.data.categories);
        lsSet(KEYS.expenses, context.prevData.data.expenses);
        lsSet(KEYS.transactions, context.prevData.data.transactions);
        lsSet(KEYS.goals, context.prevData.data.goals);
      }

      if (err.status === 409 || err.status === 410) {
        const resNameMap: Record<string, string> = {
          income: 'الدخل',
          categories: 'الأقسام',
          expenses: 'المصروفات',
          transactions: 'المعاملات',
          goals: 'الأهداف',
        };
        const localizedRes = resNameMap[err.resource] || 'عنصر';

        notify?.(
          err.status === 410
            ? `تم حذف ${localizedRes} لتزامن الحذف من جهاز آخر. تم التراجع عن التغييرات الأخيرة.`
            : `تم تحديث ${localizedRes} بنسخة أحدث. تم التراجع عن التغييرات الأخيرة.`,
          'warn'
        );
        return;
      }

      console.error('Finance sync error:', err);
      notify?.(`خطأ في مزامنة المالية: ${err.message}`, 'error');
      setHasError(true);
    },
  });

  // Helper to create setters with debounced mutation
  const createSetter = useCallback(
    <K extends keyof FinanceData>(key: K) => {
      return (updater: SetterFn<FinanceData[K]>) => {
        const currentDataObj = queryClient.getQueryData<{ data: FinanceData; timestamp: number }>([
          'finance',
        ]);
        const currentData = currentDataObj?.data ?? {
          income: [],
          categories: DEFAULT_CATEGORIES,
          expenses: [],
          transactions: [],
          goals: [],
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nextValue =
          typeof updater === 'function' ? (updater as any)(currentData[key]) : updater;
        const nextData = { ...currentData, [key]: nextValue };

        // Optimistic local update synchronously
        queryClient.setQueryData(['finance'], { data: nextData, timestamp: Date.now() });
        lsSet(KEYS[key], nextValue, onQuota);

        if (syncTimer.current) clearTimeout(syncTimer.current);
        syncTimer.current = setTimeout(() => {
          const latestData = queryClient.getQueryData<{ data: FinanceData; timestamp: number }>([
            'finance',
          ])?.data;
          if (latestData) updateFinanceMut(latestData);
        }, 1500);
      };
    },
    [queryClient, updateFinanceMut, onQuota]
  );

  const setIncome = createSetter('income');
  const setCategories = createSetter('categories');
  const setExpenses = createSetter('expenses');
  const setTransactions = createSetter('transactions');
  const setGoals = createSetter('goals');

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

  // Online retry
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setHasError(false);

      const items = flushPendingType('finance');
      if (items.length > 0) {
        // Take the latest payload
        const latest = items[items.length - 1].payload as FinanceData;
        await updateFinanceMutAsync(latest).catch(console.error);
      } else {
        if (didMountRef.current) {
          void queryClient.invalidateQueries({ queryKey: ['finance'] });
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
  }, [queryClient, updateFinanceMutAsync]);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        // Flush pending changes to offline queue if unmounted before mutation
        const latestData = queryClient.getQueryData<{ data: FinanceData; timestamp: number }>([
          'finance',
        ])?.data;
        if (latestData) {
          enqueuePending('finance', latestData);
        }
      }
    };
  }, [queryClient]);

  const syncStatus = !isOnline
    ? 'offline'
    : hasError
      ? 'error'
      : fetchingFinance
        ? 'syncing'
        : 'synced';

  return {
    income: financeData.income,
    setIncome,
    categories: financeData.categories,
    setCategories,
    expenses: financeData.expenses,
    setExpenses,
    transactions: financeData.transactions,
    setTransactions,
    goals: financeData.goals,
    setGoals,
    settings,
    setSettings,
    syncStatus,
  };
}
