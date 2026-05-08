import { useState } from 'react';
import type { ShiftConfig, TimeBlock } from '@/features/tasks/data/scheduleConfig';
import '../tasks.css';
import '../schedule-settings.css';

interface ScheduleSettingsModalProps {
  isOpen: boolean;
  schedule: ShiftConfig[];
  onSave: (newSchedule: ShiftConfig[]) => void;
  onClose: () => void;
}

export default function ScheduleSettingsModal({
  isOpen,
  schedule,
  onSave,
  onClose,
}: ScheduleSettingsModalProps) {
  const [editingSchedule, setEditingSchedule] = useState<ShiftConfig[]>(schedule);
  const [selectedShiftId, setSelectedShiftId] = useState<string>(schedule[0]?.id || 'morning');

  if (!isOpen) return null;

  const selectedShift = editingSchedule.find((s) => s.id === selectedShiftId) || editingSchedule[0];
  if (!selectedShift) return null;

  const handleUpdateShift = (updates: Partial<ShiftConfig>) => {
    setEditingSchedule((prev) =>
      prev.map((s) => (s.id === selectedShiftId ? { ...s, ...updates } : s))
    );
  };

  const handleAddBlock = () => {
    const newBlock: TimeBlock = {
      id: `block-${Date.now()}`,
      label: 'كتلة جديدة',
      icon: '📌',
      startHour: 0,
      endHour: 1,
    };
    handleUpdateShift({
      blocks: [...selectedShift.blocks, newBlock],
    });
  };

  const handleDeleteBlock = (blockId: string) => {
    handleUpdateShift({
      blocks: selectedShift.blocks.filter((b) => b.id !== blockId),
    });
  };

  const handleUpdateBlock = (blockId: string, updates: Partial<TimeBlock>) => {
    handleUpdateShift({
      blocks: selectedShift.blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b)),
    });
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
                value={
                  selectedShift.fridaySchedule.start.toString().padStart(2, '0').slice(0, 2) + ':00'
                }
                onChange={(e) => {
                  const [hours] = e.target.value.split(':').map(Number);
                  handleUpdateShift({
                    fridaySchedule: {
                      ...selectedShift.fridaySchedule,
                      start: hours,
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
                value={
                  selectedShift.fridaySchedule.end.toString().padStart(2, '0').slice(0, 2) + ':00'
                }
                onChange={(e) => {
                  const [hours] = e.target.value.split(':').map(Number);
                  handleUpdateShift({
                    fridaySchedule: {
                      ...selectedShift.fridaySchedule,
                      end: hours,
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
          <div className="ss-blocks-header">
            <div className="ss-section-title" style={{ marginBottom: 0 }}>
              ⏱️ الكتل الزمنية (يومياً)
            </div>
            <button className="ss-add-btn" onClick={handleAddBlock}>
              + إضافة كتلة
            </button>
          </div>

          <div>
            {selectedShift.blocks.map((block) => (
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
                    <input
                      id={`block-icon-${block.id}`}
                      type="text"
                      className="form-input"
                      style={{ textAlign: 'center' }}
                      value={block.icon}
                      onChange={(e) => handleUpdateBlock(block.id, { icon: e.target.value })}
                      maxLength={2}
                    />
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
                      value={block.startHour.toString().padStart(2, '0').slice(0, 2) + ':00'}
                      onChange={(e) => {
                        const [hours] = e.target.value.split(':').map(Number);
                        handleUpdateBlock(block.id, { startHour: hours });
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
                      value={block.endHour.toString().padStart(2, '0').slice(0, 2) + ':00'}
                      onChange={(e) => {
                        const [hours] = e.target.value.split(':').map(Number);
                        handleUpdateBlock(block.id, { endHour: hours });
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
          <button className="btn-secondary" onClick={onClose}>
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
