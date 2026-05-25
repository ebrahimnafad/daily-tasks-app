import { useState, useCallback } from 'react';
import type { Goal, FinanceSettings } from '../types';
import { GOAL_ICONS } from '../constants';
import { formatAmount, calcGoalMonthlyTarget } from '../utils';
import './GoalsSection.css';

interface GoalsSectionProps {
  goals: Goal[];
  setGoals: (v: Goal[] | ((prev: Goal[]) => Goal[])) => void;
  settings: FinanceSettings;
}

export default function GoalsSection({ goals, setGoals, settings }: GoalsSectionProps) {
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; id?: string } | null>(null);
  const [form, setForm] = useState({
    icon: '🏗️',
    title: '',
    targetAmount: '',
    currentSaved: '0',
    deadline: '',
    notes: '',
  });

  const openAdd = useCallback(() => {
    setForm({
      icon: '🏗️',
      title: '',
      targetAmount: '',
      currentSaved: '0',
      deadline: '',
      notes: '',
    });
    setModal({ mode: 'add' });
  }, []);

  const openEdit = useCallback((g: Goal) => {
    setForm({
      icon: g.icon || '🏗️',
      title: g.title,
      targetAmount: String(g.targetAmount || ''),
      currentSaved: String(g.currentSaved || '0'),
      deadline: g.deadline || '',
      notes: g.notes || '',
    });
    setModal({ mode: 'edit', id: g.id });
  }, []);

  const save = useCallback(() => {
    if (!form.title.trim() || !form.targetAmount) return;
    const target = Number(form.targetAmount) || 0;
    const current = Number(form.currentSaved) || 0;
    const monthlyTarget = calcGoalMonthlyTarget(target, current, form.deadline || null);

    const data: Goal = {
      id: modal?.mode === 'add' ? crypto.randomUUID() : modal!.id!,
      icon: form.icon,
      title: form.title.trim(),
      targetAmount: target,
      currentSaved: current,
      deadline: form.deadline || null,
      monthlyTarget,
      isActive: true,
      notes: form.notes,
    };

    if (modal?.mode === 'add') {
      setGoals((prev) => [...prev, data]);
    } else {
      setGoals((prev) => prev.map((g) => (g.id === modal?.id ? data : g)));
    }
    setModal(null);
  }, [form, modal, setGoals]);

  const remove = useCallback(
    (id: string) => {
      if (!window.confirm('حذف الهدف؟')) return;
      setGoals((prev) => prev.filter((g) => g.id !== id));
    },
    [setGoals]
  );

  const addSavings = useCallback(
    (goalId: string, amount: number) => {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId ? { ...g, currentSaved: (g.currentSaved || 0) + amount } : g
        )
      );
    },
    [setGoals]
  );

  return (
    <section className="fin-section" aria-label="أهداف الادخار">
      <div className="fin-section__header">
        <h3 className="fin-section__title">🎯 أهداف الادخار</h3>
      </div>

      {goals.length === 0 && <div className="fin-empty">لم تضف أهداف ادخار بعد</div>}

      {goals.map((goal) => {
        const pct =
          goal.targetAmount > 0
            ? Math.min(100, Math.round((goal.currentSaved / goal.targetAmount) * 100))
            : 0;
        const remaining = (goal.targetAmount || 0) - (goal.currentSaved || 0);
        const deadlineDate = goal.deadline ? new Date(goal.deadline) : null;
        const monthsLeft = deadlineDate
          ? Math.max(
              0,
              Math.ceil(
                (deadlineDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30.44)
              )
            )
          : null;

        return (
          <div key={goal.id} className="fin-goal-card">
            <div className="fin-goal-card__header">
              <span className="fin-goal-card__icon">{goal.icon || '🏗️'}</span>
              <div className="fin-goal-card__info">
                <div className="fin-goal-card__title">{goal.title}</div>
                <div className="fin-goal-card__amounts">
                  {formatAmount(goal.currentSaved, settings)} /{' '}
                  {formatAmount(goal.targetAmount, settings)}
                </div>
              </div>
              <div className="fin-goal-card__actions">
                <button className="fin-btn-sm" onClick={() => openEdit(goal)}>
                  ✏️
                </button>
                <button className="fin-btn-sm" onClick={() => remove(goal.id)}>
                  🗑️
                </button>
              </div>
            </div>

            <div className="progress-bar" style={{ marginTop: 'var(--space-sm)' }}>
              <div
                className="progress-bar__fill"
                style={{ width: `${pct}%`, background: pct >= 100 ? '#9bc87a' : '#6e9fcf' }}
              />
            </div>
            <div className="fin-goal-card__meta">
              <span>{pct}٪</span>
              {monthsLeft !== null && <span>📅 {monthsLeft} شهر متبقي</span>}
              {goal.monthlyTarget > 0 && (
                <span>الاقتطاع: {formatAmount(goal.monthlyTarget, settings)}/شهر</span>
              )}
            </div>

            {remaining > 0 && (
              <button
                className="fin-btn-outline fin-btn-sm"
                style={{ marginTop: 'var(--space-sm)' }}
                onClick={() => {
                  const amt = window.prompt('مبلغ الإضافة (ر.س):');
                  if (amt && Number(amt) > 0) addSavings(goal.id, Number(amt));
                }}
              >
                ＋ إضافة مبلغ
              </button>
            )}

            {pct >= 100 && <div className="fin-goal-card__done">🎉 تم الوصول للهدف!</div>}
          </div>
        );
      })}

      <button className="fin-add-btn" onClick={openAdd}>
        ＋ إضافة هدف ادخار
      </button>

      {modal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box fin-modal">
            <h3 className="fin-modal__title">{modal.mode === 'add' ? 'إضافة هدف' : 'تعديل هدف'}</h3>

            <div className="fin-modal__icons">
              {GOAL_ICONS.map((ic) => (
                <button
                  key={ic}
                  className={`fin-icon-btn ${form.icon === ic ? 'fin-icon-btn--active' : ''}`}
                  onClick={() => setForm((p) => ({ ...p, icon: ic }))}
                >
                  {ic}
                </button>
              ))}
            </div>

            <label className="fin-label">
              العنوان
              <input
                className="fin-input"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="مثل: شراء قطعة أرض"
              />
            </label>

            <div className="fin-row">
              <label className="fin-label" style={{ flex: 1 }}>
                المبلغ المستهدف (ر.س)
                <input
                  className="fin-input"
                  type="number"
                  min="0"
                  value={form.targetAmount}
                  onChange={(e) => setForm((p) => ({ ...p, targetAmount: e.target.value }))}
                />
              </label>
              <label className="fin-label" style={{ flex: 1 }}>
                المدخر حالياً (ر.س)
                <input
                  className="fin-input"
                  type="number"
                  min="0"
                  value={form.currentSaved}
                  onChange={(e) => setForm((p) => ({ ...p, currentSaved: e.target.value }))}
                />
              </label>
            </div>

            <label className="fin-label">
              الموعد المستهدف
              <input
                className="fin-input"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))}
              />
            </label>

            {form.targetAmount &&
              form.deadline &&
              (() => {
                const monthly = calcGoalMonthlyTarget(
                  Number(form.targetAmount) || 0,
                  Number(form.currentSaved) || 0,
                  form.deadline
                );
                const months = Math.max(
                  1,
                  Math.ceil(
                    (new Date(form.deadline).getTime() - new Date().getTime()) /
                      (1000 * 60 * 60 * 24 * 30.44)
                  )
                );
                return monthly > 0 ? (
                  <div className="fin-calc-hint">
                    💡 الاقتطاع الشهري المطلوب: <strong>{formatAmount(monthly, settings)}</strong>{' '}
                    لمدة {months} شهر
                  </div>
                ) : null;
              })()}

            <label className="fin-label">
              ملاحظات
              <input
                className="fin-input"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="اختياري"
              />
            </label>

            <div className="fin-modal__actions">
              <button className="fin-btn-primary" onClick={save}>
                💾 حفظ
              </button>
              <button className="fin-btn-secondary" onClick={() => setModal(null)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
