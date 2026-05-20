// ── CalendarHeader ────────────────────────────────────────────────────────────
// Extracted from CalendarPage.tsx (F-2 decomposition).
// Owns: month/year title, prev/next navigation, "today" shortcut, and search bar.

import { MONTHS } from '../constants';

interface CalendarHeaderProps {
  month: number;
  year: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export default function CalendarHeader({
  month,
  year,
  searchQuery,
  onSearchChange,
  onPrev,
  onNext,
  onToday,
}: CalendarHeaderProps) {
  return (
    <>
      {/* Month / year navigation */}
      <div className="cal-header">
        <button className="cal-nav" onClick={onPrev}>
          ▶
        </button>
        <div className="cal-title">
          <span>{MONTHS[month]}</span>
          <span style={{ fontWeight: 400 }}>{year}</span>
        </div>
        <button className="cal-nav" onClick={onNext}>
          ◀
        </button>
      </div>

      {/* Jump-to-today shortcut */}
      <button className="cal-today-btn" onClick={onToday}>
        اليوم
      </button>

      {/* Notes search bar */}
      <div className="cal-search-bar">
        <span className="cal-search-icon">🔍</span>
        <input
          type="text"
          className="cal-search-input"
          placeholder="ابحث في الملاحظات..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          dir="auto"
        />
        {searchQuery && (
          <button className="cal-search-clear" onClick={() => onSearchChange('')}>
            ✕
          </button>
        )}
      </div>
    </>
  );
}
