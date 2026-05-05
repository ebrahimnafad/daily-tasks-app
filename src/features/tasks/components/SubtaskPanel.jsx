import { useAccessibleClick } from "@/shared/hooks";
import { Tick } from "@/shared/components";

export function SubtaskPanel({
  task, taskSubChecked, newItemText,
  editingSubId, editingSubText,
  onToggleSub, onNewItemTextChange, onAddSubItem,
  onDeleteSubItem, onStartEditSub, onSaveEditSub,
  onCancelEditSub, onEditingSubTextChange,
  inputRef,
}) {
  const handleKeyDown = useAccessibleClick();
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
            <div
              role="checkbox"
              aria-checked={sdone}
              aria-label={s.text}
              tabIndex={0}
              className={`schk ${sdone ? "on" : ""}`}
              onClick={() => onToggleSub(s.id)}
              onKeyDown={(e) => handleKeyDown(e, () => onToggleSub(s.id))}
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
