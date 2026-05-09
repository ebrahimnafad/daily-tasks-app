import type { TimeBlock } from '../data/scheduleConfig';

interface TasksProgressProps {
  progress: number;
  prayersDone: number;
  prayerTotal: number;
  countDone: number;
  totalOther: number;
  currentBlock?: TimeBlock;
}

export default function TasksProgress({
  progress,
  prayersDone,
  prayerTotal,
  countDone,
  totalOther,
  currentBlock,
}: TasksProgressProps) {
  return (
    <section className="tp-section" aria-label="إجمالي التقدم">
      {currentBlock && (
        <div className="tp-current-block" aria-live="polite">
          <span className="tp-current-block__label">الآن</span>
          <span className="tp-current-block__name">
            {currentBlock.icon} {currentBlock.label}
          </span>
          {currentBlock.isOptional && <span className="tp-current-block__tag">اختياري</span>}
        </div>
      )}
      <div className="tp-header">
        <span className="tp-label">إجمالي الإنجاز</span>
        <span className="tp-value" aria-live="polite">
          {progress}٪
        </span>
      </div>
      <div
        className="progress-bar"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`التقدم: ${progress}%`}
      >
        <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="tp-stats">
        {prayersDone}/{prayerTotal} صلوات · {countDone}/{totalOther} مهام
      </div>
    </section>
  );
}
