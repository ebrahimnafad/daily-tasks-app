import { useState } from 'react';
import type { ShiftConfig, TimeBlock } from '@/features/tasks/data/scheduleConfig';
import '../tasks.css'; // Use existing tasks styling

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
      className="confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-settings-title"
    >
      <div
        className="confirm-box"
        style={{ maxHeight: '90vh', overflowY: 'auto', maxWidth: '600px' }}
      >
        <div
          id="schedule-settings-title"
          style={{
            color: 'var(--text-gold)',
            fontSize: 'var(--font-lg)',
            fontWeight: 700,
            marginBottom: 'var(--space-md)',
          }}
        >
          ⚙️ إعدادات الجدول
        </div>

        {/* Shift Selector */}
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--space-sm)', fontWeight: 600 }}>
            اختر نوع الأسبوع
          </label>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            {editingSchedule.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedShiftId(s.id)}
                style={{
                  flex: 1,
                  padding: 'var(--space-sm)',
                  border:
                    selectedShiftId === s.id ? '2px solid var(--gold)' : '1px solid var(--gold)',
                  backgroundColor:
                    selectedShiftId === s.id ? 'rgba(var(--gold-rgb),.1)' : 'transparent',
                  color: 'var(--gold)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Off Days Section */}
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--space-sm)', fontWeight: 600 }}>
            أيام الإجازة
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 'var(--space-sm)',
            }}
          >
            {days.map((day, idx) => (
              <button
                key={idx}
                onClick={() => handleAddOffDay(idx)}
                style={{
                  padding: 'var(--space-sm)',
                  border: selectedShift.offDays.includes(idx)
                    ? '2px solid var(--gold)'
                    : '1px solid rgba(var(--gold-rgb),.3)',
                  backgroundColor: selectedShift.offDays.includes(idx)
                    ? 'rgba(var(--gold-rgb),.2)'
                    : 'transparent',
                  color: 'var(--gold)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: 'var(--font-sm)',
                }}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Friday Schedule Section */}
        <div
          style={{
            marginBottom: 'var(--space-lg)',
            padding: 'var(--space-md)',
            backgroundColor: 'rgba(var(--gold-rgb),.05)',
            borderRadius: '4px',
          }}
        >
          <label style={{ display: 'block', marginBottom: 'var(--space-sm)', fontWeight: 600 }}>
            جدول يوم الجمعة
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div>
              <label style={{ fontSize: 'var(--font-sm)' }}>الوقت (بداية)</label>
              <input
                type="time"
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
                style={{
                  width: '100%',
                  padding: 'var(--space-sm)',
                  marginTop: 'var(--space-xs)',
                  backgroundColor: 'rgba(var(--gold-rgb),.1)',
                  border: '1px solid var(--gold)',
                  color: 'var(--gold)',
                  borderRadius: '4px',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 'var(--font-sm)' }}>الوقت (نهاية)</label>
              <input
                type="time"
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
                style={{
                  width: '100%',
                  padding: 'var(--space-sm)',
                  marginTop: 'var(--space-xs)',
                  backgroundColor: 'rgba(var(--gold-rgb),.1)',
                  border: '1px solid var(--gold)',
                  color: 'var(--gold)',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-md)' }}>
            <label style={{ fontSize: 'var(--font-sm)' }}>الوصف</label>
            <input
              type="text"
              value={selectedShift.fridaySchedule.label}
              onChange={(e) =>
                handleUpdateShift({
                  fridaySchedule: {
                    ...selectedShift.fridaySchedule,
                    label: e.target.value,
                  },
                })
              }
              style={{
                width: '100%',
                padding: 'var(--space-sm)',
                marginTop: 'var(--space-xs)',
                backgroundColor: 'rgba(var(--gold-rgb),.1)',
                border: '1px solid var(--gold)',
                color: 'var(--gold)',
                borderRadius: '4px',
              }}
            />
          </div>
        </div>

        {/* Time Blocks Section */}
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-md)',
            }}
          >
            <label style={{ fontWeight: 600 }}>الكتل الزمنية</label>
            <button
              onClick={handleAddBlock}
              style={{
                padding: '4px 12px',
                backgroundColor: 'rgba(var(--gold-rgb),.2)',
                border: '1px solid var(--gold)',
                color: 'var(--gold)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: 'var(--font-sm)',
              }}
            >
              + إضافة كتلة
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {selectedShift.blocks.map((block) => (
              <div
                key={block.id}
                style={{
                  padding: 'var(--space-md)',
                  backgroundColor: 'rgba(var(--gold-rgb),.05)',
                  borderRadius: '4px',
                  border: '1px solid rgba(var(--gold-rgb),.1)',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 'var(--space-sm)',
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  <div>
                    <label style={{ fontSize: 'var(--font-sm)' }}>الأيقونة</label>
                    <input
                      type="text"
                      value={block.icon}
                      onChange={(e) => handleUpdateBlock(block.id, { icon: e.target.value })}
                      maxLength={2}
                      style={{
                        width: '100%',
                        padding: 'var(--space-sm)',
                        marginTop: 'var(--space-xs)',
                        backgroundColor: 'rgba(var(--gold-rgb),.1)',
                        border: '1px solid var(--gold)',
                        color: 'var(--gold)',
                        borderRadius: '4px',
                        textAlign: 'center',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 'var(--font-sm)' }}>الاسم</label>
                    <input
                      type="text"
                      value={block.label}
                      onChange={(e) => handleUpdateBlock(block.id, { label: e.target.value })}
                      style={{
                        width: '100%',
                        padding: 'var(--space-sm)',
                        marginTop: 'var(--space-xs)',
                        backgroundColor: 'rgba(var(--gold-rgb),.1)',
                        border: '1px solid var(--gold)',
                        color: 'var(--gold)',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 'var(--space-sm)',
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  <div>
                    <label style={{ fontSize: 'var(--font-sm)' }}>البداية (الساعة)</label>
                    <input
                      type="time"
                      value={block.startHour.toString().padStart(2, '0').slice(0, 2) + ':00'}
                      onChange={(e) => {
                        const [hours] = e.target.value.split(':').map(Number);
                        handleUpdateBlock(block.id, { startHour: hours });
                      }}
                      style={{
                        width: '100%',
                        padding: 'var(--space-sm)',
                        marginTop: 'var(--space-xs)',
                        backgroundColor: 'rgba(var(--gold-rgb),.1)',
                        border: '1px solid var(--gold)',
                        color: 'var(--gold)',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 'var(--font-sm)' }}>النهاية (الساعة)</label>
                    <input
                      type="time"
                      value={block.endHour.toString().padStart(2, '0').slice(0, 2) + ':00'}
                      onChange={(e) => {
                        const [hours] = e.target.value.split(':').map(Number);
                        handleUpdateBlock(block.id, { endHour: hours });
                      }}
                      style={{
                        width: '100%',
                        padding: 'var(--space-sm)',
                        marginTop: 'var(--space-xs)',
                        backgroundColor: 'rgba(var(--gold-rgb),.1)',
                        border: '1px solid var(--gold)',
                        color: 'var(--gold)',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--space-md)',
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-xs)',
                      fontSize: 'var(--font-sm)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={block.isOptional || false}
                      onChange={(e) =>
                        handleUpdateBlock(block.id, { isOptional: e.target.checked })
                      }
                      style={{ cursor: 'pointer' }}
                    />
                    اختياري
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-xs)',
                      fontSize: 'var(--font-sm)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={block.isRest || false}
                      onChange={(e) => handleUpdateBlock(block.id, { isRest: e.target.checked })}
                      style={{ cursor: 'pointer' }}
                    />
                    راحة
                  </label>
                </div>

                <button
                  onClick={() => handleDeleteBlock(block.id)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-sm)',
                    backgroundColor: 'rgba(244, 67, 54, 0.2)',
                    border: '1px solid #f44336',
                    color: '#f44336',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  🗑️ حذف الكتلة
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: 'var(--space-md)',
              backgroundColor: 'rgba(var(--gold-rgb),.2)',
              border: '1px solid var(--gold)',
              color: 'var(--gold)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            ✅ حفظ التغييرات
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: 'var(--space-md)',
              backgroundColor: 'rgba(var(--gold-rgb),.1)',
              border: '1px solid rgba(var(--gold-rgb),.3)',
              color: 'var(--gold)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
