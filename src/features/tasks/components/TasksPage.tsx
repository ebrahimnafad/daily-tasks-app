import { useTaskContext } from '@/features/tasks/context/TaskContext';
import { TaskCard, TasksHeader, TasksProgress } from '@/features/tasks';

interface TasksPageProps {
  today: string;
  shift: string;
  setShift: (shift: string) => void;
}

export default function TasksPage({ today, shift, setShift }: TasksPageProps) {
  const { tm, prayersDone, prayerTotal, notifPerm, requestNotifPerm } = useTaskContext();
  const {
    progress,
    countDone,
    totalOther,
    taskSubCheckedMap,
    tasks,
    checked,
    sendToSheets,
    resetNewDay,
  } = tm;

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
      />

      {/* Progress */}
      <TasksProgress
        progress={progress}
        prayersDone={prayersDone}
        prayerTotal={prayerTotal}
        countDone={countDone}
        totalOther={totalOther}
      />

      {/* Task Cards */}
      <main aria-label="قائمة المهام">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            isChecked={!!checked[task.id]}
            taskSubChecked={taskSubCheckedMap[task.id]}
          />
        ))}
      </main>

      <button className="btn-add-task" onClick={tm.openAdd} aria-label="إضافة مهمة جديدة">
        <span className="tpg-fab-icon" aria-hidden="true">
          ＋
        </span>{' '}
        إضافة مهمة جديدة
      </button>

      {progress === 100 && tasks.length > 1 && (
        <div role="status" className="tpg-status">
          🌙 ما شاء الله! أتممت يومك بخير ✨
        </div>
      )}
      <footer className="tpg-footer">﴿ وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ﴾</footer>
    </div>
  );
}
