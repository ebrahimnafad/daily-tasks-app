export default function TasksHeader({
  today,
  notifPerm,
  requestNotifPerm,
  sendToSheets,
  resetNewDay,
  shift,
  setShift
}) {
  return (
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
  );
}
