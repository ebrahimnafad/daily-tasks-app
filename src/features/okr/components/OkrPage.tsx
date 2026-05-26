import { useState } from 'react';
import '../okr.css';
import useOkrManager from '../hooks/useOkrManager';
import type { OkrObjective, OkrKeyResult, OkrCycle } from '../hooks/useOkrManager';
import CycleSelector from './CycleSelector';
import OkrProgress from './OkrProgress';
import ObjectiveCard from './ObjectiveCard';
import CheckInModal from './CheckInModal';
import ObjectiveModal from './ObjectiveModal';
import KeyResultModal from './KeyResultModal';
import CycleModal from './CycleModal';
import { useTaskOkrBridge } from '../hooks/useTaskOkrBridge';
import useToasts from '@/shared/hooks/useToasts';

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

export default function OkrPage() {
  const mgr = useOkrManager();
  const [modal, setModal] = useState<ModalState>(INITIAL_MODAL);
  const { addSyncToast } = useToasts();

  useTaskOkrBridge(mgr.recordCheckIn, (msg) => addSyncToast(msg, 'warn'));

  const [cycleModal, setCycleModal] = useState<{
    open: boolean;
    cycle?: OkrCycle;
    sourceCycleId?: string;
  }>({ open: false });

  const closeModal = () => setModal(INITIAL_MODAL);

  const activeCycle = mgr.activeCycle;
  const objectives = activeCycle ? mgr.objectivesForCycle(activeCycle.id) : [];
  const cycleProgress = activeCycle ? mgr.computeCycleProgress(activeCycle.id) : 0;
  const days = activeCycle ? mgr.daysRemaining(activeCycle) : 0;

  // Build checkInsMap once
  const checkInsMap: Record<string, typeof mgr.checkIns> = {};
  mgr.checkIns.forEach((ci) => {
    if (!checkInsMap[ci.keyResultId]) checkInsMap[ci.keyResultId] = [];
    checkInsMap[ci.keyResultId].push(ci);
  });

  // ── Handlers ────────────────────────────────────────────────────────────────

  return (
    <div className="okr-page">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="okr-header">
        <h1 className="fin-section__title">أهدافي</h1>
        <CycleSelector
          cycles={mgr.cycles}
          activeCycle={activeCycle}
          onSelect={() => {
            /* v1: only one active cycle; selection is display-only */
          }}
          onCreateCycle={() => setCycleModal({ open: true, cycle: undefined })}
          onEditCycle={(cycle) => setCycleModal({ open: true, cycle })}
          onDuplicateCycle={(cycle) =>
            setCycleModal({
              open: true,
              cycle: { ...cycle, id: '', title: 'نسخة من: ' + cycle.title },
              sourceCycleId: cycle.id,
            })
          }
          onDeleteCycle={(id) => mgr.deleteCycle(id)}
          onReactivateCycle={(id) => mgr.reactivateCycle(id)}
          onArchiveCycle={(id) => mgr.archiveCycle(id)}
        />
      </div>

      {/* ── Active cycle summary OR empty state ──────────────────────────── */}
      {activeCycle ? (
        <div className="okr-cycle-summary">
          <OkrProgress
            progress={cycleProgress}
            size={100}
            strokeWidth={8}
            sublabel={mgr.quarterLabel(activeCycle.startDate)}
          />
          <div className="okr-cycle-summary__meta">
            <p className="okr-cycle-summary__title">{activeCycle.title}</p>
            <p className="okr-cycle-summary__days">
              {days > 0 ? `${days} يوم متبقي` : 'انتهت الدورة'}
            </p>
          </div>
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
    </div>
  );
}
