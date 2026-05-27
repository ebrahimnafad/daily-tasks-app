import type { StreakResult } from './useStreak';
import './streak.css';

interface StreakBadgeProps {
  streak: StreakResult;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

function toArabicNum(n: number): string {
  return n.toLocaleString('ar-SA');
}

export default function StreakBadge({ streak, size = 'md', onClick }: StreakBadgeProps) {
  const { current, atRisk } = streak;

  if (current === 0) {
    if (size === 'sm') return null;
    return (
      <span
        className="streak-badge streak-badge--muted"
        onClick={onClick}
        role="button"
        tabIndex={0}
      >
        ابدأ سلسلتك اليوم ✨
      </span>
    );
  }

  const colorClass =
    current >= 7
      ? 'streak-badge--gold'
      : current >= 3
        ? 'streak-badge--orange'
        : 'streak-badge--muted';

  const riskClass = atRisk ? 'streak-badge--at-risk' : '';

  if (size === 'sm') {
    return (
      <span
        className={`streak-badge ${colorClass} ${riskClass}`}
        onClick={onClick}
        role="button"
        tabIndex={0}
      >
        🔥 {toArabicNum(current)}
        {atRisk && ' ⚠️'}
      </span>
    );
  }

  return (
    <span
      className={`streak-badge ${colorClass} ${riskClass}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      🔥 {toArabicNum(current)} يوماً متتالياً
      {atRisk && ' ⚠️'}
    </span>
  );
}
