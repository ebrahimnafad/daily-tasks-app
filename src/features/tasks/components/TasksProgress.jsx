export default function TasksProgress({
  progress,
  prayersDone,
  prayerTotal,
  countDone,
  totalOther
}) {
  return (
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
  );
}
