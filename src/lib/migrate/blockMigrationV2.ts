// ══════════════════════════════════════════════════════════════════
//  blockMigrationV2.ts — One-time migration: old block IDs → canonical
// ══════════════════════════════════════════════════════════════════
//
//  Triggered once on first app load after the canonical-block redesign.
//  Guards itself with a localStorage flag so it never runs twice.
//
//  What it does:
//    1. Remaps task.timeBlock using BLOCK_ID_MIGRATION_V2
//    2. Replaces each shift's blocks[] with the new canonical blocks,
//       preserving all other shift metadata (offDays, weekStartHour, etc.)
//
import type { Task } from '@/types';
import {
  type ShiftConfig,
  BLOCK_ID_MIGRATION_V2,
  DEFAULT_SHIFTS,
} from '@/features/tasks/data/scheduleConfig';

const MIGRATION_FLAG = 'mhm_migration_blocks_v2';

/** True when the migration has already been applied in this browser. */
export function isMigrationDone(): boolean {
  return Boolean(localStorage.getItem(MIGRATION_FLAG));
}

/** Mark migration as complete — call AFTER successfully saving migrated data. */
function markMigrationDone(): void {
  localStorage.setItem(MIGRATION_FLAG, '1');
}

/**
 * Remap task.timeBlock from old IDs → new canonical IDs.
 * Any unknown ID (user-created block) is left unchanged.
 */
function migrateTasks(tasks: Task[]): Task[] {
  return tasks.map((t) => {
    const oldId = t.timeBlock ?? 'anytime';
    const newId = BLOCK_ID_MIGRATION_V2[oldId] ?? oldId; // unknown = keep as-is
    return newId === oldId ? t : { ...t, timeBlock: newId };
  });
}

/**
 * Replace each shift's blocks[] with the new canonical blocks while preserving
 * all user-customised shift metadata (offDays, weekStartHour, etc.).
 *
 * dayOverrides are cleared — they referenced old block IDs and would drift otherwise.
 * The user can re-apply day overrides via ScheduleSettingsModal after migration.
 */
function migrateSchedule(schedule: ShiftConfig[]): ShiftConfig[] {
  return schedule.map((storedShift) => {
    const canonicalShift = DEFAULT_SHIFTS.find((s) => s.id === storedShift.id);
    if (!canonicalShift) return storedShift; // unknown shift — leave untouched
    return {
      ...storedShift,
      blocks: canonicalShift.blocks, // canonical block structure
      dayOverrides: {}, // cleared — old IDs would drift
    };
  });
}

/**
 * Run the one-time block migration.
 *
 * Returns `{ tasks, schedule, changed: true }` with migrated data on first run.
 * Returns `{ tasks, schedule, changed: false }` on all subsequent calls (no-op).
 *
 * Caller is responsible for saving the migrated data back to the server.
 * Call `markMigrationDone()` only AFTER the save succeeds (or optimistically
 * for personal-use apps where the risk of partial failure is acceptable).
 */
export function runBlockMigrationV2(
  tasks: Task[],
  schedule: ShiftConfig[]
): { tasks: Task[]; schedule: ShiftConfig[]; changed: boolean } {
  if (isMigrationDone()) {
    return { tasks, schedule, changed: false };
  }

  const migratedTasks = migrateTasks(tasks);
  const migratedSchedule = migrateSchedule(schedule);

  // Mark done immediately — personal-use app, acceptable to be optimistic
  markMigrationDone();

  return { tasks: migratedTasks, schedule: migratedSchedule, changed: true };
}
