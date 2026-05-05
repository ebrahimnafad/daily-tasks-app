import { useState, useCallback, useMemo } from "react";
import { CATEGORIES } from "@/features/tasks";

const EMPTY_FORM = { icon:"📋", title:"", category:"أخرى", color:"#aaaaaa", time:"الصباح", isWarning:false, recurrence:"يومي", alertTime:"", blockers:["","",""], helpers:["","",""] };
const uid = () => crypto.randomUUID();

export default function useTaskManager(tasks, setTasks, checked, setChecked, subChecked, setSubChecked) {
  const [newItemText,    setNewItemText]    = useState({});
  const [editingSubId,   setEditingSubId]   = useState(null);
  const [editingSubText, setEditingSubText] = useState("");
  const [modal,          setModal]          = useState(null);
  const [form,           setForm]           = useState(EMPTY_FORM);
  const [deleteConfirm,  setDeleteConfirm]  = useState(null);
  const [nextId,         setNextId]         = useState(100);

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
  
  const saveEditSub = useCallback((taskId) => {
    const text = editingSubText.trim();
    if (text) setTasks(p => p.map(t => t.id === taskId ? { ...t, subtasks: t.subtasks.map(s => s.id === editingSubId ? { ...s, text } : s) } : t));
    setEditingSubId(null);
  }, [editingSubText, editingSubId, setTasks]);
  
  const cancelEditSub = useCallback(() => setEditingSubId(null), []);

  // ── Task CRUD ─────────────────────────────────────────────────────────────
  const openAdd = useCallback(() => { setForm({ ...EMPTY_FORM }); setModal({ mode: "add" }); }, []);
  
  const openEdit = useCallback((task, e) => {
    e.stopPropagation();
    setForm({ 
      icon:task.icon, title:task.title, category:task.category, color:task.color, 
      time:task.time, isWarning:task.isWarning||false, recurrence:task.recurrence||"يومي", 
      alertTime:task.alertTime||"", 
      blockers:[...(task.brief?.blockers||[]),"","",""].slice(0,3), 
      helpers:[...(task.brief?.helpers||[]),"","",""].slice(0,3) 
    });
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
    const patch  = { 
      icon:form.icon, title:form.title.trim(), category:form.category, color, 
      time:form.time, isWarning:form.isWarning, recurrence:form.recurrence, 
      alertTime:form.alertTime||"", 
      brief:{ blockers:form.blockers.filter(b=>b.trim()), helpers:form.helpers.filter(h=>h.trim()) } 
    };
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

  // ── Derived State ─────────────────────────────────────────────────────────
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

  const taskSubCheckedMap = useMemo(() => {
    const map = {};
    tasks.forEach(task => {
      const ts = {};
      task.subtasks.forEach(s => { ts[s.id] = !!subChecked[s.id]; });
      map[task.id] = ts;
    });
    return map;
  }, [tasks, subChecked]);

  return {
    newItemText, setNewItemText,
    editingSubId, setEditingSubId,
    editingSubText, setEditingSubText,
    modal, setModal,
    form, setForm,
    deleteConfirm, setDeleteConfirm,
    
    addSubItem, deleteSubItem,
    startEditSub, saveEditSub, cancelEditSub,
    
    openAdd, openEdit, setFormField,
    saveTask, deleteTask,

    // Derived
    prayerTask, prayersDone, prayerTotal, otherTasks, countDone, totalOther, progress,
    taskSubCheckedMap
  };
}
