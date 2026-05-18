import { useState, useRef, useEffect } from 'react';
import type { Task } from '@/types';
import type { ShiftType, ShiftConfig } from '@/features/tasks/data/scheduleConfig';
import type { NotifPerm } from '@/types';
import ScheduleSettingsModal from './ScheduleSettingsModal';
import { useTaskContext } from '@/features/tasks/context/TaskContext';

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
  tasks: Task[];
  setTasks: (updater: (prev: Task[]) => Task[]) => void;
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
  tasks,
  setTasks,
}: TasksHeaderProps) {
  const { dayStartHour, setDayStartHour } = useTaskContext();
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  return (
    <>
      <header className="th-header" style={{ position: 'relative' }}>
        {/* Date and Settings */}
        <div className="th-date-row">
          <div className="th-shift-icon" style={{ fontSize: '18px' }}>
            {shift === 'morning' ? '☀️' : '🌙'}
          </div>
          <div className="th-date">{today}</div>
          <div className="th-menu-container" ref={menuRef}>
            <button
              className="icon-btn th-gear-btn"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="إعدادات المهام"
            >
              ⚙️
            </button>

            {isMenuOpen && (
              <div className="th-dropdown-menu" style={{ left: 0, right: 'auto' }}>
                {notifPerm !== 'granted' && (
                  <button
                    className="th-menu-item th-menu-item--notif"
                    onClick={() => {
                      requestNotifPerm();
                      setIsMenuOpen(false);
                    }}
                  >
                    🔔 تفعيل الإشعارات
                  </button>
                )}
                <button
                  className="th-menu-item th-menu-item--sheets"
                  onClick={() => {
                    sendToSheets();
                    setIsMenuOpen(false);
                  }}
                >
                  📊 إرسال التقرير لـ Sheets
                </button>
                <button
                  className="th-menu-item"
                  onClick={() => {
                    resetNewDay();
                    setIsMenuOpen(false);
                  }}
                >
                  🔄 بدء يوم جديد
                </button>
                <button
                  className="th-menu-item"
                  onClick={() => {
                    setShowScheduleModal(true);
                    setIsMenuOpen(false);
                  }}
                >
                  ⚙️ إعدادات الجدول
                </button>

                <div className="th-menu-divider"></div>
                <div className="th-menu-label">فترة الدوام:</div>
                <div className="th-shift-group-menu">
                  <button
                    className={`toggle-btn th-btn-shift ${shift === 'morning' ? 'on' : ''}`}
                    onClick={() => {
                      setShift('morning');
                      setIsMenuOpen(false);
                    }}
                    aria-pressed={shift === 'morning' ? 'true' : 'false'}
                  >
                    ☀️ صباحي
                  </button>
                  <button
                    className={`toggle-btn th-btn-shift ${shift === 'evening' ? 'on' : ''}`}
                    onClick={() => {
                      setShift('evening');
                      setIsMenuOpen(false);
                    }}
                    aria-pressed={shift === 'evening' ? 'true' : 'false'}
                  >
                    🌙 مسائي
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <h1 className="th-title">مهام اليوم</h1>
        <div className="th-subtitle">بسم الله الرحمن الرحيم</div>
      </header>

      <ScheduleSettingsModal
        isOpen={showScheduleModal}
        schedule={scheduleConfig}
        onSave={setScheduleConfig}
        onClose={() => setShowScheduleModal(false)}
        dayStartHour={dayStartHour}
        setDayStartHour={setDayStartHour}
        tasks={tasks}
        setTasks={setTasks}
      />
    </>
  );
}
