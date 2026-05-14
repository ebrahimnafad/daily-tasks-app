// ── financialCycles.ts — Saudi Sales Financial Pulse ────────────────────
// Computes recurring market-signal events for sales professionals.
// Sources: Saudi Ministry of Finance (gov=27th Gregorian) & GOSI (pension=1st).

export type FinCycleType = 'gov-salary' | 'gosi-salary' | 'quota-close' | 'eid-bonus';

export interface FinCycleEvent {
  date: string; // YYYY-MM-DD
  type: FinCycleType;
  label: string;
  icon: string;
  color: string;
  borderColor: string;
  bannerText: string;
}

export interface FinCycleConfig {
  govSalaryEnabled: boolean;
  gosiSalaryEnabled: boolean;
  quotaCloseEnabled: boolean;
  eidBonusEnabled: boolean;
  eidBonusDaysBefore: number; // default 14
}

export const LS_FIN_CYCLE_CONFIG = 'mhm_fin_cycle_config';

export function defaultFinConfig(): FinCycleConfig {
  return {
    govSalaryEnabled: true,
    gosiSalaryEnabled: true,
    quotaCloseEnabled: true,
    eidBonusEnabled: true,
    eidBonusDaysBefore: 14,
  };
}

export const FIN_META: Record<
  FinCycleType,
  { label: string; icon: string; color: string; borderColor: string; bannerText: string }
> = {
  'gov-salary': {
    label: 'رواتب الحكومة',
    icon: '🏛️',
    color: 'rgba(34,197,94,0.95)',
    borderColor: 'rgba(34,197,94,0.82)',
    bannerText: 'يوم رواتب القطاع الحكومي — ذروة القوة الشرائية في السوق',
  },
  'gosi-salary': {
    label: 'معاشات GOSI',
    icon: '👴',
    color: 'rgba(20,184,166,0.95)',
    borderColor: 'rgba(20,184,166,0.82)',
    bannerText: 'يوم صرف معاشات GOSI — نشاط قطاع المتقاعدين',
  },
  'quota-close': {
    label: 'إغلاق الحصة',
    icon: '📊',
    color: 'rgba(249,115,22,0.95)',
    borderColor: 'rgba(249,115,22,0.75)',
    bannerText: 'نهاية الشهر — إغلاق الحصة المبيعاتية',
  },
  'eid-bonus': {
    label: 'موسم مكافأة العيد',
    icon: '🎁',
    color: 'rgba(168,85,247,0.95)',
    borderColor: 'rgba(168,85,247,0.75)',
    bannerText: 'بداية موسم مكافأة العيد — نشاط سوقي استثنائي',
  },
};

// ── Date helpers ──────────────────────────────────────────────────────────

function toISO(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function shiftDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Saudi weekend adjustment: Friday → Thursday, Saturday → Sunday */
function weekendAdjust(d: Date): Date {
  const dow = d.getDay();
  if (dow === 5) return shiftDays(d, -1); // Fri → Thu
  if (dow === 6) return shiftDays(d, +1); // Sat → Sun
  return d;
}

function govSalaryFor(year: number, month: number): Date {
  return weekendAdjust(new Date(year, month, 27));
}

function gosiFor(year: number, month: number): Date {
  return weekendAdjust(new Date(year, month, 1));
}

function quotaCloseFor(year: number, month: number): Date {
  return new Date(year, month + 1, 0); // day 0 of next month = last day of this
}

// ── Main computation ──────────────────────────────────────────────────────

/**
 * Compute all financial cycle events within [fromISO, fromISO + daysAhead).
 * @param eidFitrDates - YYYY-MM-DD list of Eid-ul-Fitr first days (from API or static fallback)
 */
export function computeFinCycleEvents(
  config: FinCycleConfig,
  eidFitrDates: string[],
  fromISO: string,
  daysAhead: number
): FinCycleEvent[] {
  const from = new Date(fromISO + 'T00:00:00');
  const to = shiftDays(from, daysAhead);
  const events: FinCycleEvent[] = [];

  const push = (date: Date, type: FinCycleType) => {
    if (date >= from && date < to) {
      const m = FIN_META[type];
      events.push({
        date: toISO(date),
        type,
        label: m.label,
        icon: m.icon,
        color: m.color,
        borderColor: m.borderColor,
        bannerText: m.bannerText,
      });
    }
  };

  const startY = from.getFullYear();
  const endY = to.getFullYear();

  for (let y = startY; y <= endY; y++) {
    const mStart = y === startY ? from.getMonth() : 0;
    const mEnd = y === endY ? to.getMonth() : 11;
    for (let m = mStart; m <= mEnd; m++) {
      if (config.govSalaryEnabled) push(govSalaryFor(y, m), 'gov-salary');
      if (config.gosiSalaryEnabled) push(gosiFor(y, m), 'gosi-salary');
      if (config.quotaCloseEnabled) push(quotaCloseFor(y, m), 'quota-close');
    }
  }

  if (config.eidBonusEnabled) {
    for (const eidDate of eidFitrDates) {
      const bonus = shiftDays(new Date(eidDate + 'T12:00:00'), -config.eidBonusDaysBefore);
      push(bonus, 'eid-bonus');
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}

/** Build date → FinCycleEvent[] map */
export function buildFinCycleMap(events: FinCycleEvent[]): Record<string, FinCycleEvent[]> {
  const map: Record<string, FinCycleEvent[]> = {};
  for (const ev of events) {
    if (!map[ev.date]) map[ev.date] = [];
    map[ev.date].push(ev);
  }
  return map;
}
