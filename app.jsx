import { useState, useEffect, useCallback, useMemo } from "react";
import "./app.css";
import { useRegisterSW } from "virtual:pwa-register/react";
import useSync, { todayISO } from "./hooks/useSync.js";
import useNotifications from "./hooks/useNotifications.js";
import TaskCard from "./components/TaskCard.jsx";
import TaskModal, { CATEGORIES } from "./components/TaskModal.jsx";
import TabBar from "./components/TabBar.jsx";
import FinancePage from "./components/FinancePage.jsx";

// ── Constants ────────────────────────────────────────────────────────────────
const INITIAL_TASKS = [
  { id:1, icon:"🕌", title:"الصلوات الخمس", subtasks:[{id:"s1",text:"الفجر"},{id:"s2",text:"الظهر"},{id:"s3",text:"العصر"},{id:"s4",text:"المغرب"},{id:"s5",text:"العشاء"}], isPrayerTask:true, category:"عبادة", color:"var(--gold)", time:"طوال اليوم", isWarning:false, recurrence:"يومي", brief:{blockers:["النوم بعد الفجر","الانشغال بالشاشات وقت الأذان","الكسل والتأجيل"],helpers:["ضبط منبه لكل أذان","تطبيق أذان على الموبايل","الوضوء المبكر قبل الوقت"]} },
  { id:2, icon:"📧", title:"الرد على إيميلات العمل", subtasks:[{id:"e1",text:"إيميل المورد بخصوص الشحنة"},{id:"e2",text:"رد على استفسار العميل الجديد"},{id:"e3",text:"تأكيد موعد الاجتماع الأسبوعي"}], isPrayerTask:false, category:"عمل", color:"#6e9fcf", time:"الصباح", isWarning:false, recurrence:"أيام العمل", brief:{blockers:["فتح السوشيال ميديا أول الصبح","كتر الإيميلات وعدم التصفية","التسويف لـ'الوقت المناسب'"],helpers:["وقت ثابت في الصباح للإيميلات بس","ابدأ بأهم 3 رسائل فقط","اغلق التاب بعد الخلاص"]} },
  { id:3, icon:"📋", title:"تحديث ملف الريفيل للوصفات", subtasks:[], isPrayerTask:false, category:"عمل", color:"#6e9fcf", time:"الصباح", isWarning:false, recurrence:"أيام العمل", brief:{blockers:["عدم وضوح التعديلات المطلوبة","انتظار معلومات من طرف تاني","التشتت بين أكتر من مهمة"],helpers:["راجع الملف الحالي الأول","خصص 30 دقيقة بدون مقاطعة","احفظ نسخة احتياطية قبل التعديل"]} },
  { id:4, icon:"📖", title:"حصة درس المد لأحمد", subtasks:[], isPrayerTask:false, category:"أسرة", color:"#9bc87a", time:"بعد الظهر", isWarning:false, recurrence:"أيام العمل", alertTime:"16:00", brief:{blockers:["تعب أحمد أو عدم تركيزه","مقاطعات المنزل وقت الحصة","عدم تحضير المادة مسبقاً"],helpers:["اختار وقت بعد أكل وراحة قصيرة","جهز اللوح والورقة قبل الجلسة","حفزه بمكافأة صغيرة بعد الحصة"]} },
  { id:5, icon:"🚫", title:"ممنوع النوم بعد العصر", subtasks:[], isPrayerTask:false, category:"تنبيه", color:"#d97e6a", time:"بعد العصر", isWarning:true, recurrence:"يومي", brief:{blockers:["الإحساس بالتعب بعد الظهر","الجو الحر والخمول","عدم وجود نشاط يشغلك"],helpers:["اشرب كوباية مية باردة بعد العصر","ابدأ بأي حركة بسيطة في البيت","افتكر إن النوم هيخرب نوم الليل"]} },
  { id:6, icon:"🚶", title:"خروج للمشي بين المغرب والعشاء", subtasks:[], isPrayerTask:false, category:"صحة", color:"#9bc87a", time:"المساء", isWarning:false, recurrence:"يومي", brief:{blockers:["الإحساس بالتعب بعد يوم طويل","إغراء الجلوس بعد المغرب","الطقس السيء أو الحر الشديد"],helpers:["جهز حذاء المشي قبل المغرب","اصحب أحمد معاك تشجيعاً ليه","مسار قصير 15-20 دقيقة بس يكفي"]} },
];

