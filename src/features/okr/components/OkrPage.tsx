import { useState, useRef, useEffect, useMemo } from 'react';
import '../okr.css';
import useOkrManager from '../hooks/useOkrManager';
import type { OkrObjective, OkrKeyResult, OkrCycle } from '../hooks/useOkrManager';
import type { Task } from '@/types';
import CycleSelector from './CycleSelector';
import OkrProgress from './OkrProgress';
import ObjectiveCard from './ObjectiveCard';
import CheckInModal from './CheckInModal';
import ObjectiveModal from './ObjectiveModal';
import KeyResultModal from './KeyResultModal';
import CycleModal from './CycleModal';
import { useTaskOkrBridge } from '../hooks/useTaskOkrBridge';
import useToasts from '@/shared/hooks/useToasts';
import { WeeklyReportModal, useWeeklyReport } from '@/features/weekly-report';

interface ModalState {
  checkInKR: OkrKeyResult | null;
  editObjective: OkrObjective | null;
  editKR: OkrKeyResult | null;
  addKRObjectiveId: string | null;
  showObjectiveModal: boolean;
}

const INITIAL_MODAL: ModalState = {
  checkInKR: null,
  editObjective: null,
  editKR: null,
  addKRObjectiveId: null,
  showObjectiveModal: false,
};

interface OkrPageProps {
  availableTasks?: Task[];
}

