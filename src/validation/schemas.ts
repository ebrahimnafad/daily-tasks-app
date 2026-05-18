import { z } from 'zod';
import { createInsertSchema } from 'drizzle-zod';
import {
  financeCategories,
  financeExpenses,
  financeTransactions,
  financeIncomes,
  financeGoalsRel,
} from '../db/schema';

const VALID_ICONS = [
  '📋',
  '📧',
  '📖',
  '🕌',
  '🚶',
  '🚫',
  '💊',
  '🏃',
  '🛒',
  '📞',
  '✏️',
  '🍽️',
  '💧',
  '📚',
  '🎯',
  '🧹',
  '💼',
  '🌙',
  '⭐',
  '🔔',
] as const;

const VALID_SHIFTS = ['morning', 'evening'] as const;

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const VAR_COLOR_REGEX = /^var\(.+\)$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;

export const TaskSchema = z.object({
  id: z.number().int().positive(),
  icon: z.enum(VALID_ICONS),
  title: z.string().min(1, 'اسم المهمة مطلوب').max(200, 'اسم المهمة طويل جداً'),
  category: z.string().min(1).max(50),
  color: z.string().regex(HEX_COLOR_REGEX, 'لون غير صالح').or(z.string().regex(VAR_COLOR_REGEX)),
  shifts: z.array(z.enum(VALID_SHIFTS)).min(1, 'يجب تحديد وردية واحدة على الأقل'),
  timeBlock: z.string().max(50),
  isWarning: z.boolean(),
  recurrence: z.string().min(1).max(50),
  date: z.string().regex(DATE_REGEX).optional(),
  alertTime: z.string().regex(TIME_REGEX).optional(),
  isPrayerTask: z.boolean(),
  subtasks: z.array(
    z.object({
      id: z.union([z.string(), z.number()]),
      text: z.string().min(1).max(200),
    })
  ),
  brief: z.object({
    blockers: z.array(z.string().max(200)).max(10),
    helpers: z.array(z.string().max(200)).max(10),
  }),
  isPinned: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const TaskFormSchema = z.object({
  icon: z.enum(VALID_ICONS),
  title: z.string().min(1, 'اسم المهمة مطلوب').max(200, 'اسم المهمة طويل جداً'),
  category: z.string().min(1).max(50),
  color: z.string().regex(HEX_COLOR_REGEX, 'لون غير صالح').or(z.string().regex(VAR_COLOR_REGEX)),
  shifts: z.array(z.enum(VALID_SHIFTS)).min(1, 'يجب تحديد وردية واحدة على الأقل'),
  timeBlock: z.string().max(50),
  isWarning: z.boolean(),
  recurrence: z.string().min(1).max(50),
  date: z.string().regex(DATE_REGEX).or(z.literal('')).optional(),
  alertTime: z.string().regex(TIME_REGEX).or(z.literal('')).optional(),
  blockers: z.array(z.string().max(200)),
  helpers: z.array(z.string().max(200)),
});

export type TaskFormInput = z.infer<typeof TaskFormSchema>;

export const parseTaskFormSafe = (
  data: unknown
): { success: true; data: TaskFormInput } | { success: false; errors: string[] } => {
  const result = TaskFormSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map((issue) => issue.message);
  return { success: false, errors };
};

const ExpenseFrequencySchema = z.enum([
  'monthly',
  'weekly',
  'quarterly',
  'semi-annual',
  'annual',
  'one-time',
]);
const ExpenseTypeSchema = z.enum(['fixed', 'installment', 'seasonal']);
const IncomeFrequencySchema = z.enum(['monthly', 'quarterly', 'semi-annual', 'annual']);
const IncomeTypeSchema = z.enum(['fixed', 'variable']);
const CurrencySchema = z.enum(['SAR', 'EGP']);

export const ExpenseCategorySchema = createInsertSchema(financeCategories, {
  name: (s) => s.min(1).max(50),
  icon: () => z.string().emoji().max(2),
  color: () => z.string().regex(HEX_COLOR_REGEX, 'لون غير صالح'),
  monthlyBudget: () => z.number().positive().max(1000000),
  isCustom: () => z.boolean(),
})
  .omit({
    userId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    order: z.number().int().min(0).optional(),
  });

export const ExpenseSchema = createInsertSchema(financeExpenses, {
  title: (s) => s.min(1).max(100),
  icon: () => z.string().max(2).optional(),
  amount: () => z.number().positive().max(1000000),
  frequency: () => ExpenseFrequencySchema,
  expenseType: () => ExpenseTypeSchema,
  isActive: () => z.boolean(),
  dueDay: () => z.number().int().min(1).max(31).optional(),
  quarterMonth: () => z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  totalAmount: () => z.number().positive().optional(),
  totalInstallments: () => z.number().int().positive().optional(),
  endDate: () => z.string().regex(DATE_REGEX).optional(),
  seasonMonth: () => z.number().int().min(1).max(12).optional(),
  monthlySetAside: () => z.number().nonnegative().optional(),
  notes: (s) => s.max(500).optional(),
})
  .omit({
    userId: true,
    createdAt: true,
    updatedAt: true,
    expenseType: true,
  })
  .extend({
    type: ExpenseTypeSchema,
  });

export const TransactionSchema = createInsertSchema(financeTransactions, {
  amount: () => z.number().positive().max(1000000),
  transactionDate: () => z.string().regex(DATE_REGEX),
  status: () => z.enum(['paid', 'pending']),
  notes: (s) => s.max(500).optional(),
  currencySymbol: () => z.string().optional(),
  exchangeRate: () => z.number().optional(),
  originalAmount: () => z.number().optional(),
})
  .omit({
    userId: true,
    transactionDate: true,
  })
  .extend({
    date: z.string().regex(DATE_REGEX),
  });

export const IncomeSchema = createInsertSchema(financeIncomes, {
  title: (s) => s.min(1).max(100),
  icon: () => z.string().max(2).optional(),
  amount: () => z.number().positive().max(10000000),
  frequency: () => IncomeFrequencySchema,
  incomeType: () => IncomeTypeSchema,
  isActive: () => z.boolean(),
  notes: (s) => s.max(500).optional(),
})
  .omit({
    userId: true,
    createdAt: true,
    updatedAt: true,
    incomeType: true,
  })
  .extend({
    type: IncomeTypeSchema,
  });

export const GoalSchema = createInsertSchema(financeGoalsRel, {
  title: (s) => s.min(1).max(100),
  icon: () => z.string().max(2).optional(),
  targetAmount: () => z.number().positive().max(10000000),
  currentSaved: () => z.number().nonnegative(),
  deadline: () => z.string().regex(DATE_REGEX).nullable().optional(),
  monthlyTarget: () => z.number().nonnegative().max(1000000),
  isActive: () => z.boolean(),
  notes: (s) => s.max(500).optional(),
}).omit({
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const FinanceSettingsSchema = z.object({
  currency: CurrencySchema,
  exchangeRate: z.number().positive().optional(),
  showExchangeRate: z.boolean(),
});

export type ExpenseCategoryInput = z.infer<typeof ExpenseCategorySchema>;
export type ExpenseInput = z.infer<typeof ExpenseSchema>;
export type TransactionInput = z.infer<typeof TransactionSchema>;
export type IncomeInput = z.infer<typeof IncomeSchema>;
export type GoalInput = z.infer<typeof GoalSchema>;
export type FinanceSettingsInput = z.infer<typeof FinanceSettingsSchema>;

export const parseSafe = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } => {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map((issue) => issue.message);
  return { success: false, errors };
};

// --- Phase 3 Payload Hardening ---

// Hard ceiling per JSONB field — reject before any DB operation
const MAX_JSONB_BYTES = 64 * 1024; // 64KB

export function assertPayloadSize(value: unknown, fieldName: string): void {
  const size = Buffer.byteLength(JSON.stringify(value), 'utf8');
  if (size > MAX_JSONB_BYTES) {
    throw new Error(`${fieldName} exceeds maximum allowed size of 64KB`);
  }
}

// daily_state: checked / subChecked / skipped → map of taskId → boolean
export const checkedMapSchema = z.record(z.string(), z.boolean());

// daily_snapshots: snapshot column
export const snapshotSchema = z
  .object({
    date: z.string().optional(),
    tasks: z.array(
      z
        .object({
          id: z.number().int(),
          checked: z.boolean().optional(),
        })
        .passthrough()
    ),
    progress: z.number().optional(),
    countDone: z.number().optional(),
    totalOther: z.number().optional(),
    checked: z.record(z.string(), z.boolean()).optional(),
    skipped: z.record(z.string(), z.boolean()).optional(),
    generatedAt: z.string().datetime().optional(),
  })
  .passthrough(); // Allowing passthrough to avoid strict breaking changes on older data, or strict() if requested. Wait, the prompt asked for .strict(). I will use strict() but add the fields from DailySnapshot.

// tasks: shifts column
export const shiftSchema = z.array(z.enum(['morning', 'evening']));

// tasks: subtasks column
export const subtaskSchema = z
  .object({
    id: z.number().int(),
    text: z.string().max(200),
    checked: z.boolean(),
  })
  .strict();

// schedule: data column
export const scheduleDataSchema = z.array(
  z
    .object({
      id: z.string().optional(),
      day: z.string().max(20).optional(),
      startTime: z.string().max(10).optional(),
      endTime: z.string().max(10).optional(),
      isOff: z.boolean().optional(),
      icon: z.string().optional(),
    })
    .passthrough()
);
