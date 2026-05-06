import { useMemo } from 'react';
import type {
  MonthlyFinanceSummary,
  FinanceSettings,
  Income,
  ExpenseCategory,
  Expense,
  Transaction,
  Goal,
} from '../types';
import { formatAmount, calcMonthlySummary, shiftMonth } from '../utils';

interface Insight {
  id: string;
  icon: string;
  type: 'success' | 'warning' | 'danger' | 'info' | 'tip';
  title: string;
  body: string;
  priority: number; // lower = more important
}

interface FinanceInsightsProps {
  summary: MonthlyFinanceSummary;
  settings: FinanceSettings;
  month: string;
  incomes: Income[];
  categories: ExpenseCategory[];
  expenses: Expense[];
  transactions: Transaction[];
  goals: Goal[];
}

export default function FinanceInsights({
  summary,
  settings,
  month,
  incomes,
  categories,
  expenses,
  transactions,
  goals,
}: FinanceInsightsProps) {
  const insights = useMemo(() => {
    const list: Insight[] = [];
    const fmt = (n: number) => formatAmount(n, settings);

    // ── 1. Budget health per category ─────────────────────────────────
    summary.categoryBreakdown.forEach((cb) => {
      if (cb.budget === 0) return;
      if (cb.percentage >= 120) {
        list.push({
          id: `over-${cb.category.id}`,
          icon: '🚨',
          type: 'danger',
          title: `تجاوز كبير في "${cb.category.icon} ${cb.category.name}"`,
          body: `أنفقت ${fmt(cb.actual)} من أصل ${fmt(cb.budget)} — تجاوز بنسبة ${cb.percentage - 100}٪`,
          priority: 1,
        });
      } else if (cb.percentage >= 100) {
        list.push({
          id: `full-${cb.category.id}`,
          icon: '⚠️',
          type: 'warning',
          title: `${cb.category.icon} ${cb.category.name} — استنفدت الميزانية`,
          body: `أنفقت ${fmt(cb.actual)} من ${fmt(cb.budget)}. حاول تقليل المصروفات المتبقية.`,
          priority: 2,
        });
      } else if (cb.percentage >= 80) {
        list.push({
          id: `warn-${cb.category.id}`,
          icon: '📊',
          type: 'info',
          title: `${cb.category.icon} ${cb.category.name} — اقتربت من الحد`,
          body: `استهلكت ${cb.percentage}٪ من الميزانية (${fmt(cb.actual)} / ${fmt(cb.budget)})`,
          priority: 4,
        });
      }
    });

    // ── 2. Monthly comparison (vs last month) ─────────────────────────
    const prevMonth = shiftMonth(month, -1);
    const prevSummary = calcMonthlySummary(
      incomes,
      categories,
      expenses,
      transactions,
      goals,
      prevMonth
    );
    if (prevSummary.totalActual > 0 && summary.totalActual > 0) {
      const diff = summary.totalActual - prevSummary.totalActual;
      const pct = Math.round((Math.abs(diff) / prevSummary.totalActual) * 100);
      if (diff > 0 && pct >= 15) {
        list.push({
          id: 'spend-up',
          icon: '📈',
          type: 'warning',
          title: `ارتفاع في الإنفاق بنسبة ${pct}٪`,
          body: `أنفقت ${fmt(summary.totalActual)} هذا الشهر مقابل ${fmt(prevSummary.totalActual)} الشهر الماضي. راجع أقسامك.`,
          priority: 3,
        });
      } else if (diff < 0 && pct >= 10) {
        list.push({
          id: 'spend-down',
          icon: '🎉',
          type: 'success',
          title: `أحسنت! وفرت ${pct}٪ مقارنة بالشهر الماضي`,
          body: `انخفض إنفاقك من ${fmt(prevSummary.totalActual)} إلى ${fmt(summary.totalActual)}.`,
          priority: 5,
        });
      }
    }

    // ── 3. Savings projection ─────────────────────────────────────────
    if (summary.totalIncome > 0 && summary.totalBudget > 0) {
      const monthlySavings =
        summary.totalIncome - summary.totalBudget - summary.totalGoalDeductions;
      if (monthlySavings > 0) {
        const annualProjection = monthlySavings * 12;
        list.push({
          id: 'savings-proj',
          icon: '🏦',
          type: 'tip',
          title: `توقعات الادخار السنوية`,
          body: `بناءً على خطتك الحالية، يمكنك ادخار ~${fmt(annualProjection)} سنوياً (${fmt(monthlySavings)}/شهر).`,
          priority: 6,
        });
      } else {
        list.push({
          id: 'no-savings',
          icon: '💡',
          type: 'danger',
          title: `لا يوجد فائض ادخاري`,
          body: `ميزانيتك تتجاوز دخلك بـ ${fmt(Math.abs(monthlySavings))}. أعد النظر في أولوياتك.`,
          priority: 2,
        });
      }
    }

    // ── 4. Goal progress milestones ───────────────────────────────────
    goals
      .filter((g) => g.isActive)
      .forEach((g) => {
        const pct = g.targetAmount > 0 ? Math.round((g.currentSaved / g.targetAmount) * 100) : 0;
        if (pct >= 100) {
          list.push({
            id: `goal-done-${g.id}`,
            icon: '🏆',
            type: 'success',
            title: `أنجزت هدف "${g.title}"! 🎊`,
            body: `وصلت إلى ${fmt(g.targetAmount)}. أضف هدفاً جديداً للاستمرار!`,
            priority: 0,
          });
        } else if (pct >= 75) {
          list.push({
            id: `goal-near-${g.id}`,
            icon: '🔥',
            type: 'info',
            title: `هدف "${g.title}" — اقتربت! ${pct}٪`,
            body: `متبقي ${fmt(g.targetAmount - g.currentSaved)} فقط للوصول.`,
            priority: 3,
          });
        } else if (pct >= 50) {
          list.push({
            id: `goal-half-${g.id}`,
            icon: '⭐',
            type: 'success',
            title: `نصف الطريق! "${g.title}" — ${pct}٪`,
            body: `أحرزت ${fmt(g.currentSaved)} من ${fmt(g.targetAmount)}.`,
            priority: 5,
          });
        }
      });

    // ── 5. Unused categories tip ──────────────────────────────────────
    const usedCatIds = new Set(expenses.filter((e) => e.isActive).map((e) => e.categoryId));
    const unusedCount = categories.filter((c) => !usedCatIds.has(c.id)).length;
    if (unusedCount > 5 && categories.length > 0) {
      list.push({
        id: 'unused-cats',
        icon: '📝',
        type: 'tip',
        title: `${unusedCount} أقسام فارغة`,
        body: `أضف بنوداً لأقسام مثل النقل، التعليم، أو الترفيه لتكتمل صورتك المالية.`,
        priority: 8,
      });
    }

    // ── 6. No income warning ──────────────────────────────────────────
    if (summary.totalIncome === 0) {
      list.push({
        id: 'no-income',
        icon: '💰',
        type: 'warning',
        title: 'لم تُضف مصادر دخل بعد',
        body: 'أضف دخلك الشهري لتحصل على تحليل مالي دقيق ومعدل ادخار واقعي.',
        priority: 0,
      });
    }

    // ── 7. Smart allocation tip ───────────────────────────────────────
    if (summary.totalIncome > 0 && summary.savingsRate < 20 && summary.savingsRate >= 0) {
      list.push({
        id: 'low-savings',
        icon: '🎯',
        type: 'tip',
        title: `معدل الادخار ${summary.savingsRate}٪ — أقل من المثالي`,
        body: `ينصح خبراء المال بادخار 20٪ على الأقل. حاول تقليل المصروفات المتغيرة.`,
        priority: 4,
      });
    } else if (summary.savingsRate >= 30) {
      list.push({
        id: 'great-savings',
        icon: '💎',
        type: 'success',
        title: `ممتاز! معدل ادخار ${summary.savingsRate}٪`,
        body: `أنت تدخر أكثر من 30٪ من دخلك. استمر واستثمر الفائض بحكمة.`,
        priority: 7,
      });
    }

    return list.sort((a, b) => a.priority - b.priority).slice(0, 4);
  }, [summary, settings, month, incomes, categories, expenses, transactions, goals]);

  if (insights.length === 0) return null;

  const typeStyles: Record<string, { bg: string; border: string; color: string }> = {
    success: { bg: 'rgba(155,200,122,.06)', border: 'rgba(155,200,122,.2)', color: '#9bc87a' },
    warning: { bg: 'rgba(230,168,85,.06)', border: 'rgba(230,168,85,.2)', color: '#e6a855' },
    danger: { bg: 'rgba(217,126,106,.06)', border: 'rgba(217,126,106,.2)', color: '#d97e6a' },
    info: { bg: 'rgba(110,159,207,.06)', border: 'rgba(110,159,207,.2)', color: '#6e9fcf' },
    tip: {
      bg: 'rgba(var(--gold-rgb),.05)',
      border: 'rgba(var(--gold-rgb),.15)',
      color: 'var(--gold)',
    },
  };

  return (
    <section className="fin-insights" aria-label="رؤى مالية">
      <h3 className="fin-section__title">🧠 رؤى ذكية</h3>
      <div className="fin-insights__list">
        {insights.map((ins) => {
          const s = typeStyles[ins.type] || typeStyles.info;
          return (
            <div
              key={ins.id}
              className="fin-insight"
              style={{ background: s.bg, borderColor: s.border }}
            >
              <span className="fin-insight__icon">{ins.icon}</span>
              <div className="fin-insight__content">
                <div className="fin-insight__title" style={{ color: s.color }}>
                  {ins.title}
                </div>
                <div className="fin-insight__body">{ins.body}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
