import { useState, useEffect } from 'react';
import { useTaskContext } from '@/features/tasks/context/TaskContext';
import { TaskCard, TasksHeader, TasksProgress } from '@/features/tasks';
import type { ShiftType } from '@/features/tasks/data/scheduleConfig';

interface TasksPageProps {
  today: string;
  shift: ShiftType;
  setShift: (shift: ShiftType) => void;
}

export default function TasksPage({ today, shift, setShift }: TasksPageProps) {
  const {
    tm,
    prayersDone,
    prayerTotal,
    notifPerm,
    requestNotifPerm,
    scheduleConfig,
    setScheduleConfig,
  } = useTaskContext();
  const {
    progress,
    countDone,
    totalOther,
    taskSubCheckedMap,
    checked,
    sendToSheets,
    resetNewDay,
    tasksByBlock,
    currentBlockId,
    prayerTask,
    setForm,
    setModal,
  } = tm;
  const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({});
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const toggleBlock = (blockId: string) => {
    setCollapsedBlocks((prev) => ({ ...prev, [blockId]: !prev[blockId] }));
  };

  const addTaskToBlock = (blockId: string) => {
    setForm({
      ...tm.form,
      shifts: [shift],
      timeBlock: blockId,
    });
    setModal({ mode: 'add' });
  };

  const shiftConfig = scheduleConfig.find((s) => s.id === shift) || scheduleConfig[0];

  const getBlockProgress = (startHour: number, endHour: number) => {
    const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;
    let effEnd = endHour;
    let effCurrent = currentHour;

    // Handle midnight wrap-around
    if (endHour <= startHour) {
      effEnd += 24;
      if (currentHour < startHour) effCurrent += 24;
    }

    if (effCurrent < startHour) return 0;
    if (effCurrent >= effEnd) return 100;
    return ((effCurrent - startHour) / (effEnd - startHour)) * 100;
  };

  return (
    <div className="tpg-main">
      {/* Header */}
      <TasksHeader
        today={today}
        notifPerm={notifPerm}
        requestNotifPerm={requestNotifPerm}
        sendToSheets={sendToSheets}
        resetNewDay={resetNewDay}
        shift={shift}
        setShift={setShift}
        scheduleConfig={scheduleConfig}
        setScheduleConfig={setScheduleConfig}
      />

      {/* Progress */}
      <TasksProgress
        progress={progress}
        prayersDone={prayersDone}
        prayerTotal={prayerTotal}
        countDone={countDone}
        totalOther={totalOther}
        currentBlock={shiftConfig.blocks.find((b) => b.id === currentBlockId)}
      />

      {/* Task blocks — grouped by time block */}
      <main aria-label="قائمة المهام">
        {tasksByBlock.length === 0 ? (
          <div className="tpg-empty">
            <span>🎉</span>
            <p>لا توجد مهام لهذا اليوم</p>
          </div>
        ) : (
          tasksByBlock.map(({ block, tasks: blockTasks, isCurrent }) => (
            <section
              key={block.id}
              className={`tpg-block${isCurrent ? ' tpg-block--current' : ''}`}
              aria-label={block.label}
            >
              {/* Block header — don't show for prayer (rendered separately above via TasksProgress) */}
              {block.id !== 'prayer' && (
                <div
                  className="tpg-block__header"
                  style={{ position: 'relative', overflow: 'hidden' }}
                >
                  {/* Timer Indicator Effect (Progress background) */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      bottom: 0,
                      width: `${getBlockProgress(block.startHour, block.endHour)}%`,
                      background: 'rgba(var(--gold-rgb), 0.08)',
                      zIndex: 0,
                      transition: 'width 60s linear',
                    }}
                    aria-hidden="true"
                  />

                  <div
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      gap: 'var(--space-sm)',
                    }}
                  >
                    <button
                      className="tpg-block__toggle"
                      onClick={() => toggleBlock(block.id)}
                      aria-expanded={!collapsedBlocks[block.id]}
                      aria-label={`${collapsedBlocks[block.id] ? '展开' : 'collapse'} ${block.label}`}
                    >
                      {collapsedBlocks[block.id] ? '◀' : '▼'}
                    </button>
                    <span className="tpg-block__icon">{block.icon}</span>
                    <span className="tpg-block__label">{block.label}</span>

                    {/* Time bounds display */}
                    <span
                      style={{
                        fontSize: '0.75em',
                        color: 'rgba(var(--gold-rgb), 0.5)',
                        marginInline: '4px',
                      }}
                    >
                      {block.startHour.toString().padStart(2, '0')}:00 -{' '}
                      {block.endHour.toString().padStart(2, '0')}:00
                    </span>

                    {isCurrent && <span className="tpg-block__now-badge">الآن ✨</span>}
                    {block.isOptional && <span className="tpg-block__optional">اختياري</span>}
                    <button
                      className="tpg-block__add-btn"
                      onClick={() => addTaskToBlock(block.id)}
                      aria-label={`إضافة مهمة لـ ${block.label}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Prayer task card */}
              {block.id === 'prayer' && prayerTask && (
                <TaskCard
                  task={prayerTask}
                  isChecked={!!checked[prayerTask.id]}
                  taskSubChecked={taskSubCheckedMap[prayerTask.id]}
                />
              )}

              {/* Other task cards - collapsible */}
              {block.id !== 'prayer' && !collapsedBlocks[block.id] && (
                <div className="tpg-block__tasks">
                  {blockTasks.length > 0 ? (
                    blockTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isChecked={!!checked[task.id]}
                        taskSubChecked={taskSubCheckedMap[task.id]}
                      />
                    ))
                  ) : (
                    <p
                      className="tpg-empty-block-msg"
                      style={{
                        textAlign: 'center',
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                        margin: '10px 0',
                      }}
                    >
                      لا توجد مهام مجدولة في هذه الفترة
                    </p>
                  )}
                </div>
              )}
            </section>
          ))
        )}
      </main>

      <button className="btn-add-task" onClick={tm.openAdd} aria-label="إضافة مهمة جديدة">
        <span className="tpg-fab-icon" aria-hidden="true">
          ＋
        </span>{' '}
        إضافة مهمة جديدة
      </button>

      {progress === 100 && tasksByBlock.length > 0 && (
        <div role="status" className="tpg-status">
          🌙 ما شاء الله! أتممت يومك بخير ✨
        </div>
      )}
      <footer className="tpg-footer">﴿ وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ﴾</footer>
    </div>
  );
}
