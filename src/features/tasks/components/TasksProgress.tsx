interface TasksProgressProps {
  progress: number;
  prayersDone: number;
  prayerTotal: number;
  countDone: number;
  totalOther: number;
}

export default function TasksProgress({
  progress,
  prayersDone,
  prayerTotal,
  countDone,
  totalOther,
}: TasksProgressProps) {
  return (
    <section className="tp-section" aria-label="إجمالي التقدم">
      <div className="tp-header">
        <span className="tp-label">إجمالي الإنجاز</span>
        <span className="tp-value" aria-live="polite">
          {progress}٪
        </span>
      </div>
      <div
        className="pbar"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`التقدم: ${progress}%`}
      >
        <div className="pfill" style={{ width: `${progress}%` }} />
      </div>
      <div className="tp-stats">
        {prayersDone}/{prayerTotal} صلوات · {countDone}/{totalOther} مهام
      </div>
    </section>
  );
}
