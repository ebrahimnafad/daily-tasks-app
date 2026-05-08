import { useState } from 'react';
import type { ShiftType, ShiftConfig } from '@/features/tasks/data/scheduleConfig';
import type { NotifPerm } from '@/types';
import ScheduleSettingsModal from './ScheduleSettingsModal';

interface TasksHeaderProps {
  today: string;
  notifPerm: NotifPerm;
  requestNotifPerm: () => void;
  sendToSheets: () => void;
  resetNewDay: () => void;
  shift: ShiftType;
  setShift: (shift: ShiftType) => void;
  scheduleConfig: ShiftConfig[];
  setScheduleConfig: (config: ShiftConfig[] | ((prev: ShiftConfig[]) => ShiftConfig[])) => void;
}

export default function TasksHeader({
  today,
  notifPerm,
  requestNotifPerm,
  sendToSheets,
  resetNewDay,
  shift,
  setShift,
  scheduleConfig,
  setScheduleConfig,
}: TasksHeaderProps) {
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  return (
    <>
      <header className="th-header">
        <div className="th-date">{today}</div>
        <h1 className="th-title">مهام اليوم</h1>
        <div className="th-subtitle">بسم الله الرحمن الرحيم</div>

        <div className="th-actions">
          {notifPerm !== 'granted' && (
            <button className="toggle-btn th-btn-notif" onClick={requestNotifPerm}>
              🔔 تفعيل الإشعارات
            </button>
          )}
          <button className="toggle-btn th-btn-sheets" onClick={sendToSheets}>
            📊 إرسال التقرير لـ Sheets
          </button>
          <button className="toggle-btn th-btn-reset" onClick={resetNewDay}>
            🔄 بدء يوم جديد
          </button>
          <button className="toggle-btn th-btn-settings" onClick={() => setShowScheduleModal(true)}>
            ⚙️ إعدادات
          </button>
          <div className="th-shift-group">
            <button
              className={`toggle-btn th-btn-shift ${shift === 'morning' ? 'on' : ''}`}
              onClick={() => setShift('morning')}
              aria-pressed={shift === 'morning' ? 'true' : 'false'}
            >
              ☀️ صباحي
            </button>
            <button
              className={`toggle-btn th-btn-shift ${shift === 'evening' ? 'on' : ''}`}
              onClick={() => setShift('evening')}
              aria-pressed={shift === 'evening' ? 'true' : 'false'}
            >
              🌙 مسائي
            </button>
          </div>
        </div>
        <div className="th-shift-hint">
          {shift === 'morning' ? '🌅 أنت في الأسبوع الصباحي' : '🌆 أنت في الأسبوع المسائي'}
        </div>
      </header>

      <ScheduleSettingsModal
        isOpen={showScheduleModal}
        schedule={scheduleConfig}
        onSave={setScheduleConfig}
        onClose={() => setShowScheduleModal(false)}
      />
    </>
  );
}
