import {
  pgTable,
  serial,
  text,
  timestamp,
  jsonb,
  uuid,
  date,
  integer,
  boolean,
  numeric,
  index,
  primaryKey,
  pgEnum,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const recurrenceEnum = pgEnum('recurrence_enum', [
  'يومي',
  'مرة واحدة',
  'أسبوعي',
  'شهري',
  'سنوي',
  'كل يومين',
  'أيام العمل',
  'موعد محدد',
  'صلاة',
]);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const dailyState = pgTable(
  'daily_state',
  {
    userId: integer('user_id')
      .references(() => users.id)
      .notNull(),
    date: date('date').notNull(),
    checked: jsonb('checked').default({}),
    subChecked: jsonb('sub_checked').default({}),
    skipped: jsonb('skipped').default({}),
    clientId: uuid('client_id').defaultRandom(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.date] }),
    updatedAtIndex: index('idx_daily_state_updated_at').on(table.updatedAt),
    checkedIsObject: check('checked_is_object', sql`jsonb_typeof(${table.checked}) = 'object'`),
    subCheckedIsObject: check(
      'sub_checked_is_object',
      sql`jsonb_typeof(${table.subChecked}) = 'object'`
    ),
    skippedIsObject: check('skipped_is_object', sql`jsonb_typeof(${table.skipped}) = 'object'`),
  })
);

export const dailySnapshots = pgTable(
  'daily_snapshots',
  {
    userId: integer('user_id')
      .references(() => users.id)
      .notNull(),
    date: date('date').notNull(),
    snapshot: jsonb('snapshot').notNull().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.date] }),
    dateIndex: index('idx_daily_snapshots_date').on(table.date),
  })
);

export const scheduleConfig = pgTable(
  'schedule_config',
  {
    userId: integer('user_id')
      .references(() => users.id)
      .notNull(),
    data: jsonb('data').notNull().default([]),
    dayStartHour: integer('day_start_hour').notNull().default(0),
    offExceptions: jsonb('off_exceptions').notNull().default([]),
    workExceptions: jsonb('work_exceptions').notNull().default([]),
    vacationDays: jsonb('vacation_days').notNull().default([]),
    vacationBalance: integer('vacation_balance').notNull().default(0),
    clientId: uuid('client_id').defaultRandom(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ name: 'schedule_config_user_id_pk', columns: [table.userId] }),
    updatedAtIndex: index('idx_schedule_updated_at').on(table.updatedAt),
  })
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id)
      .notNull(),
    icon: text('icon'),
    title: text('title').notNull(),
    category: text('category'),
    color: text('color'),
    shifts: jsonb('shifts').default([]),
    timeBlock: text('time_block'),
    isWarning: boolean('is_warning').default(false),
    recurrence: recurrenceEnum('recurrence'),
    targetDate: date('target_date'),
    alertTime: text('alert_time'),
    isPrayerTask: boolean('is_prayer_task').default(false),
    isPinned: boolean('is_pinned').default(false),
    subtasks: jsonb('subtasks').default([]),
    brief: jsonb('brief').default({}),
    /** Phase 3: OKR task linking — nullable until Phase 3 ships */
    linkedKeyResultId: uuid('linked_key_result_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    subtasksIsArray: check(
      'subtasks_is_array',
      sql`jsonb_typeof(${table.subtasks}) = 'array' OR ${table.subtasks} IS NULL`
    ),
  })
);

