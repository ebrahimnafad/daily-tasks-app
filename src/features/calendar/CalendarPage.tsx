import { useState } from 'react';
import type { Task } from '@/types';
import { useTaskContext } from '@/features/tasks/context/TaskContext';
import { TaskCard } from '@/features/tasks/components/TaskCard/index.js';
import NotesPanel from './NotesPanel';
import HistoryPanel from './HistoryPanel';
import SyncStatusBar from './SyncStatusBar';
import { HOLIDAY_COLOR, HOLIDAY_GROUPS, addDays } from './holidays';
import CalendarHeader from './components/CalendarHeader';
import CalendarGrid from './components/CalendarGrid';
import { useCalendarState } from './hooks/useCalendarState';
import { LS_KEYS } from '@/lib/storage/keys';
import { WeeklyReportModal, useWeeklyReport } from '@/features/weekly-report';

interface OkrCycleShape {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
}
interface OkrObjectiveShape {
  id: string;
  cycleId: string;
  title: string;
  icon?: string | null;
}

interface CalendarPageProps {
  tasks: Task[];
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  // OKR integration — passed from App.tsx, no direct okr feature import
  okrCycles?: OkrCycleShape[];
  okrObjectives?: OkrObjectiveShape[];
  activeCycleProgress?: number | null;
  setActiveTab?: (tab: string) => void;
}