const EMPTY_FORM = { icon:"📋", title:"", category:"أخرى", color:"#aaaaaa", time:"الصباح", isWarning:false, recurrence:"يومي", alertTime:"", blockers:["","",""], helpers:["","",""] };
const uid = () => crypto.randomUUID();

// ── SyncBadge ────────────────────────────────────────────────────────────────
function SyncBadge({ status }) {
  const map = {
    syncing:{ icon:"⏳", text:"جاري الحفظ...",   cls:"syncing" },
    synced: { icon:"☁️", text:"محفوظ سحابياً",   cls:"synced"  },
    offline:{ icon:"💾", text:"محفوظ محلياً",    cls:"offline" },
    error:  { icon:"⚠️", text:"خطأ في المزامنة", cls:"error"   },
  };
  const { icon, text, cls } = map[status] ?? map.offline;
  return (
    <div className={`sync-badge ${cls}`} role="status" aria-live="polite">
      <span aria-hidden="true">{icon}</span><span>{text}</span>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("tasks");
  const [quotaError, setQuotaError] = useState(false);
  const [newDayToast, setNewDayToast] = useState(false);

  // ── PWA: تنبيه عند توفر تحديث للـ Service Worker ─────────────────
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // فحص تحديثات الـ SW كل ساعة
      if (r) setInterval(() => r.update(), 60 * 60 * 1000);
    },
  });

  const onQuota   = useCallback(() => setQuotaError(true),  []);
  const onNewDay  = useCallback(() => { setNewDayToast(true); setTimeout(() => setNewDayToast(false), 4000); }, []);

  const { tasks, setTasks, checked, setChecked, subChecked, setSubChecked, shift, setShift, syncStatus } =
    useSync(INITIAL_TASKS, onNewDay, onQuota);

  const { notifPerm, requestNotifPerm } = useNotifications(tasks);

  // ── UI State ─────────────────────────────────────────────────────────────
  const [expanded,       setExpanded]       = useState({ 1: true });
  const [briefOpen,      setBriefOpen]      = useState({});
  const [subtaskOpen,    setSubtaskOpen]    = useState({ 2: true });
  const [newItemText,    setNewItemText]    = useState({});
  const [editingSubId,   setEditingSubId]   = useState(null);
  const [editingSubText, setEditingSubText] = useState("");
  const [modal,          setModal]          = useState(null);
  const [form,           setForm]           = useState(EMPTY_FORM);
  const [deleteConfirm,  setDeleteConfirm]  = useState(null);
  const [nextId,         setNextId]         = useState(100);

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

  // ── Computed (useMemo) ────────────────────────────────────────────────────
  const { prayerTask, prayersDone, prayerTotal, otherTasks, countDone, totalOther, progress } = useMemo(() => {
    const pt = tasks.find(t => t.isPrayerTask);
    const pd = pt ? pt.subtasks.filter(s => subChecked[s.id]).length : 0;
    const pTotal = pt ? pt.subtasks.length : 0;
    const others = tasks.filter(t => !t.isPrayerTask);
    const done = others.filter(t => t.subtasks.length > 0 ? t.subtasks.every(s => subChecked[s.id]) : checked[t.id]).length;
    const total = others.length;
    const prog = (pTotal + total) === 0 ? 0 : Math.round(((pd + done) / (pTotal + total)) * 100);
    return { prayerTask: pt, prayersDone: pd, prayerTotal: pTotal, otherTasks: others, countDone: done, totalOther: total, progress: prog };
  }, [tasks, checked, subChecked]);

  // ── Subtask CRUD ──────────────────────────────────────────────────────────
  const addSubItem = useCallback((taskId, inputRef) => {
    const text = (newItemText[taskId] ?? "").trim();
    if (!text) return;
    setTasks(p => p.map(t => t.id === taskId ? { ...t, subtasks: [...t.subtasks, { id: uid(), text }] } : t));
    setNewItemText(p => ({ ...p, [taskId]: "" }));
    setTimeout(() => inputRef?.current?.focus(), 0);
  }, [newItemText, setTasks]);

  const deleteSubItem = useCallback((taskId, subId) => {
    setTasks(p => p.map(t => t.id === taskId ? { ...t, subtasks: t.subtasks.filter(s => s.id !== subId) } : t));
    setSubChecked(p => { const n = { ...p }; delete n[subId]; return n; });
  }, [setTasks, setSubChecked]);

  const startEditSub = useCallback((sub) => { setEditingSubId(sub.id); setEditingSubText(sub.text); }, []);
  const saveEditSub  = useCallback((taskId) => {
    const text = editingSubText.trim();
    if (text) setTasks(p => p.map(t => t.id === taskId ? { ...t, subtasks: t.subtasks.map(s => s.id === editingSubId ? { ...s, text } : s) } : t));
    setEditingSubId(null);
  }, [editingSubText, editingSubId, setTasks]);
  const cancelEditSub = useCallback(() => setEditingSubId(null), []);

  // ── Task CRUD ─────────────────────────────────────────────────────────────
  const openAdd  = useCallback(() => { setForm({ ...EMPTY_FORM }); setModal({ mode: "add" }); }, []);
  const openEdit = useCallback((task, e) => {
    e.stopPropagation();
    setForm({ icon:task.icon, title:task.title, category:task.category, color:task.color, time:task.time, isWarning:task.isWarning||false, recurrence:task.recurrence||"يومي", alertTime:task.alertTime||"", blockers:[...(task.brief?.blockers||[]),"","",""].slice(0,3), helpers:[...(task.brief?.helpers||[]),"","",""].slice(0,3) });
    setModal({ mode: "edit", taskId: task.id });
  }, []);

  const setFormField = useCallback((f, v) => {
    if (f === "category") {
      const c = CATEGORIES.find(x => x.label === v);
      setForm(p => ({ ...p, category: v, color: c ? c.color : "#aaaaaa" }));
    } else if (f === "blockers" || f === "helpers") {
      setForm(p => ({ ...p, [f]: v }));
    } else {
      setForm(p => ({ ...p, [f]: v }));
    }
  }, []);

  const saveTask = useCallback(() => {
    if (!form.title.trim()) return;
    const catObj = CATEGORIES.find(c => c.label === form.category);
    const color  = catObj ? catObj.color : "#aaaaaa";
    const patch  = { icon:form.icon, title:form.title.trim(), category:form.category, color, time:form.time, isWarning:form.isWarning, recurrence:form.recurrence, alertTime:form.alertTime||"", brief:{ blockers:form.blockers.filter(b=>b.trim()), helpers:form.helpers.filter(h=>h.trim()) } };
    if (modal.mode === "add") {
      setTasks(p => [...p, { id: nextId, isPrayerTask: false, subtasks: [], ...patch }]);
      setNextId(p => p + 1);
    } else {
      setTasks(p => p.map(t => t.id === modal.taskId ? { ...t, ...patch } : t));
    }
    setModal(null);
  }, [form, modal, nextId, setTasks]);

  const deleteTask = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    setTasks(p => p.filter(t => t.id !== id));
    setChecked(p => { const n = { ...p }; delete n[id]; return n; });
    if (task?.subtasks?.length) {
      setSubChecked(p => { const n = { ...p }; task.subtasks.forEach(s => delete n[s.id]); return n; });
    }
    setDeleteConfirm(null);
  }, [tasks, setTasks, setChecked, setSubChecked]);

  // ── Google Sheets Export ──────────────────────────────────────────────────
  const sendToSheets = useCallback(async () => {
    const url = localStorage.getItem("sheet_webhook_url") || window.prompt("أدخل رابط Google Apps Script (Web App URL):");
    if (!url) return;
    localStorage.setItem("sheet_webhook_url", url);
    try {
      await fetch(url, { method:"POST", mode:"no-cors", headers:{"Content-Type":"text/plain"}, body:JSON.stringify({ date:new Date().toLocaleDateString("en-GB"), progress, prayersDone, prayerTotal, tasksDone:countDone, tasksTotal:totalOther }) });
      alert("تم إرسال الطلب ✅\nتحقق من الـ Sheet مباشرة للتأكد.");
    } catch (e) { alert("خطأ في الإرسال. تحقق من الرابط."); console.error(e); }
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
    <div dir="rtl" data-shift={shift} style={{ minHeight:"100vh", background:"var(--bg-gradient)", fontFamily:"'Amiri',serif", transition:"background 0.6s ease" }}>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} financeBadge={0} />
      <SyncBadge status={syncStatus} />

      {/* تنبيه يوم جديد */}
      {newDayToast && (
        <div role="alert" style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", zIndex:300, background:"rgba(155,200,122,0.15)", border:"1px solid rgba(155,200,122,0.4)", borderRadius:12, padding:"10px 20px", color:"#9bc87a", fontSize:14, fontFamily:"'Amiri',serif", backdropFilter:"blur(8px)" }}>
          🌅 يوم جديد — تم تصفير المهام اليومية تلقائياً
        </div>
      )}

      {/* تنبيه امتلاء localStorage */}
      {quotaError && (
        <div role="alert" style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", zIndex:300, background:"rgba(217,126,106,0.15)", border:"1px solid rgba(217,126,106,0.4)", borderRadius:12, padding:"10px 20px", color:"#d97e6a", fontSize:14, fontFamily:"'Amiri',serif", backdropFilter:"blur(8px)" }}>
          ⚠️ ذاكرة المتصفح ممتلئة — لن يتم حفظ التغييرات محلياً
        </div>
      )}

      {/* تنبيه تحديث PWA: يظهر عند توفر نسخة جديدة من التطبيق */}
      {needRefresh && (
        <div role="alert" style={{ position:"fixed", bottom:56, left:"50%", transform:"translateX(-50%)", zIndex:300, background:"rgba(110,159,207,0.15)", border:"1px solid rgba(110,159,207,0.4)", borderRadius:12, padding:"10px 16px", color:"#6e9fcf", fontSize:13, fontFamily:"'Amiri',serif", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", gap:10, whiteSpace:"nowrap" }}>
          <span>🔄 يتوفر تحديث جديد للتطبيق</span>
          <button
            onClick={() => updateServiceWorker(true)}
            style={{ background:"rgba(110,159,207,0.2)", border:"1px solid rgba(110,159,207,0.4)", borderRadius:8, padding:"4px 12px", color:"#6e9fcf", fontFamily:"'Amiri',serif", fontSize:13, cursor:"pointer" }}
          >
            تحديث الآن
          </button>
        </div>
      )}

      <div style={{ position:"fixed", inset:0, pointerEvents:"none", backgroundImage:`radial-gradient(circle at 20% 20%,rgba(var(--gold-rgb),.06) 0%,transparent 50%),radial-gradient(circle at 80% 80%,rgba(var(--gold-rgb),.04) 0%,transparent 50%)` }} aria-hidden="true" />

      {activeTab === "tasks" && (
      <div style={{ maxWidth:480, margin:"0 auto", padding:"24px 16px 100px" }}>

        {/* Header */}
        <header style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:13, color:"rgba(var(--gold-rgb),.55)", marginBottom:6 }}>{today}</div>
          <h1 style={{ margin:0, fontSize:32, fontWeight:700, color:"var(--text-gold)", textShadow:"0 2px 20px rgba(var(--gold-rgb),.3)" }}>مهام اليوم</h1>
          <div style={{ marginTop:4, fontSize:13, color:"rgba(var(--gold-rgb),.45)" }}>بسم الله الرحمن الرحيم</div>

          <div style={{ marginTop:16, display:"flex", flexWrap:"wrap", justifyContent:"center", gap:12 }}>
            {notifPerm !== "granted" && (
              <button className="bbtn" onClick={requestNotifPerm} style={{ fontSize:13, padding:"6px 16px", background:"color-mix(in srgb, #d97e6a 10%, transparent)", color:"#d97e6a", borderColor:"color-mix(in srgb, #d97e6a 30%, transparent)" }}>
                🔔 تفعيل الإشعارات
              </button>
            )}
            <button className="bbtn" onClick={sendToSheets} style={{ fontSize:13, padding:"6px 16px", background:"color-mix(in srgb, #6e9fcf 10%, transparent)", color:"#6e9fcf", borderColor:"color-mix(in srgb, #6e9fcf 30%, transparent)" }}>
              📊 إرسال التقرير لـ Sheets
            </button>
            <button className="bbtn" onClick={resetNewDay} style={{ fontSize:13, padding:"6px 16px", background:"rgba(var(--gold-rgb),.1)" }}>
              🔄 بدء يوم جديد
            </button>
            <div style={{ background:"rgba(var(--gold-rgb),.05)", borderRadius:99, padding:4, display:"flex", gap:4 }}>
              <button className={`bbtn ${shift==="morning"?"on":""}`} onClick={() => setShift("morning")} style={{ fontSize:13, padding:"6px 16px" }} aria-pressed={shift==="morning"}>☀️ صباحي</button>
              <button className={`bbtn ${shift==="night"?"on":""}`}   onClick={() => setShift("night")}   style={{ fontSize:13, padding:"6px 16px" }} aria-pressed={shift==="night"}>🌙 مسائي</button>
            </div>
          </div>
          <div style={{ marginTop:8, fontSize:12, color:"rgba(var(--gold-rgb),.55)" }}>
            {shift === "morning" ? "🌅 أنت في الأسبوع الصباحي" : "🌆 أنت في الأسبوع المسائي"}
          </div>
        </header>

        {/* Progress */}
        <section aria-label="إجمالي التقدم" style={{ background:"rgba(var(--gold-rgb),.07)", border:"1px solid rgba(var(--gold-rgb),.2)", borderRadius:16, padding:"16px 20px", marginBottom:24 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ color:"var(--text-gold)", fontSize:14 }}>إجمالي الإنجاز</span>
            <span style={{ color:"var(--gold)", fontSize:22, fontWeight:700 }} aria-live="polite">{progress}٪</span>
          </div>
          <div className="pbar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`التقدم: ${progress}%`}>
            <div className="pfill" style={{ width:`${progress}%` }} />
          </div>
          <div style={{ marginTop:8, fontSize:12, color:"rgba(var(--gold-rgb),.45)", textAlign:"left" }}>
            {prayersDone}/{prayerTotal} صلوات · {countDone}/{totalOther} مهام
          </div>
        </section>

        {/* Task Cards */}
        <main aria-label="قائمة المهام">
          {tasks.map(task => {
            // حساب taskSubChecked لهذه المهمة فقط
            const taskSubChecked = {};
            task.subtasks.forEach(s => { taskSubChecked[s.id] = !!subChecked[s.id]; });

            return (
              <TaskCard
                key={task.id}
                task={task}
                isChecked={!!checked[task.id]}
                taskSubChecked={taskSubChecked}
                isExpanded={!!expanded[task.id]}
                isBriefOpen={!!briefOpen[task.id]}
                isSubtaskOpen={!!subtaskOpen[task.id]}
                newItemText={newItemText[task.id] ?? ""}
                editingSubId={editingSubId}
                editingSubText={editingSubText}
                prayersDone={prayersDone}
                prayerTotal={prayerTotal}
                onToggleChecked={() => setChecked(p => ({ ...p, [task.id]: !p[task.id] }))}
                onToggleSub={(subId) => setSubChecked(p => ({ ...p, [subId]: !p[subId] }))}
                onToggleExpanded={() => setExpanded(p => ({ ...p, [task.id]: !p[task.id] }))}
                onToggleBrief={() => setBriefOpen(p => ({ ...p, [task.id]: !p[task.id] }))}
                onToggleSubtask={() => setSubtaskOpen(p => ({ ...p, [task.id]: !p[task.id] }))}
                onNewItemTextChange={(v) => setNewItemText(p => ({ ...p, [task.id]: v }))}
                onAddSubItem={(tId, ref) => addSubItem(tId, ref)}
                onDeleteSubItem={(subId) => deleteSubItem(task.id, subId)}
                onStartEditSub={startEditSub}
                onSaveEditSub={() => saveEditSub(task.id)}
                onCancelEditSub={cancelEditSub}
                onEditingSubTextChange={setEditingSubText}
                onOpenEdit={(e) => openEdit(task, e)}
                onDeleteRequest={() => setDeleteConfirm(task.id)}
              />
            );
          })}
        </main>

        <button className="addbtn" onClick={openAdd} aria-label="إضافة مهمة جديدة">
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
        <FinancePage onQuota={() => setQuotaError(true)} />
      )}

      {/* Add/Edit Modal */}
      <TaskModal modal={modal} form={form} onFormField={setFormField} onSave={saveTask} onClose={() => setModal(null)} />

      {/* Delete Confirm */}
      {deleteConfirm !== null && (
        <div className="cov" role="dialog" aria-modal="true" aria-labelledby="del-title">
          <div className="cbox">
            <div style={{ fontSize:36, marginBottom:12 }} aria-hidden="true">🗑️</div>
            <div id="del-title" style={{ color:"var(--text-gold)", fontSize:17, fontWeight:700, marginBottom:8 }}>حذف المهمة؟</div>
            <div style={{ color:"rgba(var(--gold-rgb),.6)", fontSize:14, marginBottom:22 }}>"{tasks.find(t => t.id === deleteConfirm)?.title}"</div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => deleteTask(deleteConfirm)} style={{ flex:1, padding:"10px", borderRadius:10, border:"none", background:"#d97e6a", color:"white", fontFamily:"'Amiri',serif", fontSize:15, cursor:"pointer", fontWeight:700 }}>نعم، احذف</button>
              <button onClick={() => setDeleteConfirm(null)}   style={{ flex:1, padding:"10px", borderRadius:10, background:"transparent", border:"1px solid rgba(var(--gold-rgb),.25)", color:"rgba(var(--gold-rgb),.7)", fontFamily:"'Amiri',serif", fontSize:15, cursor:"pointer" }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
