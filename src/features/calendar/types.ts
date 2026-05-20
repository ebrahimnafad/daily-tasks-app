// ── Shared types for the Calendar feature ────────────────────────────────────
// Extracted from CalendarPage.tsx (F-2 decomposition)

import type { HolidayType } from './holidays';

// Finance event displayed on a calendar cell (unpaid expense due on that date).
export interface FinanceEvent {
  id: string;
  title: string;
  icon: string;
  amount: number;
  isPaid: boolean;
  type: 'due' | 'paid';
}

// Shape of a single entry in the holidayMap (returned by useHolidayData).
// Mirrors the runtime shape; adjust if the holidays module exports a named type.
export interface HolidayEntry {
  type: HolidayType;
  name: string;
  icon: string;
  groupId: string;
  approximate: boolean;
  dayIndex: number;
  date: string;
}

// Shape of a single entry in the finCycleMap (returned by buildFinCycleMap).
// Mirrors the runtime shape; adjust if financialCycles exports a named type.
export interface FinCycleMapEvent {
  type: string;
  borderColor: string;
  color: string;
  icon: string;
  label: string;
  bannerText: string;
}

export interface CalendarNote {
  id: string;
  date: string;
  text: string;
  tags?: string[];
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}
