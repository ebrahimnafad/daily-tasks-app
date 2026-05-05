import { useState, useCallback, useMemo } from "react";
import { useFinanceSync } from "@/features/finance";
import { MonthlySummary } from "@/features/finance";
import { IncomeSection } from "@/features/finance";
import { FinanceCard } from "@/features/finance";
import { FinanceModal } from "@/features/finance";
import { PaymentDrawer } from "@/features/finance";
import { GoalsSection } from "@/features/finance";

/**
 * FinancePage — الصفحة الرئيسية للمالية
 */
export default function FinancePage({ onQuota }) {
  const { income, setIncome, obligations, setObligations, payments, setPayments, goals, setGoals, syncStatus } = useFinanceSync(onQuota);

  const [viewMonth, setViewMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [oblModal, setOblModal] = useState(null);
  const [drawer, setDrawer] = useState(null); // { mode, obligationId }

  // ── Obligation CRUD ───────────────────────────────────────────────────
  const openAddObl = useCallback(() => setOblModal({ mode: "add" }), []);
  const openEditObl = useCallback((obl) => setOblModal({ mode: "edit", data: obl }), []);

  const saveObl = useCallback((data, mode, id) => {
    if (mode === "add") {
      setObligations(prev => [...prev, { id: crypto.randomUUID(), ...data }]);
    } else {
      setObligations(prev => prev.map(o => o.id === id ? { ...o, ...data } : o));
    }
    setOblModal(null);
  }, [setObligations]);

  const deleteObl = useCallback((id) => {
    if (!window.confirm("حذف هذا الالتزام؟")) return;
    setObligations(prev => prev.filter(o => o.id !== id));
    setPayments(prev => prev.filter(p => p.obligationId !== id));
  }, [setObligations, setPayments]);

  // ── Payment ────────────────────────────────────────────────────────────
  const registerPayment = useCallback((obl) => setDrawer({ mode: "register", obligationId: obl.id }), []);
  const viewPayments = useCallback((oblId) => setDrawer({ mode: "view", obligationId: oblId }), []);

  const savePayment = useCallback((payment) => {
    setPayments(prev => [...prev, payment]);
  }, [setPayments]);

  const deletePayment = useCallback((payId) => {
    setPayments(prev => prev.filter(p => p.id !== payId));
  }, [setPayments]);

  // ── Sorted obligations ─────────────────────────────────────────────────
  const sortedObligations = useMemo(() => {
    const now = new Date();
    return [...obligations].sort((a, b) => {
      // متوقفة في النهاية
      if (a.isActive === false && b.isActive !== false) return 1;
      if (b.isActive === false && a.isActive !== false) return -1;
      // الأقرب موعداً أولاً
      const dA = a.dueDay || 1;
      const dB = b.dueDay || 1;
      return dA - dB;
    });
  }, [obligations]);

  const drawerObl = drawer ? obligations.find(o => o.id === drawer.obligationId) : null;

  // ── Sync badge ─────────────────────────────────────────────────────────
  const syncMap = {
    syncing: { icon: "⏳", text: "جاري الحفظ...", cls: "syncing" },
    synced:  { icon: "☁️", text: "محفوظ سحابياً", cls: "synced" },
    offline: { icon: "💾", text: "محفوظ محلياً", cls: "offline" },
    error:   { icon: "⚠️", text: "خطأ في المزامنة", cls: "error" },
  };
  const sync = syncMap[syncStatus] || syncMap.offline;

  // ── Google Sheets Export ───────────────────────────────────────────────
  const exportToSheets = useCallback(async () => {
    const url = localStorage.getItem("sheet_finance_webhook") || window.prompt("أدخل رابط Google Apps Script (Web App URL):");
    if (!url) return;
    localStorage.setItem("sheet_finance_webhook", url);

    const totalIncome = income.filter(s => s.isActive !== false).reduce((sum, s) => {
      const amt = s.amount || 0;
      if (s.frequency === "monthly") return sum + amt;
      if (s.frequency === "quarterly") return sum + amt / 3;
      if (s.frequency === "semi-annual") return sum + amt / 6;
      if (s.frequency === "annual") return sum + amt / 12;
      return sum;
    }, 0);

    const monthPayments = payments.filter(p => p.date?.startsWith(viewMonth) && p.status === "paid");
    const totalPaid = monthPayments.reduce((s, p) => s + (p.amount || 0), 0);

    try {
      await fetch(url, {
        method: "POST", mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          month: viewMonth,
          totalIncome,
          totalPaid,
          obligations: obligations.map(o => ({ title: o.title, amount: o.amount, frequency: o.frequency })),
          goals: goals.map(g => ({ title: g.title, target: g.targetAmount, saved: g.currentSaved })),
        }),
      });
      alert("✅ تم إرسال التقرير");
    } catch { alert("❌ خطأ في الإرسال"); }
  }, [income, obligations, payments, goals, viewMonth]);

  return (
    <div id="panel-finance" role="tabpanel" aria-label="لوحة المالية">
      {/* Sync badge */}
      <div className={`sync-badge ${sync.cls}`} role="status" aria-live="polite">
        <span aria-hidden="true">{sync.icon}</span><span>{sync.text}</span>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 100px" }}>
        <header style={{ textAlign: "center", marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--text-gold)", textShadow: "0 2px 20px rgba(var(--gold-rgb),.3)" }}>
            💰 المالية الشخصية
          </h1>
          <div style={{ marginTop: 4, fontSize: 13, color: "rgba(var(--gold-rgb),.45)" }}>إدارة الدخل والالتزامات والأهداف</div>
        </header>

        {/* ملخص الشهر */}
        <MonthlySummary
          income={income} obligations={obligations}
          payments={payments} goals={goals}
          viewMonth={viewMonth} onChangeMonth={setViewMonth}
        />

        {/* مصادر الدخل */}
        <IncomeSection income={income} setIncome={setIncome} />

        {/* الالتزامات */}
        <section className="fin-section" aria-label="الالتزامات المالية">
          <div className="fin-section__header">
            <h3 className="fin-section__title">💸 الالتزامات</h3>
            <span className="fin-section__total">{obligations.filter(o => o.isActive !== false).length} التزام</span>
          </div>

          {sortedObligations.length === 0 && <div className="fin-empty">لم تضف التزامات بعد</div>}

          {sortedObligations.map(obl => (
            <FinanceCard
              key={obl.id}
              obligation={obl}
              payments={payments}
              onEdit={openEditObl}
              onDelete={deleteObl}
              onRegisterPayment={registerPayment}
              onViewPayments={viewPayments}
            />
          ))}

          <button className="fin-add-btn" onClick={openAddObl}>＋ إضافة التزام</button>
        </section>

        {/* أهداف الادخار */}
        <GoalsSection goals={goals} setGoals={setGoals} />

        {/* تصدير */}
        <button className="fin-export-btn" onClick={exportToSheets}>
          📊 تصدير التقرير لـ Google Sheets
        </button>

        <footer style={{ textAlign: "center", marginTop: 32, color: "rgba(var(--gold-rgb),.22)", fontSize: 13 }}>
          ﴿ وَلَا تُسْرِفُوا إِنَّهُ لَا يُحِبُّ الْمُسْرِفِينَ ﴾
        </footer>
      </div>

      {/* Modals */}
      <FinanceModal modal={oblModal} onSave={saveObl} onClose={() => setOblModal(null)} />

      {drawer && drawerObl && (
        <PaymentDrawer
          mode={drawer.mode}
          obligation={drawerObl}
          payments={payments}
          onSavePayment={savePayment}
          onDeletePayment={deletePayment}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
