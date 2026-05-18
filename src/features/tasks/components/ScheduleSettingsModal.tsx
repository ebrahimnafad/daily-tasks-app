import { useState } from 'react';
import type { Task } from '@/types';
import type { ShiftConfig, TimeBlock } from '@/features/tasks/data/scheduleConfig';
import '../tasks.css';
import '../schedule-settings.css';

// ── Time helpers ─────────────────────────────────────────────────────
// e.g. 13.5 → "13:30", 0.5 → "00:30", 4 → "04:00"
function decimalHourToHHmm(decimal: number): string {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// e.g. "13:30" → 13.5, "00:30" → 0.5, "04:00" → 4
function hhmmToDecimalHour(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h + m / 60;
}

interface ScheduleSettingsModalProps {
  isOpen: boolean;
  schedule: ShiftConfig[];
  onSave: (newSchedule: ShiftConfig[]) => void;
  onClose: () => void;
  dayStartHour: number;
  setDayStartHour: (hour: number) => void;
  /** Needed for orphan-task cleanup when a block is deleted. */
  tasks: Task[];
  setTasks: (updater: (prev: Task[]) => Task[]) => void;
}

export default function ScheduleSettingsModal({
  isOpen,
  schedule,
  onSave,
  onClose,
  dayStartHour,
  setDayStartHour,
  tasks,
  setTasks,
}: ScheduleSettingsModalProps) {
  const [editingSchedule, setEditingSchedule] = useState<ShiftConfig[]>(schedule);
  const [selectedShiftId, setSelectedShiftId] = useState<string>(schedule[0]?.id || 'morning');
  const [selectedDay, setSelectedDay] = useState<'default' | number>('default');
  // Cross-shift block creation: which shifts the new block will be added to
  const [pendingShifts, setPendingShifts] = useState<string[]>([selectedShiftId]);
  const [showShiftPicker, setShowShiftPicker] = useState(false);

  if (!isOpen) return null;

  const selectedShift = editingSchedule.find((s) => s.id === selectedShiftId) || editingSchedule[0];
  if (!selectedShift) return null;

  const handleUpdateShift = (updates: Partial<ShiftConfig>) => {
    setEditingSchedule((prev) =>
      prev.map((s) => (s.id === selectedShiftId ? { ...s, ...updates } : s))
    );
  };

  // Generate a stable short ID for new blocks (NOT Date.now() — must be
  // identical across shifts for cross-shift matching to work)
  const genBlockId = () => 'block-' + Math.random().toString(36).slice(2, 8);

  /** Add a new block to all shifts in `pendingShifts`, with the same ID. */
  const handleAddBlock = () => {
    const id = genBlockId();
    const newBlock: TimeBlock = {
      id,
      label: 'كتلة جديدة',
      icon: '📌',
      startHour: 0,
      endHour: 1,
    };
    setEditingSchedule((prev) =>
      prev.map((s) => {
        if (!pendingShifts.includes(s.id)) return s;
        if (selectedDay === 'default') {
          return { ...s, blocks: [...s.blocks, newBlock] };
        }
        const overrides = s.dayOverrides?.[selectedDay as number] || [];
        return {
          ...s,
          dayOverrides: {
            ...s.dayOverrides,
            [selectedDay as number]: [...overrides, newBlock],
          },
        };
      })
    );
    setShowShiftPicker(false);
    // Reset pending shifts back to only the current selected shift
    setPendingShifts([selectedShiftId]);
  };

  /** Delete a block and reassign any orphaned tasks to 'anytime'. */
  const handleDeleteBlock = (blockId: string) => {
    if (!window.confirm('حذف هذه الكتلة الزمنية؟')) return;
    // Reassign tasks that reference this block to 'anytime' before removing the block
    const orphanCount = tasks.filter((t) => t.timeBlock === blockId).length;
    if (orphanCount > 0) {
      setTasks((prev) =>
        prev.map((t) => (t.timeBlock === blockId ? { ...t, timeBlock: 'anytime' } : t))
      );
    }
    if (selectedDay === 'default') {
      handleUpdateShift({
        blocks: selectedShift.blocks.filter((b) => b.id !== blockId),
      });
    } else {
      const overrides = selectedShift.dayOverrides?.[selectedDay] || [];
      handleUpdateShift({
        dayOverrides: {
          ...selectedShift.dayOverrides,
          [selectedDay]: overrides.filter((b) => b.id !== blockId),
        },
      });
    }
  };

  const handleUpdateBlock = (blockId: string, updates: Partial<TimeBlock>) => {
    if (selectedDay === 'default') {
      handleUpdateShift({
        blocks: selectedShift.blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b)),
      });
    } else {
      const overrides = selectedShift.dayOverrides?.[selectedDay] || [];
      handleUpdateShift({
        dayOverrides: {
          ...selectedShift.dayOverrides,
          [selectedDay]: overrides.map((b) => (b.id === blockId ? { ...b, ...updates } : b)),
        },
      });
    }
  };

  const handleCustomizeDay = () => {
    if (selectedDay === 'default') return;
    handleUpdateShift({
      dayOverrides: {
        ...selectedShift.dayOverrides,
        [selectedDay]: selectedShift.blocks.map((b) => ({
          ...b,
          id: `block-${Date.now()}-${b.id}`,
        })),
      },
    });
  };

  const handleRemoveCustomization = () => {
    if (selectedDay === 'default') return;
    if (!window.confirm('إلغاء تخصيص هذا اليوم والعودة للجدول الافتراضي؟')) return;
    const newOverrides = { ...selectedShift.dayOverrides };
    delete newOverrides[selectedDay];
    handleUpdateShift({ dayOverrides: newOverrides });
  };

  const handleAddOffDay = (day: number) => {
    const offDays = selectedShift.offDays.includes(day)
      ? selectedShift.offDays.filter((d) => d !== day)
      : [...selectedShift.offDays, day];
    handleUpdateShift({ offDays });
  };

  const handleSave = () => {
    onSave(editingSchedule);
    onClose();
  };

  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-settings-title"
      onClick={onClose}
    >
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="ss-header">
          <h2 id="schedule-settings-title" className="ss-title">
            ⚙️ إعدادات الجدول
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        {/* General Settings */}
        <div className="ss-card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="ss-section-title">⏰ إعدادات عامة</div>
          <div className="ss-input-group">
            <label className="ss-label" htmlFor="day-start-hour">
              وقت بداية اليوم
              <span
                style={{
                  fontSize: '0.8em',
                  color: 'rgba(var(--gold-rgb), 0.5)',
                  marginRight: '6px',
                }}
              >
                (المهام والإحصائيات تُحسب من هذا الوقت)
              </span>
            </label>
            <input
              id="day-start-hour"
              type="time"
              className="form-input"
              value={`${String(dayStartHour).padStart(2, '0')}:00`}
              onChange={(e) => {
                const [hours] = e.target.value.split(':').map(Number);
                setDayStartHour(hours);
              }}
            />
            {dayStartHour > 0 && (
              <div
                style={{
                  marginTop: 'var(--space-sm)',
                  fontSize: 'var(--font-sm)',
                  color: 'rgba(var(--gold-rgb), 0.55)',
                }}
              >
                ℹ️ اليوم يبدأ الساعة {dayStartHour}:00 — أي وقت قبلها يُعدّ من اليوم السابق.
              </div>
            )}
          </div>
        </div>

        {/* Shift Selector Tabs */}
        <div className="ss-tabs" role="tablist">
          {editingSchedule.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={selectedShiftId === s.id}
              className={`ss-tab ${selectedShiftId === s.id ? 'active' : ''}`}
              onClick={() => setSelectedShiftId(s.id)}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Off Days Section */}
        <div>
          <div className="ss-section-title">🏖️ أيام الإجازة</div>
          <div className="ss-chips-grid">
            {days.map((day, idx) => {
              const isOff = selectedShift.offDays.includes(idx);
              return (
                <div
                  key={idx}
                  className={`ss-chip ${isOff ? 'selected' : ''}`}
                  onClick={() => handleAddOffDay(idx)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOffDay(idx);
                    }
                  }}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>

        {/* Week Start Hour — per shift */}
        <div className="ss-card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="ss-section-title">🔄 بداية الأسبوع الجديد</div>
          <div className="ss-input-group">
            <label className="ss-label" htmlFor={`week-start-hour-${selectedShift.id}`}>
              وقت تبدّل الأسبوع (يوم الجمعة)
              <span
                style={{
                  fontSize: '0.8em',
                  color: 'rgba(var(--gold-rgb), 0.5)',
                  marginRight: '6px',
                }}
              >
                (الوقت الذي يُعدّ فيه الجمعة بداية للأسبوع الجديد)
              </span>
            </label>
            <input
              id={`week-start-hour-${selectedShift.id}`}
              type="time"
              className="form-input"
              value={decimalHourToHHmm(selectedShift.weekStartHour ?? 0)}
              onChange={(e) =>
                handleUpdateShift({ weekStartHour: hhmmToDecimalHour(e.target.value) })
              }
            />
            {(selectedShift.weekStartHour ?? 0) > 0 && (
              <div
                style={{
                  marginTop: 'var(--space-sm)',
                  fontSize: 'var(--font-sm)',
                  color: 'rgba(var(--gold-rgb), 0.55)',
                }}
              >
                ℹ️ أي وقت قبل {decimalHourToHHmm(selectedShift.weekStartHour ?? 0)} يوم الجمعة يُعدّ
                من الأسبوع السابق.
              </div>
            )}
          </div>
        </div>

        {/* Friday Schedule Section */}
        <div className="ss-card">
          <div className="ss-section-title">🕌 جدول يوم الجمعة الخاص</div>
          <div className="ss-grid-2">
            <div className="ss-input-group">
              <label className="ss-label" htmlFor="friday-start">
                وقت البداية
              </label>
              <input
                id="friday-start"
                type="time"
                className="form-input"
                value={decimalHourToHHmm(selectedShift.fridaySchedule.start)}
                onChange={(e) => {
                  handleUpdateShift({
                    fridaySchedule: {
                      ...selectedShift.fridaySchedule,
                      start: hhmmToDecimalHour(e.target.value),
                    },
                  });
                }}
              />
            </div>
            <div className="ss-input-group">
              <label className="ss-label" htmlFor="friday-end">
                وقت النهاية
              </label>
              <input
                id="friday-end"
                type="time"
                className="form-input"
                value={decimalHourToHHmm(selectedShift.fridaySchedule.end)}
                onChange={(e) => {
                  handleUpdateShift({
                    fridaySchedule: {
                      ...selectedShift.fridaySchedule,
                      end: hhmmToDecimalHour(e.target.value),
                    },
                  });
                }}
              />
            </div>
          </div>
          <div className="ss-input-group" style={{ marginTop: 'var(--space-md)' }}>
            <label className="ss-label" htmlFor="friday-label">
              وصف فترة الجمعة
            </label>
            <input
              id="friday-label"
              type="text"
              className="form-input"
              value={selectedShift.fridaySchedule.label}
              onChange={(e) =>
                handleUpdateShift({
                  fridaySchedule: {
                    ...selectedShift.fridaySchedule,
                    label: e.target.value,
                  },
                })
              }
            />
          </div>
        </div>

        {/* Time Blocks Section */}
        <div>
          <div
            className="ss-blocks-header"
            style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}
          >
            <div className="ss-section-title" style={{ marginBottom: 0 }}>
              ⏱️ الكتل الزمنية
            </div>

            {/* Day Selector */}
            <div className="ss-tabs" role="tablist" style={{ marginTop: 0, flexWrap: 'wrap' }}>
              <button
                role="tab"
                aria-selected={selectedDay === 'default'}
                className={`ss-tab ${selectedDay === 'default' ? 'active' : ''}`}
                onClick={() => setSelectedDay('default')}
              >
                الجدول الافتراضي
              </button>
              {days.map((day, idx) => (
                <button
                  key={idx}
                  role="tab"
                  aria-selected={selectedDay === idx}
                  className={`ss-tab ${selectedDay === idx ? 'active' : ''}`}
                  onClick={() => setSelectedDay(idx)}
                >
                  {day} {selectedShift.dayOverrides?.[idx] ? '⚙️' : ''}
                </button>
              ))}
            </div>

            <div
              style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}
            >
              {selectedDay !== 'default' && !selectedShift.dayOverrides?.[selectedDay] && (
                <button className="btn-cancel" onClick={handleCustomizeDay}>
                  تخصيص هذا اليوم
                </button>
              )}
              {selectedDay !== 'default' && selectedShift.dayOverrides?.[selectedDay] && (
                <button
                  className="btn-cancel"
                  style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                  onClick={handleRemoveCustomization}
                >
                  إلغاء التخصيص
                </button>
              )}
              {(selectedDay === 'default' || selectedShift.dayOverrides?.[selectedDay]) && (
                <>
                  {showShiftPicker ? (
                    // Inline shift picker shown before confirming block addition
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'rgba(var(--gold-rgb), 0.07)',
                        border: '1px solid rgba(var(--gold-rgb), 0.2)',
                        borderRadius: 'var(--radius-md)',
                        padding: '6px 12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{ fontSize: 'var(--font-sm)', color: 'rgba(var(--gold-rgb), 0.7)' }}
                      >
                        أضف إلى:
                      </span>
                      {editingSchedule.map((s) => (
                        <label
                          key={s.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            fontSize: 'var(--font-sm)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={pendingShifts.includes(s.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPendingShifts((p) => [...p, s.id]);
                              } else {
                                // Always keep at least one shift checked
                                if (pendingShifts.length > 1) {
                                  setPendingShifts((p) => p.filter((id) => id !== s.id));
                                }
                              }
                            }}
                          />
                          {s.icon} {s.label}
                        </label>
                      ))}
                      <button className="ss-add-btn" onClick={handleAddBlock}>
                        تأكيد
                      </button>
                      <button
                        className="btn-cancel"
                        style={{ padding: '4px 10px' }}
                        onClick={() => {
                          setShowShiftPicker(false);
                          setPendingShifts([selectedShiftId]);
                        }}
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button
                      className="ss-add-btn"
                      onClick={() => {
                        setPendingShifts([selectedShiftId]);
                        setShowShiftPicker(true);
                      }}
                    >
                      + إضافة كتلة
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div
            style={
              selectedDay !== 'default' && !selectedShift.dayOverrides?.[selectedDay]
                ? { opacity: 0.5, pointerEvents: 'none' }
                : {}
            }
          >
            {(selectedDay === 'default' || !selectedShift.dayOverrides?.[selectedDay]
              ? selectedShift.blocks
              : selectedShift.dayOverrides[selectedDay]
            ).map((block) => (
              <div key={block.id} className="ss-block-card">
                <button
                  className="icon-btn icon-btn--delete ss-block-delete"
                  aria-label="حذف الكتلة"
                  onClick={() => handleDeleteBlock(block.id)}
                >
                  🗑️
                </button>

                <div className="ss-grid-icon-name">
                  <div className="ss-input-group">
                    <label className="ss-label" htmlFor={`block-icon-${block.id}`}>
                      رمز
                    </label>
                    <select
                      id={`block-icon-${block.id}`}
                      className="form-select"
                      style={{ textAlign: 'center', padding: '12px 4px' }}
                      value={block.icon}
                      onChange={(e) => handleUpdateBlock(block.id, { icon: e.target.value })}
                    >
                      {![
                        '📌',
                        '🌅',
                        '☕',
                        '🏢',
                        '💻',
                        '🍽️',
                        '🏃',
                        '📚',
                        '🕌',
                        '🚗',
                        '🛒',
                        '🎮',
                        '🌙',
                        '💤',
                        '🗓️',
                        '🏋️',
                        '🧠',
                        '💡',
                        '🎧',
                        '🧹',
                        '🛠️',
                        '👨‍👩‍👧‍👦',
                        '💼',
                      ].includes(block.icon) && <option value={block.icon}>{block.icon}</option>}
                      {[
                        '📌',
                        '🌅',
                        '☕',
                        '🏢',
                        '💻',
                        '🍽️',
                        '🏃',
                        '📚',
                        '🕌',
                        '🚗',
                        '🛒',
                        '🎮',
                        '🌙',
                        '💤',
                        '🗓️',
                        '🏋️',
                        '🧠',
                        '💡',
                        '🎧',
                        '🧹',
                        '🛠️',
                        '👨‍👩‍👧‍👦',
                        '💼',
                      ].map((icon) => (
                        <option key={icon} value={icon}>
                          {icon}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ss-input-group">
                    <label className="ss-label" htmlFor={`block-label-${block.id}`}>
                      اسم الكتلة
                    </label>
                    <input
                      id={`block-label-${block.id}`}
                      type="text"
                      className="form-input"
                      value={block.label}
                      onChange={(e) => handleUpdateBlock(block.id, { label: e.target.value })}
                    />
                  </div>
                </div>

                <div className="ss-grid-2">
                  <div className="ss-input-group">
                    <label className="ss-label" htmlFor={`block-start-${block.id}`}>
                      من الساعة
                    </label>
                    <input
                      id={`block-start-${block.id}`}
                      type="time"
                      className="form-input"
                      value={decimalHourToHHmm(block.startHour)}
                      onChange={(e) => {
                        handleUpdateBlock(block.id, {
                          startHour: hhmmToDecimalHour(e.target.value),
                        });
                      }}
                    />
                  </div>
                  <div className="ss-input-group">
                    <label className="ss-label" htmlFor={`block-end-${block.id}`}>
                      إلى الساعة
                    </label>
                    <input
                      id={`block-end-${block.id}`}
                      type="time"
                      className="form-input"
                      value={decimalHourToHHmm(block.endHour)}
                      onChange={(e) => {
                        handleUpdateBlock(block.id, { endHour: hhmmToDecimalHour(e.target.value) });
                      }}
                    />
                  </div>
                </div>

                <div className="ss-toggles">
                  <label className="ss-toggle-label" htmlFor={`block-opt-${block.id}`}>
                    <input
                      id={`block-opt-${block.id}`}
                      type="checkbox"
                      className="ss-toggle-checkbox"
                      checked={block.isOptional || false}
                      onChange={(e) =>
                        handleUpdateBlock(block.id, { isOptional: e.target.checked })
                      }
                    />
                    وقت اختياري
                  </label>
                  <label className="ss-toggle-label" htmlFor={`block-rest-${block.id}`}>
                    <input
                      id={`block-rest-${block.id}`}
                      type="checkbox"
                      className="ss-toggle-checkbox"
                      checked={block.isRest || false}
                      onChange={(e) => handleUpdateBlock(block.id, { isRest: e.target.checked })}
                    />
                    وقت راحة/نوم
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="ss-actions">
          <button className="btn-cancel" onClick={onClose}>
            إلغاء
          </button>
          <button className="btn-save" onClick={handleSave}>
            ✅ حفظ التغييرات
          </button>
        </div>
      </div>
    </div>
  );
}
