import { TabBar } from "@/shared/components";

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

export default function AppShell({ 
  children, 
  activeTab, 
  setActiveTab, 
  shift, 
  syncStatus, 
  toasts 
}) {
  const { newDayToast, quotaError, needRefresh, updateServiceWorker } = toasts;

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

      {/* Main Content */}
      {children}
    </div>
  );
}
