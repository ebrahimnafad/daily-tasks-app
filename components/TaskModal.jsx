/**
 * TaskModal.jsx — نافذة إضافة / تعديل المهمة
 *
 * التحسينات:
 *  ① Focus Trap: حبس التنقل بالـ Tab داخل الـ Modal
 *  ② Escape Key: إغلاق الـ Modal بالضغط على Escape
 *  ③ aria-modal + role="dialog" + aria-labelledby للوصولية الكاملة
 *  ④ autoFocus على حقل الاسم عند الفتح
 */

import { useEffect, useRef, memo } from "react";

const CATEGORIES = [
  { label: "عبادة", color: "var(--gold)" },
  { label: "عمل",   color: "#6e9fcf" },
  { label: "أسرة",  color: "#9bc87a" },
  { label: "صحة",   color: "#9bc87a" },
  { label: "تنبيه", color: "#d97e6a" },
  { label: "شخصي",  color: "#b07ecf" },
  { label: "أخرى",  color: "#aaaaaa" },
];
const ICONS = ["📋","📧","📖","🕌","🚶","🚫","💊","🏃","🛒","📞","✏️","🍽️","💧","📚","🎯","🧹","💼","🌙","⭐","🔔"];
const TIMES = [
  "الصباح الباكر","الصباح","الضحى","قبل الظهر","الظهر",
  "بعد الظهر","العصر","بعد العصر","المغرب",
  "بين المغرب والعشاء","العشاء","الليل","طوال اليوم",
];
const RECURRENCE_OPTIONS = ["يومي","أيام العمل","أسبوعي","مرة واحدة"];

function TaskModal({ modal, form, onFormField, onSave, onClose }) {
  const titleId    = "modal-title";
  const modalRef   = useRef(null);
  const titleInput = useRef(null);

  // ── autoFocus على حقل الاسم عند الفتح ──────────────────────────────────
  useEffect(() => {
    // تأخير صغير لضمان انتهاء الـ animation أولاً
    const t = setTimeout(() => titleInput.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [modal]);

  // ── Escape Key لإغلاق الـ Modal ─────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // ── Focus Trap: يحبس التنقل بالـ Tab داخل الـ Modal ────────────────────
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;

    const focusableSelectors =
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleTab = (e) => {
      if (e.key !== "Tab") return;
      const focusable = Array.from(el.querySelectorAll(focusableSelectors));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };

    el.addEventListener("keydown", handleTab);
    return () => el.removeEventListener("keydown", handleTab);
  }, []);

  // ── معالج تعديل بلوكرز / هيلبرز ─────────────────────────────────────────
  const handleBlockerChange = (i, val) => {
    const arr = [...form.blockers];
    arr[i] = val;
    onFormField("blockers", arr);
  };
  const handleHelperChange = (i, val) => {
    const arr = [...form.helpers];
    arr[i] = val;
    onFormField("helpers", arr);
  };

  if (!modal) return null;

  return (
    /* Overlay */
    <div
      className="ov"
      onClick={onClose}
      role="presentation"
      aria-hidden="false"
    >
      {/* Modal Box */}
      <div
        ref={modalRef}
        className="mb"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id={titleId}
          style={{
            margin: "0 0 20px",
            color: "var(--text-gold)",
            fontSize: 20, fontWeight: 700,
            borderBottom: "1px solid rgba(var(--gold-rgb),.15)",
            paddingBottom: 14,
          }}
        >
          {modal.mode === "add" ? "➕ مهمة جديدة" : "✏️ تعديل المهمة"}
        </h2>

        {/* الأيقونة */}
        <div className="sg">
          <label className="ml" id="icon-label">الأيقونة</label>
          <div className="ig" role="radiogroup" aria-labelledby="icon-label">
            {ICONS.map((ic) => (
              <div
                key={ic}
                className={`io ${form.icon === ic ? "sel" : ""}`}
                role="radio"
                aria-checked={form.icon === ic}
                aria-label={ic}
                tabIndex={form.icon === ic ? 0 : -1}
                onClick={() => onFormField("icon", ic)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") { e.preventDefault(); onFormField("icon", ic); }
                }}
              >
                {ic}
              </div>
            ))}
          </div>
        </div>

        {/* اسم المهمة */}
        <div className="sg">
          <label className="ml" htmlFor="task-title">اسم المهمة *</label>
          <input
            id="task-title"
            ref={titleInput}
            className="mi"
            placeholder="اكتب المهمة هنا..."
            value={form.title}
            onChange={(e) => onFormField("title", e.target.value)}
          />
        </div>

        {/* التصنيف + الوقت */}
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="ml" htmlFor="task-category">التصنيف</label>
            <select
              id="task-category"
              className="ms"
              value={form.category}
              onChange={(e) => onFormField("category", e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.label} value={c.label}>{c.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="ml" htmlFor="task-time">الوقت</label>
            <select
              id="task-time"
              className="ms"
              value={form.time}
              onChange={(e) => onFormField("time", e.target.value)}
            >
              {TIMES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* التكرار + وقت التنبيه */}
        <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <label className="ml" htmlFor="task-recurrence">التكرار</label>
            <select
              id="task-recurrence"
              className="ms"
              value={form.recurrence}
              onChange={(e) => onFormField("recurrence", e.target.value)}
            >
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="ml" htmlFor="task-alert">وقت التنبيه (اختياري)</label>
            <input
              id="task-alert"
              type="time"
              className="ms"
              value={form.alertTime || ""}
              onChange={(e) => onFormField("alertTime", e.target.value)}
            />
          </div>
        </div>

        {/* تبديل التنبيه الأحمر */}
        <div
          className="sg"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <label className="ml" style={{ margin: 0 }} id="warning-label">
            🚫 تنبيه مهم (تأشير أحمر)
          </label>
          <button
            role="switch"
            aria-checked={form.isWarning}
            aria-labelledby="warning-label"
            className="tg"
            style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}
            onClick={() => onFormField("isWarning", !form.isWarning)}
          >
            <div className={`tgtr ${form.isWarning ? "on" : ""}`} aria-hidden="true" />
            <div className={`tgth ${form.isWarning ? "on" : ""}`} aria-hidden="true" />
          </button>
        </div>

        {/* العوائق */}
        <div className="sg">
          <label className="ml">⚠️ العوائق المحتملة</label>
          {form.blockers.map((b, i) => (
            <input
              key={i}
              className="mi"
              style={{ marginBottom: 7 }}
              placeholder={`عائق ${i + 1}...`}
              value={b}
              aria-label={`عائق ${i + 1}`}
              onChange={(e) => handleBlockerChange(i, e.target.value)}
            />
          ))}
        </div>

        {/* المساعدات */}
        <div className="sg">
          <label className="ml">✅ المساعدات</label>
          {form.helpers.map((h, i) => (
            <input
              key={i}
              className="mi"
              style={{ marginBottom: 7 }}
              placeholder={`مساعدة ${i + 1}...`}
              value={h}
              aria-label={`مساعدة ${i + 1}`}
              onChange={(e) => handleHelperChange(i, e.target.value)}
            />
          ))}
        </div>

        {/* أزرار الحفظ والإلغاء */}
        <button
          className="svbtn"
          disabled={!form.title.trim()}
          onClick={onSave}
        >
          {modal.mode === "add" ? "إضافة المهمة" : "حفظ التعديلات"}
        </button>
        <button className="cxbtn" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </div>
  );
}

export default memo(TaskModal);
export { CATEGORIES };