export default function OkrPage({ availableTasks = [] }: OkrPageProps) {
  const mgr = useOkrManager();
  const [modal, setModal] = useState<ModalState>(INITIAL_MODAL);
  const { addSyncToast } = useToasts();

  useTaskOkrBridge(mgr.recordCheckIn, (msg) => addSyncToast(msg, 'warn'));

  const [showWeeklyReport, setShowWeeklyReport] = useState(false);

  const [cycleModal, setCycleModal] = useState<{
    open: boolean;
    cycle?: OkrCycle;
    sourceCycleId?: string;
  }>({ open: false });

  const [cardState, setCardState] = useState<'menu' | 'confirm-delete' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setCardState(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const closeModal = () => setModal(INITIAL_MODAL);

  const activeCycle = mgr.activeCycle;
  const hasActive = mgr.cycles.some((c) => c.status === 'active' && !c.deletedAt);
  const objectives = activeCycle ? mgr.objectivesForCycle(activeCycle.id) : [];
  const cycleProgress = activeCycle ? mgr.computeCycleProgress(activeCycle.id) : 0;
  const days = activeCycle ? mgr.daysRemaining(activeCycle) : 0;

  // Build checkInsMap once
  const checkInsMap: Record<string, typeof mgr.checkIns> = {};
  mgr.checkIns.forEach((ci) => {
    if (!checkInsMap[ci.keyResultId]) checkInsMap[ci.keyResultId] = [];
    checkInsMap[ci.keyResultId].push(ci);
  });

  // Collect task IDs already linked to any KR (for visual muting in picker)
  const linkedTaskIds = useMemo(() => {
    const ids = new Set<string>();
    mgr.keyResults.forEach((kr) => {
      if (kr.linkedTaskId) ids.add(kr.linkedTaskId);
    });
    return ids;
  }, [mgr.keyResults]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  return (
    <div className="okr-page">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="okr-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <h1 className="fin-section__title">أهدافي</h1>
          <button className="wr-trigger-btn" onClick={() => setShowWeeklyReport(true)}>
            📊 التقرير الأسبوعي
          </button>
        </div>
        <CycleSelector
          cycles={mgr.cycles}
          activeCycle={activeCycle}
          onSelect={() => {
            /* v1: only one active cycle; selection is display-only */
          }}
          onCreateCycle={() => setCycleModal({ open: true, cycle: undefined })}
          onReactivateCycle={(id) => mgr.reactivateCycle(id)}
        />
      </div>

      {/* ── Active cycle summary OR empty state ──────────────────────────── */}
      {activeCycle ? (
        <div className="okr-cycle-card" ref={cardRef}>
          {cardState === 'confirm-delete' ? (
            <div className="okr-cycle-card__confirm">
              <p>
                ⚠️ سيتم حذف الدورة وجميع أهدافها نهائياً.
                <br />
                هل أنت متأكد؟
              </p>
              <div className="okr-cycle-card__confirm-actions">
                <button
                  className="fin-btn-sm"
                  style={{ background: 'var(--expense)', color: 'white', border: 'none' }}
                  onClick={() => {
                    mgr.deleteCycle(activeCycle.id);
                    setCardState(null);
                  }}
                >
                  تأكيد الحذف
                </button>
                <button className="fin-btn-sm" onClick={() => setCardState(null)}>
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="okr-cycle-card__header">
                <div>
                  <h2 className="okr-cycle-card__title">{activeCycle.title}</h2>
                  <p className="okr-cycle-card__dates">
                    {activeCycle.startDate} — {activeCycle.endDate}
                  </p>
                </div>
                <div style={{ position: 'relative' }}>
                  <button
                    className="okr-cycle-card__menu-btn"
                    onClick={() => setCardState(cardState === 'menu' ? null : 'menu')}
                  >
                    ⋮
                  </button>
                  {cardState === 'menu' && (
                    <div className="okr-cycle-card__dropdown">
                      <button
                        className="okr-cycle-card__dropdown-item"
                        onClick={() => {
                          setCardState(null);
                          setCycleModal({ open: true, cycle: activeCycle });
                        }}
                      >
                        ✏️ تعديل الدورة
                      </button>
                      <button
                        className="okr-cycle-card__dropdown-item"
                        onClick={() => {
                          setCardState(null);
                          setCycleModal({
                            open: true,
                            cycle: {
                              ...activeCycle,
                              id: '',
                              title: 'نسخة من: ' + activeCycle.title,
                            },
                            sourceCycleId: activeCycle.id,
                          });
                        }}
                      >
                        📋 تكرار الدورة
                      </button>

                      {activeCycle.status === 'active' ? (
                        <button
                          className="okr-cycle-card__dropdown-item"
                          onClick={() => {
                            setCardState(null);
                            mgr.archiveCycle(activeCycle.id);
                          }}
                        >
                          🗂 أرشفة الدورة
                        </button>
                      ) : (
                        <button
                          className={`okr-cycle-card__dropdown-item ${hasActive ? 'okr-cycle-card__dropdown-item--disabled' : ''}`}
                          title={hasActive ? 'أرشف الدورة النشطة أولاً' : undefined}
                          onClick={() => {
                            if (hasActive) return;
                            setCardState(null);
                            mgr.reactivateCycle(activeCycle.id);
                          }}
                        >
                          ✅ إعادة التفعيل
                        </button>
                      )}

                      <button
                        className="okr-cycle-card__dropdown-item okr-cycle-card__dropdown-item--danger"
                        onClick={() => setCardState('confirm-delete')}
                      >
                        🗑 حذف الدورة
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="okr-cycle-card__body">
                <OkrProgress
                  progress={cycleProgress}
                  size={80}
                  strokeWidth={6}
                  sublabel={mgr.quarterLabel(activeCycle.startDate)}
                />
                <div className="okr-cycle-card__days">
                  {days > 0 ? `${days} يوم متبقي` : 'انتهت الدورة'}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="okr-empty" style={{ marginTop: 'var(--space-lg)' }}>
          <p style={{ fontSize: '32px', marginBottom: 'var(--space-sm)' }}>🎯</p>
          <p style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--text-gold)' }}>
            لا توجد دورة نشطة
          </p>
          <p style={{ fontSize: 'var(--font-base)', marginTop: 'var(--space-xs)' }}>
            أنشئ دورتك الأولى وابدأ برسم أهدافك
          </p>
          <button
            className="fin-btn-primary"
            style={{ marginTop: 'var(--space-lg)' }}
            onClick={() => setCycleModal({ open: true, cycle: undefined })}
          >
            إنشاء دورة جديدة
          </button>
        </div>
      )}

      {/* ── Objectives list ───────────────────────────────────────────────── */}
      {activeCycle && (
        <div className="okr-objectives-list">
          {objectives.length === 0 ? (
            <div className="fin-empty">
              <p style={{ fontSize: '24px', marginBottom: 'var(--space-sm)' }}>📋</p>
              <p>لا توجد أهداف بعد، أضف هدفك الأول</p>
            </div>
          ) : (
            objectives.map((obj) => {
              const krs = mgr.keyResultsForObjective(obj.id);
              return (
                <ObjectiveCard
                  key={obj.id}
                  objective={obj}
                  keyResults={krs}
                  checkInsMap={checkInsMap}
                  progress={mgr.computeObjectiveProgress(obj.id)}
                  onAddKR={(objectiveId) =>
                    setModal((m) => ({ ...m, addKRObjectiveId: objectiveId }))
                  }
                  onEditObjective={(o) =>
                    setModal((m) => ({ ...m, editObjective: o, showObjectiveModal: true }))
                  }
                  onDeleteObjective={(id) => mgr.deleteObjective(id)}
                  onRecordProgress={(kr) => setModal((m) => ({ ...m, checkInKR: kr }))}
                  onEditKR={(kr) => setModal((m) => ({ ...m, editKR: kr }))}
                  onDeleteKR={(id) => mgr.deleteKeyResult(id)}
                />
              );
            })
          )}
        </div>
      )}

      {/* ── FAB — new objective ───────────────────────────────────────────── */}
      {activeCycle && (
        <button
          id="okr-fab"
          className="okr-fab"
          onClick={() => setModal((m) => ({ ...m, showObjectiveModal: true, editObjective: null }))}
          aria-label="إضافة هدف جديد"
        >
          + هدف جديد
        </button>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {/* Check-in modal */}
      <CheckInModal
        kr={modal.checkInKR}
        onClose={closeModal}
        onSubmit={(value, note) => {
          if (modal.checkInKR) {
            void mgr.recordCheckIn(modal.checkInKR.id, value, note);
          }
        }}
      />

      {/* Objective modal (create or edit) */}
      {(modal.showObjectiveModal || modal.editObjective) && activeCycle && (
        <ObjectiveModal
          objective={modal.editObjective ?? undefined}
          cycleId={activeCycle.id}
          onClose={closeModal}
          onSubmit={(data) => {
            if (modal.editObjective) {
              mgr.updateObjective(modal.editObjective.id, data);
            } else {
              mgr.createObjective(activeCycle.id, data.title, data.icon, data.color);
            }
          }}
        />
      )}

      {/* Key result modal (add or edit) */}
      {(modal.addKRObjectiveId || modal.editKR) && (
        <KeyResultModal
          keyResult={modal.editKR ?? undefined}
          objectiveId={modal.addKRObjectiveId ?? modal.editKR?.objectiveId ?? ''}
          availableTasks={availableTasks}
          linkedTaskIds={linkedTaskIds}
          onClose={closeModal}
          onSubmit={(data) => {
            if (modal.editKR) {
              mgr.updateKeyResult(modal.editKR.id, {
                ...data,
                targetValue: data.targetValue,
              });
            } else if (modal.addKRObjectiveId) {
              mgr.createKeyResult(modal.addKRObjectiveId, {
                title: data.title,
                type: data.type as 'numeric' | 'binary',
                unit: data.unit as 'count' | 'percent' | 'currency' | 'custom',
                customUnit: data.customUnit,
                targetValue: data.targetValue,
                linkedTaskId: data.linkedTaskId,
              });
            }
          }}
        />
      )}

      {/* Cycle modal (create, edit, duplicate) */}
      {cycleModal.open && (
        <CycleModal
          cycle={cycleModal.cycle}
          sourceCycleId={cycleModal.sourceCycleId}
          cycles={mgr.cycles}
          currentQuarterDates={mgr.currentQuarterDates}
          onClose={() => setCycleModal({ open: false })}
          onSubmit={(data) => {
            if (cycleModal.cycle && !cycleModal.sourceCycleId) {
              mgr.updateCycle(cycleModal.cycle.id, data);
            } else if (cycleModal.sourceCycleId) {
              mgr.duplicateCycle(
                cycleModal.sourceCycleId,
                data.title,
                data.startDate,
                data.endDate
              );
            } else {
              mgr.createCycle(data.title, data.startDate, data.endDate);
            }
            setCycleModal({ open: false });
          }}
        />
      )}

      {/* Weekly Report modal */}
      {showWeeklyReport && (
        <WeeklyReportModalWrapper
          mgr={mgr}
          cycleProgress={cycleProgress}
          onClose={() => setShowWeeklyReport(false)}
        />
      )}
    </div>
  );
}

/** Thin wrapper to call useWeeklyReport inside render scope */
function WeeklyReportModalWrapper({
  mgr,
  cycleProgress,
  onClose,
}: {
  mgr: ReturnType<typeof useOkrManager>;
  cycleProgress: number;
  onClose: () => void;
}) {
  const reportData = useWeeklyReport({
    cycleProgress,
    checkIns: mgr.checkIns,
    keyResults: mgr.keyResults,
  });
  return <WeeklyReportModal data={reportData} onClose={onClose} />;
}
