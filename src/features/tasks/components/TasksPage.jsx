import { useTaskContext } from '@/features/tasks/context/TaskContext';
import { TaskCard, TasksHeader, TasksProgress } from '@/features/tasks';

export default function TasksPage({ today, shift, setShift }) {
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
    <div
      style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--space-xl) var(--space-lg) 100px' }}
    >
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

      <button className="addbtn" onClick={tm.openAdd} aria-label="إضافة مهمة جديدة">
        <span style={{ fontSize: 'var(--font-xl)', lineHeight: 1 }} aria-hidden="true">
          ＋
        </span>{' '}
        إضافة مهمة جديدة
      </button>

      {progress === 100 && tasks.length > 1 && (
        <div
          role="status"
          style={{
            textAlign: 'center',
            marginTop: 'var(--space-sm)',
            padding: 'var(--space-xl)',
            background: 'rgba(var(--gold-rgb),.08)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(var(--gold-rgb),.25)',
            color: 'var(--gold)',
            fontSize: 'var(--font-lg)',
            fontWeight: 700,
          }}
        >
          🌙 ما شاء الله! أتممت يومك بخير ✨
        </div>
      )}
      <footer
        style={{
          textAlign: 'center',
          marginTop: 'var(--space-xl)',
          color: 'rgba(var(--gold-rgb),.22)',
          fontSize: 'var(--font-base)',
        }}
      >
        ﴿ وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ﴾
      </footer>
    </div>
  );
}
