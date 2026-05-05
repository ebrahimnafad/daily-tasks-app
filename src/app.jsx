import { useState, useEffect, useCallback, useMemo } from "react";
import "./app.css";
import { useSync, todayISO } from "@/lib/sync";
import { useNotifications, useToasts } from "@/shared/hooks";
import { AppShell } from "@/shared/components";
import { TaskCard, useTaskManager, INITIAL_TASKS, TaskModal, TaskContext, TasksHeader, TasksProgress } from "@/features/tasks";
import { FinancePage } from "@/features/finance";

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("tasks");
  const toasts = useToasts();
  const { onQuota, onNewDay } = toasts;

  const { tasks, setTasks, checked, setChecked, subChecked, setSubChecked, shift, setShift, syncStatus } =
    useSync(INITIAL_TASKS, onNewDay);

  const { notifPerm, requestNotifPerm } = useNotifications(tasks);

  // ── UI State ─────────────────────────────────────────────────────────────
  const tm = useTaskManager(tasks, setTasks, checked, setChecked, subChecked, setSubChecked);
  const { progress, prayersDone, prayerTotal, countDone, totalOther, taskSubCheckedMap } = tm;

  // ── Dynamic Theme ─────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      const h = new Date().getHours();
      const theme = h >= 4 && h < 8 ? "dawn" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 19 ? "sunset" : "night";
      document.documentElement.setAttribute("data-theme", theme);
    };
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, []);

  const taskContextValue = useMemo(() => ({
    tm,
    setChecked,
    setSubChecked,
    prayersDone,
    prayerTotal,
  }), [tm, setChecked, setSubChecked, prayersDone, prayerTotal]);


  // ── Google Sheets Export ──────────────────────────────────────────────────
  const sendToSheets = useCallback(async () => {
    const url = localStorage.getItem("sheet_webhook_url") || window.prompt("أدخل رابط Google Apps Script (Web App URL):");
    if (!url) return;
    localStorage.setItem("sheet_webhook_url", url);
    try {
      await sendProgressToSheets(url, { 
        date: new Date().toLocaleDateString("en-GB"), 
        progress, 
        prayersDone, 
        prayerTotal, 
        tasksDone: countDone, 
        tasksTotal: totalOther 
      });
      alert("تم إرسال الطلب ✅\nتحقق من الـ Sheet مباشرة للتأكد.");
    } catch (e) { 
      alert("خطأ في الإرسال. تحقق من الرابط."); 
    }
  }, [progress, prayersDone, prayerTotal, countDone, totalOther]);

  // ── Reset New Day ─────────────────────────────────────────────────────────
  const resetNewDay = useCallback(() => {
    if (!window.confirm("تصفير المهام لبدء يوم جديد؟")) return;
    const day = new Date().getDay();
    const isWorkday = day !== 5 && day !== 6;
    const isStartOfWeek = day === 0;
    const toReset = tasks.filter(t => { const r = t.recurrence ?? "يومي"; return r === "يومي" || (r === "أيام العمل" && isWorkday) || (r === "أسبوعي" && isStartOfWeek); });
    const ids = toReset.map(t => t.id);
    setChecked(p    => { const n = { ...p }; ids.forEach(id => delete n[id]); return n; });
    setSubChecked(p => { const n = { ...p }; toReset.forEach(t => t.subtasks.forEach(s => delete n[s.id])); return n; });
  }, [tasks, setChecked, setSubChecked]);

  const today = new Date().toLocaleDateString("ar-EG", { weekday:"long", year:"numeric", month:"long", day:"numeric" });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      shift={shift} 
      syncStatus={syncStatus} 
      toasts={toasts}
    >
      {activeTab === "tasks" && (
      <div style={{ maxWidth:480, margin:"0 auto", padding:"24px 16px 100px" }}>

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
        <TaskContext.Provider value={taskContextValue}>
          <main aria-label="قائمة المهام">
            {tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isChecked={!!checked[task.id]}
                  taskSubChecked={taskSubCheckedMap[task.id]}
                />
            ))}
          </main>
        </TaskContext.Provider>

        <button className="addbtn" onClick={tm.openAdd} aria-label="إضافة مهمة جديدة">
          <span style={{ fontSize:20, lineHeight:1 }} aria-hidden="true">＋</span> إضافة مهمة جديدة
        </button>

        {progress === 100 && tasks.length > 1 && (
          <div role="status" style={{ textAlign:"center", marginTop:8, padding:"20px", background:"rgba(var(--gold-rgb),.08)", borderRadius:16, border:"1px solid rgba(var(--gold-rgb),.25)", color:"var(--gold)", fontSize:18, fontWeight:700 }}>
            🌙 ما شاء الله! أتممت يومك بخير ✨
          </div>
        )}
        <footer style={{ textAlign:"center", marginTop:32, color:"rgba(var(--gold-rgb),.22)", fontSize:13 }}>
          ﴿ وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ﴾
        </footer>
      </div>
      )}

      {activeTab === "finance" && (
        <FinancePage onQuota={toasts.onQuota} />
      )}

      {/* Add/Edit Modal */}
      <TaskModal modal={tm.modal} form={tm.form} onFormField={tm.setFormField} onSave={tm.saveTask} onClose={() => tm.setModal(null)} />

      {/* Delete Confirm */}
      {tm.deleteConfirm !== null && (
        <div className="cov" role="dialog" aria-modal="true" aria-labelledby="del-title">
          <div className="cbox">
            <div style={{ fontSize:36, marginBottom:12 }} aria-hidden="true">🗑️</div>
            <div id="del-title" style={{ color:"var(--text-gold)", fontSize:17, fontWeight:700, marginBottom:8 }}>حذف المهمة؟</div>
            <div style={{ color:"rgba(var(--gold-rgb),.6)", fontSize:14, marginBottom:22 }}>&quot;{tasks.find(t => t.id === tm.deleteConfirm)?.title}&quot;</div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => tm.deleteTask(tm.deleteConfirm)} style={{ flex:1, padding:"10px", borderRadius:10, border:"none", background:"#d97e6a", color:"white", fontFamily:"'Amiri',serif", fontSize:15, cursor:"pointer", fontWeight:700 }}>نعم، احذف</button>
              <button onClick={() => tm.setDeleteConfirm(null)}   style={{ flex:1, padding:"10px", borderRadius:10, background:"transparent", border:"1px solid rgba(var(--gold-rgb),.25)", color:"rgba(var(--gold-rgb),.7)", fontFamily:"'Amiri',serif", fontSize:15, cursor:"pointer" }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