export const financeIncomes = pgTable('finance_incomes', {
  id: uuid('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  title: text('title').notNull(),
  icon: text('icon'),
  amount: numeric('amount').notNull(),
  frequency: text('frequency'),
  incomeType: text('income_type'),
  isActive: boolean('is_active').default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const financeCategories = pgTable('finance_categories', {
  id: uuid('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  name: text('name').notNull(),
  icon: text('icon'),
  color: text('color'),
  monthlyBudget: numeric('monthly_budget'),
  isCustom: boolean('is_custom').default(false),
  displayOrder: integer('display_order'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const financeExpenses = pgTable('finance_expenses', {
  id: uuid('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  categoryId: uuid('category_id').references(() => financeCategories.id),
  title: text('title').notNull(),
  icon: text('icon'),
  amount: numeric('amount').notNull(),
  frequency: text('frequency'),
  expenseType: text('expense_type'),
  isActive: boolean('is_active').default(true),
  dueDay: integer('due_day'),
  quarterMonth: integer('quarter_month'),
  totalAmount: numeric('total_amount'),
  totalInstallments: integer('total_installments'),
  endDate: date('end_date'),
  seasonMonth: integer('season_month'),
  monthlySetAside: numeric('monthly_set_aside'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const financeTransactions = pgTable('finance_transactions', {
  id: uuid('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  expenseId: uuid('expense_id').references(() => financeExpenses.id),
  categoryId: uuid('category_id')
    .references(() => financeCategories.id)
    .notNull(),
  amount: numeric('amount').notNull(),
  transactionDate: date('transaction_date').notNull(),
  status: text('status'),
  notes: text('notes'),
  currencySymbol: text('currency_symbol'),
  exchangeRate: numeric('exchange_rate'),
  originalAmount: numeric('original_amount'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const financeGoalsRel = pgTable('finance_goals_rel', {
  id: uuid('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  title: text('title').notNull(),
  icon: text('icon'),
  targetAmount: numeric('target_amount').notNull(),
  currentSaved: numeric('current_saved').default('0'),
  deadline: date('deadline'),
  monthlyTarget: numeric('monthly_target'),
  isActive: boolean('is_active').default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const calendarNotesRel = pgTable(
  'calendar_notes_rel',
  {
    id: uuid('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id)
      .notNull(),
    noteDate: date('note_date').notNull(),
    noteText: text('note_text').notNull(),
    isPinned: boolean('is_pinned').default(false),
    tags: jsonb('tags').default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    updatedAtIndex: index('idx_calendar_notes_updated_at').on(table.updatedAt),
  })
);

// ══════════════════════════════════════════════════════════════════════
//  OKR — Personal Objectives & Key Results
// ══════════════════════════════════════════════════════════════════════

export const okrCycles = pgTable('okr_cycles', {
  id: uuid('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  title: text('title').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  /** 'active' | 'archived' | 'draft' */
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const okrObjectives = pgTable('okr_objectives', {
  id: uuid('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  cycleId: uuid('cycle_id')
    .references(() => okrCycles.id)
    .notNull(),
  title: text('title').notNull(),
  icon: text('icon'),
  color: text('color'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const okrKeyResults = pgTable('okr_key_results', {
  id: uuid('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  objectiveId: uuid('objective_id')
    .references(() => okrObjectives.id)
    .notNull(),
  title: text('title').notNull(),
  /** 'numeric' | 'binary' */
  type: text('type').notNull().default('numeric'),
  /** 'count' | 'percent' | 'currency' | 'custom' */
  unit: text('unit').notNull().default('count'),
  customUnit: text('custom_unit'),
  /** Target value. For binary KRs this is always 1. */
  targetValue: numeric('target_value').notNull().default('1'),
  /**
   * Denormalized current value — updated atomically on every check-in insert.
   * Must never drift from the sum of check-ins (enforced server-side in a transaction).
   */
  currentValue: numeric('current_value').notNull().default('0'),
  sortOrder: integer('sort_order').notNull().default(0),
  /** Phase 3: optional link to a daily task (manual, not auto-tracked in v1) */
  linkedTaskId: uuid('linked_task_id'),
  /** Phase 4 (v2): optional link to a finance goal for cross-feature progress */
  linkedFinanceGoalId: uuid('linked_finance_goal_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

/**
 * Check-ins are IMMUTABLE APPEND-ONLY records.
 * - No updatedAt column (intentional — a check-in's value never changes after insert).
 * - No deletedAt / soft-delete (intentional — cascade-delete by keyResultId only).
 * - currentValue on okrKeyResults is updated atomically in the same DB transaction
 *   to ensure it never drifts from the real sum of check-ins.
 */
export const okrCheckIns = pgTable('okr_check_ins', {
  id: uuid('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  keyResultId: uuid('key_result_id')
    .references(() => okrKeyResults.id)
    .notNull(),
  checkInDate: date('check_in_date').notNull(),
  /** Delta value added (positive). For binary KRs this must be 0 or 1. */
  value: numeric('value').notNull(),
  note: text('note'),
  /** 'manual' (user-entered) | 'task' (auto from linked daily task, Phase 3) */
  source: text('source').notNull().default('manual'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
