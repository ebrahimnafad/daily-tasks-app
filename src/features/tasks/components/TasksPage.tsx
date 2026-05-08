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
  } = tm;

  const shiftConfig = scheduleConfig.find((s) => s.id === shift) || scheduleConfig[0];

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
      />

      {/* Current block indicator */}
      {currentBlockId && (
        <div className="tpg-current-block" role="status" aria-live="polite">
          {(() => {
            const block = shiftConfig.blocks.find((b) => b.id === currentBlockId);
            return block ? (
              <>
                <span className="tpg-current-block__label">الآن</span>
                <span className="tpg-current-block__name">
                  {block.icon} {block.label}
                </span>
                {block.isOptional && <span className="tpg-current-block__tag">اختياري</span>}
              </>
            ) : null;
          })()}
        </div>
      )}

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
                <div className="tpg-block__header">
                  <span className="tpg-block__icon">{block.icon}</span>
                  <span className="tpg-block__label">{block.label}</span>
                  {isCurrent && <span className="tpg-block__now-badge">الآن ✨</span>}
                  {block.isOptional && <span className="tpg-block__optional">اختياري</span>}
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

              {/* Other task cards */}
              {block.id !== 'prayer' &&
                blockTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isChecked={!!checked[task.id]}
                    taskSubChecked={taskSubCheckedMap[task.id]}
                  />
                ))}
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