export default function CalendarPage(props: CalendarPageProps) {
  const { tm, streak } = useTaskContext();
  const {
    setCurrentDate,
    selectedDate,
    setSelectedDate,
    okrCycles = [],
    okrObjectives = [],
    activeCycleProgress,
    setActiveTab,
  } = props;

  // ── Weekly review banner (Fridays only) ─────────────────────────────────
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);

  const now = new Date();
  const isFriday = now.getDay() === 5;
  const todayStr = now.toISOString().slice(0, 10);
  const lastShown = localStorage.getItem(LS_KEYS.OKR_WEEKLY_REVIEW_SHOWN);
  const hasActiveCycle = activeCycleProgress != null;
  const showReviewBanner =
    isFriday && hasActiveCycle && lastShown !== todayStr && !isBannerDismissed;

  const dismissBanner = () => {
    localStorage.setItem(LS_KEYS.OKR_WEEKLY_REVIEW_SHOWN, todayStr);
    setIsBannerDismissed(true);
  };

  // ── OKR cycle boundary helpers ────────────────────────────────────────────
  const activeCycles = okrCycles.filter((c) => c.status === 'active');

  const isCycleStart = (dateStr: string) => activeCycles.some((c) => c.startDate === dateStr);

  const isCycleEnd = (dateStr: string) => activeCycles.some((c) => c.endDate === dateStr);

  // ── OKR objectives for the selected date ──────────────────────────────────
  const cycleForDate = activeCycles.find(
    (c) => selectedDate >= c.startDate && selectedDate <= c.endDate
  );
  const objectivesForSelectedDate = cycleForDate
    ? okrObjectives.filter((o) => o.cycleId === cycleForDate.id)
    : [];

  const state = useCalendarState(props);

  const {
    today,
    year,
    month,
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    handleSelectDate,
    getDayShiftType,
    toggleOffException,
    selectedDateIsException,
    toggleWorkException,
    selectedDateIsWorkException,
    vacationDays,
    vacationBalance,
    vacationStats,
    toggleVacationDay,
    saveVacationBalance,
    showVacPicker,
    setShowVacPicker,
    vacRangeStart,
    setVacRangeStart,
    vacRangeEnd,
    setVacRangeEnd,
    vacSkipOffDays,
    setVacSkipOffDays,
    vacRangePreview,
    vacRangeTagged,
    applyVacationRange,
    removeVacationRange,
    holidayMap,
    holidayOffsets,
    adjustHoliday,
    finConfig,
    saveFinConfig,
    finCycleMap,
    upcomingFinEvents,
    showFinSettings,
    setShowFinSettings,
    tasksByDate,
    financeEventsByDate,
    notesByDate,
    maxExpenseAmount,
    snapSummaries,
    selectedSnapshot,
    loadingSnapshot,
    selectedDateIsStructurallyOff,
    selectedDateIsVacation,
    selectedDateTasks,
    selectedDateFinance,
    selectedDateNotes,
    offDayWarnings,
    addNote,
    updateNote,
    deleteNote,
    togglePin,
    syncStatus,
    syncError,
    retrySync,
    searchQuery,
    setSearchQuery,
    searchResults,
  } = state;

  return (
    <>
      <div className="cal-view">
        <CalendarHeader
          month={month}
          year={year}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onPrev={goToPrevMonth}
          onNext={goToNextMonth}
          onToday={goToToday}
        />

        {searchQuery ? (
          <div className="cal-search-results">
            {searchResults.length === 0 ? (
              <p className="cal-empty">لا توجد نتائج للبحث</p>
            ) : (
              searchResults.map((note) => (
                <div
                  key={note.id}
                  className="cal-search-result-item"
                  onClick={() => {
                    setSelectedDate(note.date);
                    setSearchQuery('');
                    // Navigate to the month of this note
                    const d = new Date(note.date + 'T00:00:00');
                    setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
                  }}
                >
                  <span className="cal-search-result-date">
                    {new Date(note.date + 'T00:00:00').toLocaleDateString('ar-SA', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {note.pinned && ' 📌'}
                  </span>
                  <span className="cal-search-result-snippet">
                    {note.text.slice(0, 120)}
                    {note.text.length > 120 ? '...' : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            <CalendarGrid
              year={year}
              month={month}
              today={today}
              selectedDate={selectedDate}
              tasksByDate={tasksByDate}
              financeEventsByDate={financeEventsByDate}
              notesByDate={notesByDate}
              holidayMap={holidayMap}
              finCycleMap={finCycleMap}
              snapSummaries={snapSummaries}
              vacationDays={vacationDays}
              maxExpenseAmount={maxExpenseAmount}
              getDayShiftType={getDayShiftType}
              onSelectDate={handleSelectDate}
              isCycleStart={isCycleStart}
              isCycleEnd={isCycleEnd}
            />

            {/* ── OKR Weekly review banner (Fridays) ── */}
            {showReviewBanner && (
              <div className="okr-review-banner" role="alert">
                <span>📊 كيف تقدمك في أهدافك هذا الأسبوع؟</span>
                <button
                  onClick={() => {
                    setShowWeeklyReport(true);
                    dismissBanner();
                  }}
                >
                  📊 التقرير الأسبوعي
                </button>
                {setActiveTab && (
                  <button
                    onClick={() => {
                      setActiveTab('okr');
                      dismissBanner();
                    }}
                  >
                    عرض الأهداف
                  </button>
                )}
                <button onClick={dismissBanner} aria-label="إغلاق التنبيه">
                  ✕
                </button>
              </div>
            )}

            {/* ── Shift legend ── */}
            <div className="cal-shift-legend">
              <span className="cal-shift-legend__item cal-shift-legend__item--morning">
                ☀️ صباحي
              </span>
              <span className="cal-shift-legend__item cal-shift-legend__item--evening">
                🌙 مسائي
              </span>
              <span className="cal-shift-legend__item cal-shift-legend__item--off">🏖️ إجازة</span>
              <button
                className="cal-fin-settings-btn"
                onClick={() => setShowFinSettings((v) => !v)}
                title="إعدادات نبضة المال"
              >
                {showFinSettings ? '×' : '⚙️'}
              </button>
            </div>

            {/* ── Off-day warnings for this month ── */}
            {offDayWarnings.length > 0 && (
              <div className="cal-offday-warnings">
                {offDayWarnings.map((w) => (
                  <div key={w.type} className={`cal-offday-warning cal-offday-warning--${w.type}`}>
                    <span className="cal-offday-warning__icon">
                      {w.type === 'excess' ? '⚠️' : '📅⚠️'}
                    </span>
                    <span className="cal-offday-warning__text">{w.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Annual vacation balance bar ── */}
            <div className="cal-vacation-bar">
              <span className="cal-vacation-bar__label">🌴 الإجازة السنوية {year}</span>
              <div className="cal-vacation-bar__track">
                <div
                  className={`cal-vacation-bar__fill ${
                    vacationStats.overused ? 'cal-vacation-bar__fill--over' : ''
                  }`}
                  style={{
                    width: `${Math.min(100, (vacationStats.used / vacationBalance) * 100)}%`,
                  }}
                />
              </div>
              {/* Explicit labeled pills so numbers are never ambiguous */}
              <span
                className={`cal-vacation-bar__count ${
                  vacationStats.overused ? 'cal-vacation-bar__count--over' : ''
                }`}
                title="أيام مستخدمة"
              >
                ✈️ {vacationStats.used}
              </span>
              <span
                className={`cal-vacation-bar__count ${
                  vacationStats.remaining <= 0 ? 'cal-vacation-bar__count--over' : ''
                }`}
                title="أيام متبقية"
              >
                🌴 {vacationStats.remaining}
              </span>
              <button
                className={`cal-vacation-bar__range-btn ${
                  showVacPicker ? 'cal-vacation-bar__range-btn--active' : ''
                }`}
                onClick={() => setShowVacPicker((v) => !v)}
                title="تحديد إجازة بالنطاق"
              >
                {showVacPicker ? '×' : '📅 نطاق'}
              </button>
            </div>

            {/* ── Vacation range picker panel ── */}
            {showVacPicker && (
              <div className="cal-vac-picker">
                <div className="cal-vac-picker__row">
                  <label className="cal-vac-picker__lbl">من</label>
                  <input
                    type="date"
                    className="cal-vac-picker__date"
                    value={vacRangeStart}
                    title="تاريخ بداية الإجازة"
                    onChange={(e) => setVacRangeStart(e.target.value)}
                  />
                  <label className="cal-vac-picker__lbl">إلى</label>
                  <input
                    type="date"
                    className="cal-vac-picker__date"
                    value={vacRangeEnd}
                    min={vacRangeStart}
                    title="تاريخ نهاية الإجازة"
                    onChange={(e) => setVacRangeEnd(e.target.value)}
                  />
                </div>
                <label className="cal-vac-picker__check">
                  <input
                    type="checkbox"
                    checked={vacSkipOffDays}
                    onChange={(e) => setVacSkipOffDays(e.target.checked)}
                  />
                  <span>تجاهل أيام الإجازة الأسبوعية (لا تخصم من الرصيد)</span>
                </label>
                {vacRangePreview.length > 0 && (
                  <div
                    className={`cal-vac-picker__preview ${
                      vacationStats.remaining - vacRangePreview.length < 0
                        ? 'cal-vac-picker__preview--over'
                        : ''
                    }`}
                  >
                    🌴 سيُحجز {vacRangePreview.length} يوماً — متبقي بعدها:{' '}
                    <strong>{vacationStats.remaining - vacRangePreview.length} يوم</strong>
                  </div>
                )}
                {vacRangeTagged.length > 0 && (
                  <div
                    className="cal-vac-picker__preview"
                    style={{ color: 'var(--text-gold)', opacity: 0.85 }}
                  >
                    🏖️ سيتم إلغاء حجز {vacRangeTagged.length} يوم إجازة من هذا النطاق
                  </div>
                )}
                {vacRangeStart &&
                  vacRangeEnd &&
                  vacRangeEnd >= vacRangeStart &&
                  vacRangePreview.length === 0 &&
                  vacRangeTagged.length === 0 && (
                    <div className="cal-vac-picker__preview">
                      لا توجد أيام جديدة لتحجيزها أو إلغائها في هذا النطاق
                    </div>
                  )}
                <div className="cal-vac-picker__actions">
                  <button
                    className="cal-vac-picker__apply"
                    onClick={applyVacationRange}
                    disabled={
                      vacRangePreview.length === 0 ||
                      vacationStats.remaining - vacRangePreview.length < 0
                    }
                  >
                    تطبيق ✓
                  </button>
                  {vacRangeTagged.length > 0 && (
                    <button className="cal-vac-picker__delete" onClick={removeVacationRange}>
                      إلغاء حجز 🗑️
                    </button>
                  )}
                  <button
                    className="cal-vac-picker__cancel"
                    onClick={() => {
                      setShowVacPicker(false);
                      setVacRangeStart('');
                      setVacRangeEnd('');
                    }}
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            {/* ── Financial settings panel ── */}
            {showFinSettings && (
              <div className="cal-fin-settings">
                <h4 className="cal-fin-settings__title">⚙️ إعدادات نبضة المال</h4>
                {(
                  [
                    { key: 'govSalaryEnabled', label: '🏙️ رواتب القطاع الحكومي (27 ميلادي)' },
                    { key: 'gosiSalaryEnabled', label: '👴 معاشات GOSI (1 ميلادي)' },
                    { key: 'quotaCloseEnabled', label: '📊 إغلاق الحصة المبيعاتية (آخر الشهر)' },
                    { key: 'eidBonusEnabled', label: '🎁 موسم مكافأة العيد' },
                  ] as const
                ).map(({ key, label }) => (
                  <label key={key} className="cal-fin-settings__row">
                    <input
                      type="checkbox"
                      checked={finConfig[key]}
                      onChange={(e) => saveFinConfig({ [key]: e.target.checked })}
                    />
                    <span>{label}</span>
                  </label>
                ))}
                <label className="cal-fin-settings__row">
                  <span>🎁 أيام قبل العيد</span>
                  <input
                    type="number"
                    min={7}
                    max={30}
                    value={finConfig.eidBonusDaysBefore}
                    onChange={(e) =>
                      saveFinConfig({
                        eidBonusDaysBefore: Math.max(7, Math.min(30, +e.target.value)),
                      })
                    }
                    className="cal-fin-settings__num"
                  />
                  <span>يوم</span>
                </label>
                <label className="cal-fin-settings__row">
                  <span>🌴 رصيد الإجازة السنوية</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={vacationBalance}
                    onChange={(e) =>
                      saveVacationBalance(Math.max(1, Math.min(60, +e.target.value)))
                    }
                    className="cal-fin-settings__num"
                  />
                  <span>يوم/سنة</span>
                </label>
              </div>
            )}

            {/* ── نبضة المال — Financial Pulse Strip ── */}
            {upcomingFinEvents.length > 0 && (
              <div className="cal-fin-pulse">
                {upcomingFinEvents.slice(0, 6).map((ev, idx) => {
                  const diffDays = Math.round(
                    (new Date(ev.date + 'T00:00:00').getTime() -
                      new Date(today + 'T00:00:00').getTime()) /
                      86_400_000
                  );
                  const isToday = diffDays === 0;
                  return (
                    <div
                      key={`${ev.type}-${ev.date}-${idx}`}
                      className="cal-fin-card"
                      style={{ '--fin-color': ev.color } as React.CSSProperties}
                      onClick={() => {
                        const d = new Date(ev.date + 'T00:00:00');
                        setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
                        handleSelectDate(ev.date);
                      }}
                      title={ev.bannerText}
                    >
                      <span className="cal-fin-card__icon">{ev.icon}</span>
                      <span className="cal-fin-card__label">{ev.label}</span>
                      <span className="cal-fin-card__countdown">
                        {isToday ? '🟢 اليوم' : `${diffDays} يوم`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Selected day tasks */}
            <div className="cal-selected-tasks">
              <h3 className="cal-selected-title">
                المهام والاستحقاقات لـ{' '}
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ar-SA', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </h3>
              {/* ── Off-day exception toggle (off → work) ── */}
              {selectedDateIsStructurallyOff && (
                <div className="cal-exception-row">
                  <span className="cal-exception-row__label">
                    {selectedDateIsException
                      ? '✅ معتمد كيوم عمل (استثناء)'
                      : '🏖️ هذا اليوم إجازة وفق جدولك'}
                  </span>
                  <button
                    className={`cal-exception-btn ${selectedDateIsException ? 'cal-exception-btn--active' : ''}`}
                    onClick={() => toggleOffException(selectedDate)}
                  >
                    {selectedDateIsException ? 'إلغاء الاستثناء' : 'اعتبره يوم عمل'}
                  </button>
                </div>
              )}

              {/* ── Work-day exception toggle (work → off) ── */}
              {!selectedDateIsStructurallyOff && (
                <div
                  className={`cal-exception-row ${selectedDateIsWorkException ? 'cal-exception-row--off' : ''}`}
                >
                  <span className="cal-exception-row__label">
                    {selectedDateIsWorkException
                      ? '🏖️ معتمد كيوم إجازة استثنائي'
                      : '💼 هذا اليوم عمل وفق جدولك'}
                  </span>
                  <button
                    className={`cal-exception-btn ${selectedDateIsWorkException ? 'cal-exception-btn--off' : ''}`}
                    onClick={() => toggleWorkException(selectedDate)}
                  >
                    {selectedDateIsWorkException ? 'إلغاء الاستثناء' : 'اعتبره إجازة استثنائية'}
                  </button>
                </div>
              )}

              {/* ── Annual vacation toggle (action only — balance shown in top bar) ── */}
              <div
                className={`cal-exception-row ${
                  selectedDateIsVacation ? 'cal-exception-row--vacation' : ''
                }`}
              >
                <span className="cal-exception-row__label">
                  {selectedDateIsVacation ? '🌴 هذا اليوم إجازة سنوية' : '🌴 تسجيل يوم إجازة سنوية'}
                </span>
                <button
                  className={`cal-exception-btn ${
                    selectedDateIsVacation ? 'cal-exception-btn--vacation' : ''
                  }`}
                  onClick={() => toggleVacationDay(selectedDate)}
                  disabled={!selectedDateIsVacation && vacationStats.remaining <= 0}
                  title={
                    !selectedDateIsVacation && vacationStats.remaining <= 0
                      ? 'انتهى رصيد إجازتك السنوية'
                      : undefined
                  }
                >
                  {selectedDateIsVacation ? 'إلغاء الإجازة' : 'إجازة سنوية 🌴'}
                </button>
              </div>

              {/* Financial cycle context banner */}
              {(finCycleMap[selectedDate] ?? []).map((ev) => (
                <div
                  key={ev.type}
                  className="cal-fin-banner"
                  style={{ '--fin-color': ev.color } as React.CSSProperties}
                >
                  <span className="cal-fin-banner__icon">{ev.icon}</span>
                  <span className="cal-fin-banner__text">{ev.bannerText}</span>
                </div>
              ))}

              {/* Holiday banner with adjustment controls */}
              {holidayMap[selectedDate] &&
                (() => {
                  const h = holidayMap[selectedDate];
                  const offset = holidayOffsets[h.groupId] ?? 0;
                  const confirmed = !h.approximate || offset !== 0;
                  const group = HOLIDAY_GROUPS.find((g) => g.id === h.groupId);
                  const baseDate = group?.baseDates[h.dayIndex] ?? h.date;
                  const confirmedDate = addDays(baseDate, offset);
                  return (
                    <div
                      className="cal-holiday-banner"
                      style={{ borderColor: HOLIDAY_COLOR[h.type], color: HOLIDAY_COLOR[h.type] }}
                    >
                      <div className="cal-holiday-banner__row">
                        <span className="cal-holiday-banner__icon">{h.icon}</span>
                        <span className="cal-holiday-banner__name">{h.name}</span>
                        {h.approximate && !confirmed && (
                          <span className="cal-holiday-banner__approx">تقريبي</span>
                        )}
                        {confirmed && h.approximate && (
                          <span className="cal-holiday-banner__confirmed">✓ مؤكد</span>
                        )}
                      </div>
                      {h.approximate && h.dayIndex === 0 && (
                        <div className="cal-holiday-adj">
                          <span className="cal-holiday-adj__label">
                            {confirmed
                              ? `الموعد المؤكد: ${new Date(confirmedDate + 'T12:00:00').toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'short' })}`
                              : 'تأكيد الموعد بعد إعلان رؤية الهلال:'}
                          </span>
                          <div className="cal-holiday-adj__controls">
                            <button
                              className="cal-holiday-adj__btn"
                              onClick={() => adjustHoliday(h.groupId, -1)}
                              title="يوم قبل"
                            >
                              ◀
                            </button>
                            <span className="cal-holiday-adj__offset">
                              {offset === 0 ? '±٠' : offset > 0 ? `+${offset}` : `${offset}`}
                            </span>
                            <button
                              className="cal-holiday-adj__btn"
                              onClick={() => adjustHoliday(h.groupId, +1)}
                              title="يوم بعد"
                            >
                              ▶
                            </button>
                            {offset !== 0 && (
                              <button
                                className="cal-holiday-adj__btn cal-holiday-adj__btn--reset"
                                onClick={() => adjustHoliday(h.groupId, 'reset')}
                                title="إعادة ضبط"
                              >
                                ↩
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

              {selectedDateTasks.length === 0 && selectedDateFinance.length === 0 ? (
                <p className="cal-empty">لا توجد مهام أو استحقاقات في هذا اليوم</p>
              ) : (
                <div className="cal-date-tasks" style={{ marginTop: '16px' }}>
                  {selectedDateFinance.map((fe) => (
                    <div
                      key={fe.id}
                      className="cal-task-item"
                      style={{
                        borderRight: `3px solid var(--danger)`,
                        paddingRight: '8px',
                      }}
                    >
                      <span>{fe.icon}</span>
                      <span
                        style={{
                          color: 'var(--danger)',
                          flex: 1,
                        }}
                      >
                        {fe.title} ({(fe.amount || 0).toLocaleString('ar-SA')} ر.س)
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>⏳ مستحق</span>
                    </div>
                  ))}
                  {selectedDateTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isChecked={!!tm.checked[task.id]}
                      taskSubChecked={tm.taskSubCheckedMap[task.id]}
                    />
                  ))}
                </div>
              )}

              {/* Upgraded Notes Panel */}
              <NotesPanel
                date={selectedDate}
                notes={selectedDateNotes}
                onAdd={addNote}
                onUpdate={updateNote}
                onDelete={deleteNote}
                onTogglePin={togglePin}
              />

              {/* OKR objectives for this cycle period */}
              {objectivesForSelectedDate.length > 0 && (
                <div className="cal-okr-objectives" style={{ opacity: 0.8 }}>
                  <div className="cal-okr-objectives__header">
                    <span>🎯</span>
                    <span className="cal-okr-objectives__title">الأهداف في هذه الفترة</span>
                    <span className="cal-okr-objectives__note">التقدم الحالي</span>
                  </div>
                  {objectivesForSelectedDate.map((o) => {
                    // We don't have computeObjectiveProgress here — we read from
                    // activeCycleProgress as a rough proxy; detailed per-objective
                    // progress is v2. Show icon + title + cycle-level bar for now.
                    return (
                      <div key={o.id} className="cal-okr-obj-row">
                        <span className="cal-okr-obj-row__icon">{o.icon ?? '🎯'}</span>
                        <span className="cal-okr-obj-row__title">{o.title}</span>
                      </div>
                    );
                  })}
                  {activeCycleProgress != null && (
                    <div className="cal-okr-cycle-progress">
                      <div className="cal-okr-cycle-progress__track">
                        <div
                          className="cal-okr-cycle-progress__fill"
                          style={{ width: `${activeCycleProgress}%` }}
                        />
                      </div>
                      <span className="cal-okr-cycle-progress__pct">{activeCycleProgress}%</span>
                    </div>
                  )}
                </div>
              )}

              <HistoryPanel
                selectedDate={selectedDate}
                today={today}
                snapSummaries={snapSummaries}
                selectedSnapshot={selectedSnapshot}
                loadingSnapshot={loadingSnapshot}
              />

              <SyncStatusBar syncStatus={syncStatus} syncError={syncError} onRetry={retrySync} />
            </div>
          </>
        )}
      </div>

      {/* Weekly Report modal */}
      {showWeeklyReport && (
        <CalendarWeeklyReportWrapper streak={streak} onClose={() => setShowWeeklyReport(false)} />
      )}
    </>
  );
}

/** Wrapper so useWeeklyReport hook is called inside a component scope */
function CalendarWeeklyReportWrapper({
  onClose,
  streak,
}: {
  onClose: () => void;
  streak?: import('@/lib/streak/useStreak').StreakResult;
}) {
  const reportData = useWeeklyReport();
  return <WeeklyReportModal data={reportData} streak={streak} onClose={onClose} />;
}
