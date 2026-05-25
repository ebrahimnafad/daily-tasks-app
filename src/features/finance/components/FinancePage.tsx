import { useState, useCallback, useMemo } from 'react';
import useFinanceSync from '../hooks/useFinanceSync';
import FinanceDashboard from './FinanceDashboard';
import IncomeSection from './IncomeSection';
import CategorySection from './CategorySection';
import GoalsSection from './GoalsSection';
import AnnualView from './AnnualView';
import QuarterlyView from './QuarterlyView';
import FinanceInsights from './FinanceInsights';
import ExpenseModal from './ExpenseModal';
import CategoryModal from './CategoryModal';
import TransactionDrawer from './TransactionDrawer';
import type { SyncStatus } from '@/types';
import { getSyncBadgeInfo } from '@/lib/sync/syncBadge';
import './FinancePage.css';

import type {
  Expense,
  ExpenseCategory,
  Transaction,
  FinanceView,
  ExpenseModalState,
  CategoryModalState,
  TransactionDrawerState,
  FinanceSettings,
} from '../types';

import {
  calcMonthlySummary,
  getCurrentMonth,
  shiftMonth,
  formatMonthLabel,
  getCurrentQuarter,
  shiftQuarter,
} from '../utils';

interface FinancePageProps {
  syncStatus: SyncStatus;
}

