import { useState, useCallback } from "react";

const OBL_ICONS = ["🏠", "🏗️", "📚", "👨‍👩‍👧‍👦", "🔌", "📱", "🚗", "🎉", "💊", "🛒", "📋", "💳"];
const CATEGORIES = [
  { label: "عقار", color: "#c87a4e" },
  { label: "تعليم", color: "#6e9fcf" },
  { label: "أسرة", color: "#9bc87a" },
  { label: "خدمات", color: "#bda782" },
  { label: "موسمي", color: "#dca7a5" },
  { label: "أخرى", color: "#aaaaaa" },
];
const TYPES = [
  { value: "recurring", label: "دوري ثابت" },
  { value: "installment", label: "أقساط بإجمالي" },
  { value: "variable", label: "متغير (فواتير)" },
  { value: "seasonal", label: "موسمي (أعياد/مناسبات)" },
];
const FREQUENCIES = [
  { value: "monthly", label: "شهري" },
  { value: "quarterly", label: "ربع سنوي" },
  { value: "semi-annual", label: "نصف سنوي" },
  { value: "annual", label: "سنوي" },
  { value: "one-time", label: "مرة واحدة" },
];

const EMPTY = { icon: "📋", title: "", category: "أخرى", type: "recurring", frequency: "monthly", dueDay: "1", amount: "", isVariable: false, totalAmount: "", totalInstallments: "", startDate: "", seasonMonth: "", monthlySetAside: "", notes: "" };

/**
 * FinanceModal — إضافة/تعديل التزام مالي
 */
export default function FinanceModal({ modal, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    if (!modal) return EMPTY;
    if (modal.mode === "edit" && modal.data) {
      const d = modal.data;
      return { icon: d.icon, title: d.title, category: d.category || "أخرى", type: d.type || "recurring", frequency: d.frequency || "monthly", dueDay: String(d.dueDay || 1), amount: String(d.amount || ""), isVariable: d.isVariable || false, totalAmount: String(d.totalAmount || ""), totalInstallments: String(d.totalInstallments || ""), startDate: d.startDate || "", seasonMonth: String(d.seasonMonth || ""), monthlySetAside: String(d.monthlySetAside || ""), notes: d.notes || "" };
    }
    return { ...EMPTY };
  });

  const f = (field, val) => setForm(p => ({ ...p, [field]: val }));

  const save = useCallback(() => {
    if (!form.title.trim() || !form.amount) return;
    const data = {
      icon: form.icon, title: form.title.trim(), category: form.category,
      type: form.type, frequency: form.frequency, dueDay: Number(form.dueDay) || 1,
      amount: Number(form.amount) || 0, isVariable: form.type === "variable",
      totalAmount: form.type === "installment" ? Number(form.totalAmount) || 0 : undefined,
      totalInstallments: form.type === "installment" ? Number(form.totalInstallments) || 0 : undefined,
      startDate: form.startDate || undefined,
      seasonMonth: form.type === "seasonal" ? Number(form.seasonMonth) || undefined : undefined,
      monthlySetAside: form.type === "seasonal" ? Number(form.monthlySetAside) || 0 : undefined,
      notes: form.notes, isActive: true,
    };
    onSave(data, modal.mode, modal.data?.id);
  }, [form, modal, onSave]);

  if (!modal) return null;

  return (
    <div className="cov" role="dialog" aria-modal="true" aria-label={modal.mode === "add" ? "إضافة التزام" : "تعديل التزام"}>
      <div className="cbox fin-modal fin-modal--lg">
        <h3 className="fin-modal__title">{modal.mode === "add" ? "إضافة التزام مالي" : "تعديل التزام"}</h3>

        <div className="fin-modal__scroll">
          {/* Icons */}
          <div className="fin-modal__icons">
            {OBL_ICONS.map(ic => (
              <button key={ic} className={`fin-icon-btn ${form.icon === ic ? "fin-icon-btn--active" : ""}`} onClick={() => f("icon", ic)}>{ic}</button>
            ))}
          </div>

          <label className="fin-label">العنوان
            <input className="fin-input" value={form.title} onChange={e => f("title", e.target.value)} placeholder="مثل: قسط الأرض" />
          </label>

          <div className="fin-row">
            <label className="fin-label" style={{ flex: 1 }}>التصنيف
              <select className="fin-input" value={form.category} onChange={e => f("category", e.target.value)}>
                {CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
              </select>
            </label>
            <label className="fin-label" style={{ flex: 1 }}>النوع
              <select className="fin-input" value={form.type} onChange={e => f("type", e.target.value)}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
          </div>

          <div className="fin-row">
            <label className="fin-label" style={{ flex: 1 }}>التكرار
              <select className="fin-input" value={form.frequency} onChange={e => f("frequency", e.target.value)}>
                {FREQUENCIES.map(fr => <option key={fr.value} value={fr.value}>{fr.label}</option>)}
              </select>
            </label>
            <label className="fin-label" style={{ flex: 1 }}>يوم الاستحقاق
              <input className="fin-input" type="number" min="1" max="28" value={form.dueDay} onChange={e => f("dueDay", e.target.value)} />
            </label>
          </div>

          <label className="fin-label">{form.type === "variable" ? "المبلغ التقديري" : "مبلغ الدفعة"} (ر.س)
            <input className="fin-input" type="number" min="0" value={form.amount} onChange={e => f("amount", e.target.value)} />
          </label>

          {/* حقول الأقساط */}
          {form.type === "installment" && (
            <div className="fin-row">
              <label className="fin-label" style={{ flex: 1 }}>المبلغ الإجمالي
                <input className="fin-input" type="number" min="0" value={form.totalAmount} onChange={e => f("totalAmount", e.target.value)} />
              </label>
              <label className="fin-label" style={{ flex: 1 }}>عدد الأقساط
                <input className="fin-input" type="number" min="1" value={form.totalInstallments} onChange={e => f("totalInstallments", e.target.value)} />
              </label>
            </div>
          )}

          {/* حقول الموسمي */}
          {form.type === "seasonal" && (
            <div className="fin-row">
              <label className="fin-label" style={{ flex: 1 }}>شهر المناسبة (1-12)
                <input className="fin-input" type="number" min="1" max="12" value={form.seasonMonth} onChange={e => f("seasonMonth", e.target.value)} />
              </label>
              <label className="fin-label" style={{ flex: 1 }}>اقتطاع شهري (ر.س)
                <input className="fin-input" type="number" min="0" value={form.monthlySetAside} onChange={e => f("monthlySetAside", e.target.value)} />
              </label>
            </div>
          )}

          <label className="fin-label">تاريخ البدء
            <input className="fin-input" type="date" value={form.startDate} onChange={e => f("startDate", e.target.value)} />
          </label>

          <label className="fin-label">ملاحظات
            <textarea className="fin-input fin-textarea" value={form.notes} onChange={e => f("notes", e.target.value)} placeholder="اختياري" />
          </label>
        </div>

        <div className="fin-modal__actions">
          <button className="fin-btn-primary" onClick={save}>💾 حفظ</button>
          <button className="fin-btn-secondary" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
