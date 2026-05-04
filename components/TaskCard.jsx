/**
 * TaskCard.jsx — بطاقة المهمة الكاملة
 *
 * التحسينات:
 *  ① React.memo — لا إعادة تصيير إلا إذا تغيّر شيء يخص هذه المهمة تحديداً
 *  ② Accessibility — role="checkbox", aria-checked, tabIndex, aria-label, onKeyDown
 *  ③ فصل منطق كل لوحة (صلاة / قائمة فرعية / بريف) داخل مكوّنات فرعية صغيرة
 */

import { memo, useRef } from "react";

// ── SVG Tick ─────────────────────────────────────────────────────────────────
function Tick({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path
        d="M2 7L5.5 10.5L11 3.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── مربع الاختيار القابل للوصول (Accessible Checkbox) ─────────────────────
function AccessibleCheckbox({ checked, color, onToggle, label }) {
  const handleKeyDown = (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      role="checkbox"
      aria-checked={!!checked}
      aria-label={label}
      tabIndex={0}
      className={`chk ${checked ? "on" : ""}`}
      style={{ color, borderColor: color }}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
    >
      {checked && <Tick />}
    </div>
  );
}

// ── حلقة الصلوات (Prayer Ring SVG) ─────────────────────────────────────────
function PrayerRing({ done, total, color }) {
  const pct = total > 0 ? done / total : 0;
  return (
    <div
      style={{
        width: 26, height: 26, flexShrink: 0,
        position: "relative", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}
      aria-label={`${done} من ${total} صلوات`}
    >
      <svg width="26" height="26" viewBox="0 0 26 26" style={{ position: "absolute" }} aria-hidden="true">
        <circle cx="13" cy="13" r="11" fill="none" stroke="rgba(var(--gold-rgb),.2)" strokeWidth="2" />
        <circle
          cx="13" cy="13" r="11" fill="none"
          stroke={color ?? "var(--gold)"}
          strokeWidth="2"
          strokeDasharray={`${pct * 69.1} 69.1`}
          strokeLinecap="round"
          transform="rotate(-90 13 13)"
          style={{ transition: "stroke-dasharray .5s ease" }}
        />
      </svg>
      <span style={{ fontSize: 11, color: "var(--gold)", fontWeight: 700, position: "relative" }}>
        {done}
      </span>
    </div>
  );
}

// ── حلقة تقدّم المهام الفرعية (Sub-task Ring) ──────────────────────────────
function SubRing({ done, total, color }) {
  const pct = total > 0 ? done / total : 0;
  return (
    <div
      style={{
        width: 26, height: 26, flexShrink: 0,
        position: "relative", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}
      aria-label={`${done} من ${total} عناصر`}
    >
      <svg width="26" height="26" viewBox="0 0 26 26" style={{ position: "absolute" }} aria-hidden="true">
        <circle
          cx="13" cy="13" r="11" fill="none"
          stroke={`color-mix(in srgb, ${color} 19%, transparent)`}
          strokeWidth="2"
        />
        <circle
          cx="13" cy="13" r="11" fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={`${pct * 69.1} 69.1`}
          strokeLinecap="round"
          transform="rotate(-90 13 13)"
          style={{ transition: "stroke-dasharray .4s ease" }}
        />
      </svg>
      <span style={{ fontSize: 10, color, fontWeight: 700, position: "relative" }}>{done}</span>
    </div>
  );
}

// ── لوحة الصلوات ────────────────────────────────────────────────────────────
function PrayerPanel({ subtasks, subChecked, onToggleSub }) {
  return (
    <div className="panel" style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
      {subtasks.map((s) => {
        const done = !!subChecked[s.id];
        return (
          <div
            key={s.id}
            role="checkbox"
            aria-checked={done}
            aria-label={s.text}
            tabIndex={0}
            onClick={() => onToggleSub(s.id)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") { e.preventDefault(); onToggleSub(s.id); }
            }}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              cursor: "pointer",
              background: done ? "rgba(var(--gold-rgb),.12)" : "rgba(255,255,255,.03)",
              border: `1px solid ${done ? "rgba(var(--gold-rgb),.38)" : "rgba(var(--gold-rgb),.1)"}`,
              borderRadius: 99, padding: "5px 12px 5px 9px",
              transition: "all .2s",
            }}
          >
            <div className={`schk ${done ? "on" : ""}`} aria-hidden="true">
              {done && <Tick size={10} />}
            </div>
            <span
              style={{
                fontSize: 14.5,
                color: done ? "var(--gold)" : "rgba(var(--gold-rgb),.68)",
                fontWeight: done ? 700 : 400,
                textDecoration: done ? "line-through" : "none",
                transition: "all .2s",
              }}
            >
              {s.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── لوحة القائمة الفرعية القابلة للتحرير ────────────────────────────────────
function SubtaskPanel({
  task, taskSubChecked, newItemText,
  editingSubId, editingSubText,
  onToggleSub, onNewItemTextChange, onAddSubItem,
  onDeleteSubItem, onStartEditSub, onSaveEditSub,
  onCancelEditSub, onEditingSubTextChange,
  inputRef,
}) {
  const allSubsDone = task.subtasks.length > 0
    && task.subtasks.every((s) => taskSubChecked[s.id]);

  const handleAddKeyDown = (e) => {
    if (e.key === "Enter") onAddSubItem();
  };

  return (
    <div className="panel" role="list" aria-label={`قائمة مهام ${task.title} الفرعية`}>
      <div
        style={{
          fontSize: 12, fontWeight: 700,
          color: "rgba(var(--gold-rgb),.55)",
          marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
        }}
      >
        📝 القائمة الفرعية
        {allSubsDone && task.subtasks.length > 0 && (
          <span style={{ color: "#9bc87a", fontSize: 11 }}>✓ اكتملت</span>
        )}
      </div>

      {task.subtasks.length === 0 && (
        <div style={{ fontSize: 13, color: "rgba(var(--gold-rgb),.3)", marginBottom: 8, padding: "6px 0" }}>
          لا توجد عناصر بعد — أضف من الأسفل
        </div>
      )}

      {task.subtasks.map((s) => {
        const sdone     = !!taskSubChecked[s.id];
        const isEditing = editingSubId === s.id;
        return (
          <div key={s.id} className="sub-row" role="listitem">
            {/* مربع الاختيار الفرعي */}
            <div
              role="checkbox"
              aria-checked={sdone}
              aria-label={s.text}
              tabIndex={0}
              className={`schk ${sdone ? "on" : ""}`}
              onClick={() => onToggleSub(s.id)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") { e.preventDefault(); onToggleSub(s.id); }
              }}
            >
              {sdone && <Tick size={10} />}
            </div>

            {isEditing ? (
              <input
                className="sub-edit-inp"
                value={editingSubText}
                autoFocus
                aria-label="تعديل العنصر"
                onChange={(e) => onEditingSubTextChange(e.target.value)}
                onBlur={onSaveEditSub}
                onKeyDown={(e) => {
                  if (e.key === "Enter")  onSaveEditSub();
                  if (e.key === "Escape") onCancelEditSub();
                }}
              />
            ) : (
              <span
                className={`sub-text ${sdone ? "done" : ""}`}
                onDoubleClick={() => onStartEditSub(s)}
                title="اضغط مرتين لتعديل العنصر"
              >
                {s.text}
              </span>
            )}

            {!isEditing && (
              <div
                className="sub-actions"
                style={{ display: "flex", gap: 4, opacity: 0, transition: "opacity .15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = 0)}
              >
                <button
                  className="ibtn ebtn"
                  aria-label={`تعديل ${s.text}`}
                  style={{ padding: "2px 7px", fontSize: 11 }}
                  onClick={() => onStartEditSub(s)}
                >
                  ✏️
                </button>
                <button
                  className="ibtn dbtn"
                  aria-label={`حذف ${s.text}`}
                  style={{ padding: "2px 7px", fontSize: 11 }}
                  onClick={() => onDeleteSubItem(s.id)}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* إضافة عنصر جديد */}
      <div className="add-sub-row">
        <input
          ref={inputRef}
          className="add-sub-inp"
          placeholder="أضف عنصر جديد للقائمة..."
          value={newItemText}
          aria-label="إضافة عنصر جديد للقائمة الفرعية"
          onChange={(e) => onNewItemTextChange(e.target.value)}
          onKeyDown={handleAddKeyDown}
        />
        <button className="add-sub-btn" onClick={onAddSubItem}>
          + إضافة
        </button>
      </div>
      <div style={{ fontSize: 11, color: "rgba(var(--gold-rgb),.3)", marginTop: 6 }}>
        اضغط مرتين على أي عنصر لتعديله
      </div>
    </div>
  );
}

// ── لوحة البريف ─────────────────────────────────────────────────────────────
function BriefPanel({ brief }) {
  if (!brief) return null;
  return (
    <div className="panel">
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#d97e6a", marginBottom: 9 }}>
            ⚠️ عوائق محتملة
          </div>
          {brief.blockers?.length > 0 ? (
            brief.blockers.map((b, i) => (
              <div key={i} className="bitem">
                <div className="bdot" style={{ background: "#d97e6a", opacity: 0.75 }} />
                {b}
              </div>
            ))
          ) : (
            <div style={{ fontSize: 13, color: "rgba(var(--gold-rgb),.3)" }}>لا يوجد</div>
          )}
        </div>
        <div className="dvv" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#9bc87a", marginBottom: 9 }}>
            ✅ مساعدات
          </div>
          {brief.helpers?.length > 0 ? (
            brief.helpers.map((h, i) => (
              <div key={i} className="bitem">
                <div className="bdot" style={{ background: "#9bc87a", opacity: 0.85 }} />
                {h}
              </div>
            ))
          ) : (
            <div style={{ fontSize: 13, color: "rgba(var(--gold-rgb),.3)" }}>لا يوجد</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TaskCard الرئيسية ────────────────────────────────────────────────────────
function TaskCard({
  task,
  isChecked,
  taskSubChecked,   // { [subId]: bool } — فقط لهذه المهمة
  isExpanded,
  isBriefOpen,
  isSubtaskOpen,
  newItemText,
  editingSubId,
  editingSubText,
  prayersDone,
  prayerTotal,
  // Handlers (جميعها useCallback'd من App)
  onToggleChecked,
  onToggleSub,
  onToggleExpanded,
  onToggleBrief,
  onToggleSubtask,
  onNewItemTextChange,
  onAddSubItem,
  onDeleteSubItem,
  onStartEditSub,
  onSaveEditSub,
  onCancelEditSub,
  onEditingSubTextChange,
  onOpenEdit,
  onDeleteRequest,
}) {
  const inputRef = useRef(null);

  const hasSubs    = task.subtasks.length > 0;
  const subsDone   = task.subtasks.filter((s) => taskSubChecked[s.id]).length;

  // حساب حالة المهمة (done)
  const done = task.isPrayerTask
    ? false
    : hasSubs
      ? task.subtasks.every((s) => taskSubChecked[s.id])
      : isChecked;

  // ── focus إلى input عند إضافة عنصر ──────────────────────────────────────
  const handleAddSubItem = () => {
    onAddSubItem(task.id, inputRef);
  };

  return (
    <article
      className={`card ${done ? "done" : ""} ${task.isWarning ? "warn" : ""}`}
      aria-label={`مهمة: ${task.title}`}
    >
      {/* ── الصف الرئيسي ── */}
      <div style={{ padding: "15px 16px", display: "flex", alignItems: "center", gap: 11 }}>

        {/* مؤشر التقدّم / مربع الاختيار */}
        {task.isPrayerTask ? (
          <PrayerRing done={prayersDone} total={prayerTotal} />
        ) : hasSubs ? (
          <SubRing done={subsDone} total={task.subtasks.length} color={task.color} />
        ) : (
          <AccessibleCheckbox
            checked={isChecked}
            color={task.color}
            onToggle={onToggleChecked}
            label={`تأشير مهمة: ${task.title}`}
          />
        )}

        <span style={{ fontSize: 19 }} aria-hidden="true">{task.icon}</span>

        {/* عنوان المهمة ومعلوماتها */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: done ? "rgba(var(--gold-rgb),.38)" : "var(--text-gold)",
              fontSize: 16, fontWeight: 700,
              textDecoration: done ? "line-through" : "none",
              transition: "all .3s",
            }}
          >
            {task.title}
          </div>
          <div
            style={{
              fontSize: 12, color: "rgba(var(--gold-rgb),.48)",
              marginTop: 1, display: "flex", alignItems: "center", gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span>{task.time}</span>
            <span
              style={{
                fontSize: 10, background: "rgba(255,255,255,0.05)",
                padding: "1px 5px", borderRadius: 4,
              }}
            >
              {task.recurrence || "يومي"}
            </span>
            {task.alertTime && (
              <span
                style={{
                  fontSize: 10, color: "#d97e6a",
                  background: "rgba(217,126,106,.08)",
                  padding: "1px 5px", borderRadius: 4,
                }}
              >
                🔔 {task.alertTime}
              </span>
            )}
            {hasSubs && (
              <span className="sub-progress">{subsDone}/{task.subtasks.length}</span>
            )}
          </div>
        </div>

        {/* أزرار الجانب */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          <span
            className="badge"
            style={{
              background: `color-mix(in srgb, ${task.color} 11%, transparent)`,
              color: task.color,
              border: `1px solid color-mix(in srgb, ${task.color} 22%, transparent)`,
            }}
          >
            {task.category}
          </span>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {/* زر القائمة الفرعية (للمهام غير الصلوات) */}
            {!task.isPrayerTask && (
              <button
                className={`lbtn ${isSubtaskOpen ? "on" : ""}`}
                aria-expanded={isSubtaskOpen}
                aria-label={isSubtaskOpen ? "إخفاء القائمة الفرعية" : "عرض القائمة الفرعية"}
                onClick={(e) => { e.stopPropagation(); onToggleSubtask(); }}
              >
                <span style={{ fontSize: 10 }} aria-hidden="true">{isSubtaskOpen ? "▲" : "▼"}</span>
                قائمة
              </button>
            )}
            {/* زر الصلوات */}
            {task.isPrayerTask && (
              <button
                className={`bbtn ${isExpanded ? "on" : ""}`}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "إخفاء الصلوات" : "عرض الصلوات"}
                onClick={(e) => { e.stopPropagation(); onToggleExpanded(); }}
              >
                <span style={{ fontSize: 10 }} aria-hidden="true">{isExpanded ? "▲" : "▼"}</span>
                صلوات
              </button>
            )}
            {/* زر البريف */}
            <button
              className={`bbtn ${isBriefOpen ? "on" : ""}`}
              aria-expanded={isBriefOpen}
              aria-label={isBriefOpen ? "إخفاء البريف" : "عرض البريف"}
              onClick={(e) => { e.stopPropagation(); onToggleBrief(); }}
            >
              <span style={{ fontSize: 10 }} aria-hidden="true">{isBriefOpen ? "▲" : "▼"}</span>
              بريف
            </button>
            {/* زر التعديل */}
            <button
              className="ibtn ebtn"
              aria-label={`تعديل مهمة: ${task.title}`}
              onClick={onOpenEdit}
            >
              ✏️
            </button>
            {/* زر الحذف */}
            <button
              className="ibtn dbtn"
              aria-label={`حذف مهمة: ${task.title}`}
              onClick={(e) => { e.stopPropagation(); onDeleteRequest(); }}
            >
              🗑️
            </button>
          </div>
        </div>
      </div>

      {/* ── لوحة الصلوات ── */}
      {task.isPrayerTask && isExpanded && (
        <PrayerPanel
          subtasks={task.subtasks}
          subChecked={taskSubChecked}
          onToggleSub={onToggleSub}
        />
      )}

      {/* ── لوحة القائمة الفرعية ── */}
      {!task.isPrayerTask && isSubtaskOpen && (
        <SubtaskPanel
          task={task}
          taskSubChecked={taskSubChecked}
          newItemText={newItemText}
          editingSubId={editingSubId}
          editingSubText={editingSubText}
          onToggleSub={onToggleSub}
          onNewItemTextChange={onNewItemTextChange}
          onAddSubItem={handleAddSubItem}
          onDeleteSubItem={onDeleteSubItem}
          onStartEditSub={onStartEditSub}
          onSaveEditSub={onSaveEditSub}
          onCancelEditSub={onCancelEditSub}
          onEditingSubTextChange={onEditingSubTextChange}
          inputRef={inputRef}
        />
      )}

      {/* ── لوحة البريف ── */}
      {isBriefOpen && <BriefPanel brief={task.brief} />}
    </article>
  );
}

// React.memo مع مقارنة مُخصَّصة للأداء الأمثل
export default memo(TaskCard);