export default function FinancePage({ syncStatus }: FinancePageProps) {
  const {
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
  } = useFinanceSync();

  const [view, setView] = useState<FinanceView>('monthly');
  const [viewMonth, setViewMonth] = useState(getCurrentMonth);
  const [viewQuarter, setViewQuarter] = useState(getCurrentQuarter);
  const [expModal, setExpModal] = useState<ExpenseModalState | null>(null);
  const [catModal, setCatModal] = useState<CategoryModalState | null>(null);
  const [txDrawer, setTxDrawer] = useState<TransactionDrawerState | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // ── Summary calculations ─────────────────────────────────────────────────
  const summary = useMemo(
    () => calcMonthlySummary(income, categories, expenses, transactions, goals, viewMonth),
    [income, categories, expenses, transactions, goals, viewMonth]
  );

  const monthLabel = formatMonthLabel(viewMonth);
  const currentYear = Number(viewMonth.slice(0, 4));

  // ── Expense CRUD ──────────────────────────────────────────────────────────
  const openAddExpense = useCallback((categoryId: string) => {
    setExpModal({ mode: 'add', categoryId });
  }, []);

  const openEditExpense = useCallback((exp: Expense) => {
    setExpModal({ mode: 'edit', categoryId: exp.categoryId, data: exp });
  }, []);

  const saveExpense = useCallback(
    (data: Partial<Expense>, mode: 'add' | 'edit', id?: string) => {
      if (mode === 'add') {
        setExpenses((prev) => [...prev, { id: crypto.randomUUID(), ...data } as Expense]);
      } else {
        setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)));
      }
      setExpModal(null);
    },
    [setExpenses]
  );

  const deleteExpense = useCallback(
    (id: string) => {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      setTransactions((prev) => prev.filter((t) => t.expenseId !== id));
    },
    [setExpenses, setTransactions]
  );

  // ── Category CRUD ─────────────────────────────────────────────────────────
  const openAddCategory = useCallback(() => {
    setCatModal({ mode: 'add' });
  }, []);

  const openEditCategory = useCallback((cat: ExpenseCategory) => {
    setCatModal({ mode: 'edit', data: cat });
  }, []);

  const saveCategory = useCallback(
    (data: Partial<ExpenseCategory>, mode: 'add' | 'edit', id?: string) => {
      if (mode === 'add') {
        const maxOrder = categories.reduce((max, c) => Math.max(max, c.order), 0);
        setCategories((prev) => [
          ...prev,
          { id: crypto.randomUUID(), order: maxOrder + 1, ...data } as ExpenseCategory,
        ]);
      } else {
        setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
      }
      setCatModal(null);
    },
    [categories, setCategories]
  );

  const deleteCategory = useCallback(
    (id: string) => {
      // Remove the category
      setCategories((prev) => prev.filter((c) => c.id !== id));
      // Remove all expenses belonging to this category
      const expenseIds = expenses.filter((e) => e.categoryId === id).map((e) => e.id);
      setExpenses((prev) => prev.filter((e) => e.categoryId !== id));
      // Remove all transactions linked to those expenses or directly to the category
      setTransactions((prev) =>
        prev.filter((t) => t.categoryId !== id && !expenseIds.includes(t.expenseId ?? ''))
      );
      setCatModal(null);
    },
    [expenses, setCategories, setExpenses, setTransactions]
  );

  const setCategoryBudget = useCallback(
    (catId: string, budget: number) => {
      setCategories((prev) =>
        prev.map((c) => (c.id === catId ? { ...c, monthlyBudget: budget } : c))
      );
    },
    [setCategories]
  );

  // ── Transaction CRUD ──────────────────────────────────────────────────────
  const saveTransaction = useCallback(
    (tx: Transaction) => {
      setTransactions((prev) => [...prev, tx]);
    },
    [setTransactions]
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    },
    [setTransactions]
  );

  // ── Settings ──────────────────────────────────────────────────────────────
  const updateSettings = useCallback(
    (partial: Partial<FinanceSettings>) => {
      setSettings((prev) => ({ ...prev, ...partial }));
    },
    [setSettings]
  );

  const sync = getSyncBadgeInfo(syncStatus);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  );

  return (
    <div id="panel-finance" role="tabpanel" aria-label="لوحة المالية">
      <div className={`sync-badge ${sync.cls}`} role="status" aria-live="polite">
        <span aria-hidden="true">{sync.icon}</span>
        <span>{sync.text}</span>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 100px' }}>
        {/* Header */}
        <header className="fin-page-header">
          <h1 className="fin-page-header__title">💰 المالية الشخصية</h1>
          <div className="fin-page-header__sub">إدارة الميزانية والمصروفات والأهداف</div>

          {/* View toggle */}
          <div className="fin-view-toggle">
            <button
              className={`fin-view-toggle__btn ${view === 'monthly' ? 'fin-view-toggle__btn--active' : ''}`}
              onClick={() => setView('monthly')}
            >
              📅 شهري
            </button>
            <button
              className={`fin-view-toggle__btn ${view === 'quarterly' ? 'fin-view-toggle__btn--active' : ''}`}
              onClick={() => setView('quarterly')}
            >
              📆 ربعي
            </button>
            <button
              className={`fin-view-toggle__btn ${view === 'annual' ? 'fin-view-toggle__btn--active' : ''}`}
              onClick={() => setView('annual')}
            >
              📊 سنوي
            </button>
            <button
              className="fin-view-toggle__btn"
              onClick={() => setShowSettings(!showSettings)}
              aria-label="الإعدادات"
            >
              ⚙️
            </button>
          </div>
        </header>

        {/* Settings panel */}
        {showSettings && (
          <div className="fin-settings">
            <div className="fin-row">
              <label className="fin-label" style={{ flex: 1 }}>
                العملة الأساسية (الرمز)
                <input
                  className="fin-input"
                  value={settings.currencySymbol || ''}
                  onChange={(e) => updateSettings({ currencySymbol: e.target.value })}
                  placeholder="مثال: ر.س، $، ج.م"
                />
              </label>
            </div>
            <label
              className="fin-label"
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}
            >
              <input
                type="checkbox"
                checked={settings.showSecondaryCurrency}
                onChange={(e) => updateSettings({ showSecondaryCurrency: e.target.checked })}
              />
              إظهار عملة ثانوية للتحويل
            </label>
            {settings.showSecondaryCurrency && (
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <label className="fin-label" style={{ flex: 1 }}>
                  رمز العملة الثانوية
                  <input
                    className="fin-input"
                    value={settings.secondaryCurrencySymbol || ''}
                    onChange={(e) => updateSettings({ secondaryCurrencySymbol: e.target.value })}
                    placeholder="مثال: ج.م، USD"
                  />
                </label>
                <label className="fin-label" style={{ flex: 2 }}>
                  سعر التحويل (1 {settings.currencySymbol || 'أساسي'} = ؟)
                  <input
                    className="fin-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.exchangeRate || ''}
                    onChange={(e) =>
                      updateSettings({ exchangeRate: Number(e.target.value) || undefined })
                    }
                    placeholder="مثل: 13.2"
                  />
                </label>
              </div>
            )}
            {settings.showSecondaryCurrency && settings.exchangeRate && summary.totalIncome > 0 && (
              <div className="fin-calc-hint">
                💱 الدخل بـ ({settings.secondaryCurrencySymbol || 'الثانوية'}):{' '}
                {Math.round(summary.totalIncome * settings.exchangeRate).toLocaleString('ar-SA')}{' '}
                {settings.secondaryCurrencySymbol}
              </div>
            )}
          </div>
        )}

        {/* ── Monthly View ──────────────────────────────────────────────── */}
        {view === 'monthly' && (
          <>
            <FinanceDashboard
              summary={summary}
              settings={settings}
              monthLabel={monthLabel}
              onPrevMonth={() => setViewMonth((m) => shiftMonth(m, -1))}
              onNextMonth={() => setViewMonth((m) => shiftMonth(m, 1))}
            />

            <FinanceInsights
              summary={summary}
              settings={settings}
              month={viewMonth}
              incomes={income}
              categories={categories}
              expenses={expenses}
              transactions={transactions}
              goals={goals}
            />

            <IncomeSection income={income} setIncome={setIncome} settings={settings} />

            {/* Category sections */}
            <div className="fin-cats-header">
              <h3 className="fin-section__title">💸 أقسام المصروفات</h3>
              <button className="fin-btn-sm" onClick={openAddCategory}>
                ＋ قسم جديد
              </button>
            </div>

            {sortedCategories.map((cat) => (
              <CategorySection
                key={cat.id}
                category={cat}
                expenses={expenses}
                transactions={transactions}
                month={viewMonth}
                settings={settings}
                onAddExpense={openAddExpense}
                onEditExpense={openEditExpense}
                onDeleteExpense={deleteExpense}
                onRegisterTx={(exp) =>
                  setTxDrawer({ mode: 'register', expense: exp, expenseType: exp.type })
                }
                onViewTxs={(exp) =>
                  setTxDrawer({ mode: 'view', expense: exp, expenseType: exp.type })
                }
                onAddCategoryTx={(cat) => setTxDrawer({ mode: 'register-category', category: cat })}
                onViewCategoryTxs={(cat) => setTxDrawer({ mode: 'view-category', category: cat })}
                onEditCategory={openEditCategory}
                onSetBudget={setCategoryBudget}
              />
            ))}

            <GoalsSection goals={goals} setGoals={setGoals} settings={settings} />
          </>
        )}

        {/* ── Quarterly View ─────────────────────────────────────────────── */}
        {view === 'quarterly' && (
          <QuarterlyView
            year={viewQuarter.year}
            quarter={viewQuarter.quarter}
            incomes={income}
            categories={categories}
            expenses={expenses}
            transactions={transactions}
            goals={goals}
            settings={settings}
            onPrevQuarter={() => setViewQuarter((q) => shiftQuarter(q.year, q.quarter, -1))}
            onNextQuarter={() => setViewQuarter((q) => shiftQuarter(q.year, q.quarter, +1))}
            onRegisterTx={(exp) =>
              setTxDrawer({ mode: 'register', expense: exp, expenseType: exp.type })
            }
          />
        )}

        {/* ── Annual View ───────────────────────────────────────────────── */}
        {view === 'annual' && (
          <AnnualView
            year={currentYear}
            incomes={income}
            categories={categories}
            expenses={expenses}
            transactions={transactions}
            goals={goals}
            settings={settings}
          />
        )}

        {/* Footer */}
        <footer className="fin-footer">
          ﴿ وَلَا تُسْرِفُوا إِنَّهُ لَا يُحِبُّ الْمُسْرِفِينَ ﴾
        </footer>
      </div>

      {/* Modals & Drawers */}
      {expModal && (
        <ExpenseModal modal={expModal} onSave={saveExpense} onClose={() => setExpModal(null)} />
      )}
      {catModal && (
        <CategoryModal
          modal={catModal}
          onSave={saveCategory}
          onDelete={deleteCategory}
          onClose={() => setCatModal(null)}
        />
      )}
      {txDrawer && (
        <TransactionDrawer
          state={txDrawer}
          transactions={transactions}
          settings={settings}
          onSave={saveTransaction}
          onDelete={deleteTransaction}
          onClose={() => setTxDrawer(null)}
        />
      )}
    </div>
  );
}
