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
    clientId: uuid('client_id').defaultRandom(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId] }),
    updatedAtIndex: index('idx_schedule_updated_at').on(table.updatedAt),
  })
);

export const tasks = pgTable(
  'tasks',
  {
    id: serial('id').primaryKey(),
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
  },
  (table) => ({
    updatedAtIndex: index('idx_calendar_notes_updated_at').on(table.updatedAt),
  })
);
