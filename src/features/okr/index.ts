// Barrel exports for the OKR feature module

// Main page
export { default as OkrPage } from './components/OkrPage';

// Hooks
export { default as useOkrSync } from './hooks/useOkrSync';
export { default as useOkrManager } from './hooks/useOkrManager';
export { quarterLabel, currentQuarterDates } from './hooks/useOkrManager';

// Types (re-exported from the sync hook for convenience)
export type {
  OkrCycle,
  OkrObjective,
  OkrKeyResult,
  OkrCheckIn,
  OkrData,
  KRType,
  KRUnit,
  CheckInSource,
  OkrStatus,
} from './hooks/useOkrSync';
