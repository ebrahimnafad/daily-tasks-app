import type { StreakResult } from './useStreak';
import './streak.css';

const DAYS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

interface StreakDetailSheetProps {
  streak: StreakResult;
  onClose: () => void;
  onThresholdChange: (val: number) => void;
}

function toArabicNum(n: number): string {
  return n.toLocaleString('ar-SA');
}

function getRelativeDay(dateStr: string, today: string): string {
  if (dateStr === today) return 'اليوم';
  const d = new Date(today + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (dateStr === yesterday) return 'الأمس';
  return dateStr;
}

export default function StreakDetailSheet({
  streak,
  onClose,
  onThresholdChange,
}: StreakDetailSheetProps) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box fin-modal streak-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fin-modal__header">
          <h3>🔥 سلسلتك الحالية</h3>
          <button className="fin-modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Big number */}
        <div className="streak-sheet__number">{toArabicNum(streak.current)}</div>
        <div className="streak-sheet__label">
          {streak.current === 0 ? 'ابدأ سلسلتك اليوم ✨' : 'يوماً متتالياً'}
        </div>

        {/* Stats */}
        <div className="streak-sheet__stats">
          <div className="wr-stat-row">
            <span className="wr-stat-label">أطول سلسلة</span>
            <span className="wr-stat-value">{toArabicNum(streak.longest)} يوم</span>
          </div>
          <div className="wr-stat-row">
            <span className="wr-stat-label">آخر يوم نشط</span>
            <span className="wr-stat-value">
              {streak.lastActiveDate ? getRelativeDay(streak.lastActiveDate, todayStr) : '—'}
            </span>
          </div>
          <div className="wr-stat-row">
            <span className="wr-stat-label">الحد الأدنى</span>
            <span className="wr-stat-value">{streak.threshold}٪ إنجاز</span>
          </div>
        </div>

        {/* Last 7 days dots */}
        <div className="streak-dots-row">
          {streak.last7.map((day) => {
            const dow = new Date(day.date + 'T12:00:00').getDay();
            return (
              <div
                key={day.date}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <div
                  className={`streak-dot streak-dot--${day.status}`}
                  title={`${day.date} — ${day.status === 'active' ? 'نشط' : day.status === 'rest' ? 'إجازة' : 'غير نشط'}`}
                />
                <span style={{ fontSize: '10px', color: 'rgba(var(--gold-rgb), 0.4)' }}>
                  {DAYS_AR[dow]?.substring(0, 2)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Threshold slider */}
        <div className="streak-sheet__threshold">
          <label
            htmlFor="streak-threshold-input"
            className="wr-stat-label"
            style={{ display: 'block', marginBottom: '4px' }}
          >
            تعديل الحد الأدنى: {streak.threshold}٪
          </label>
          <input
            id="streak-threshold-input"
            type="range"
            aria-label="تعديل الحد الأدنى للسلسلة"
            className="streak-threshold-slider"
            min={50}
            max={90}
            step={10}
            value={streak.threshold}
            onChange={(e) => onThresholdChange(Number(e.target.value))}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10px',
              color: 'rgba(var(--gold-rgb), 0.35)',
            }}
          >
            <span>٥٠٪</span>
            <span>٦٠٪</span>
            <span>٧٠٪</span>
            <span>٨٠٪</span>
            <span>٩٠٪</span>
          </div>
        </div>
      </div>
    </div>
  );
}
