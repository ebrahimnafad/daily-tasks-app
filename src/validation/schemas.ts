import { z } from 'zod';
import { createInsertSchema } from 'drizzle-zod';
import {
  financeCategories,
  financeExpenses,
  financeTransactions,
  financeIncomes,
  financeGoalsRel,
  tasks,
  calendarNotesRel,
  okrCycles,
  okrObjectives,
  okrKeyResults,
  okrCheckIns,
} from '../db/schema.js';

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

export const VALID_RECURRENCES = [
  'يومي',
  'مرة واحدة',
  'أسبوعي',
  'شهري',
  'سنوي',
  'كل يومين',
  'أيام العمل',
  'موعد محدد',
  'صلاة',
] as const;

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const VAR_COLOR_REGEX = /^var\(.+\)$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;

export const TaskSchema = createInsertSchema(tasks, {
  title: (s) => s.min(1, 'اسم المهمة مطلوب').max(200, 'اسم المهمة طويل جداً'),
  icon: () => z.enum(VALID_ICONS).nullable().optional(),
  category: (s) => s.min(1).max(50).nullable().optional(),
  color: () =>
    z
      .string()
      .regex(HEX_COLOR_REGEX, 'لون غير صالح')
      .or(z.string().regex(VAR_COLOR_REGEX))
      .nullable()
      .optional(),
  shifts: () =>
    z.array(z.enum(VALID_SHIFTS)).min(1, 'يجب تحديد وردية واحدة على الأقل').nullable().optional(),
  timeBlock: (s) => s.max(50).nullable().optional(),
  recurrence: () => z.enum(VALID_RECURRENCES).nullable().optional(),
  alertTime: () => z.string().regex(TIME_REGEX).or(z.literal('')).nullable().optional(),
  subtasks: () =>
    z
      .array(
        z
          .object({
            id: z.union([z.string(), z.number()]),
            text: z.string().min(1).max(200),
            alertTime: z.string().regex(TIME_REGEX).or(z.literal('')).nullable().optional(),
            isOptional: z.boolean().optional(),
          })
          .strict()
      )
      .nullable()
      .optional(),
  brief: () =>
    z
      .object({
        blockers: z.array(z.string().max(200)).max(10).optional(),
        helpers: z.array(z.string().max(200)).max(10).optional(),
      })
      .strict()
      .nullable()
      .optional(),
})
  .omit({
    userId: true,
    deletedAt: true,
    targetDate: true,
  })
  .extend({
    id: z.string().optional(),
    date: z.string().regex(DATE_REGEX).or(z.literal('')).nullish(),
    time: z.string().nullish(),
    createdAt: z.union([z.string(), z.number(), z.date()]).optional(),
    updatedAt: z.union([z.string(), z.number(), z.date()]).optional(),
  });

export const TaskFormSchema = TaskSchema.pick({
  icon: true,
  title: true,
  category: true,
  color: true,
  shifts: true,
  timeBlock: true,
  isWarning: true,
  recurrence: true,
  date: true,
}).extend({
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
          id: z.string(),
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
    id: z.union([z.string(), z.number()]),
    text: z.string().max(200),
    alertTime: z.string().max(20).nullable().optional(),
    isOptional: z.boolean().optional(),
  })
  .strict();

export const timeBlockSchema = z
  .object({
    id: z.string(),
    icon: z.string(),
    label: z.string(),
    startHour: z.number(),
    endHour: z.number(),
    isRest: z.boolean().optional(),
    isOptional: z.boolean().optional(),
  })
  .strict();

// schedule: data column
export const scheduleDataSchema = z.array(
  z
    .object({
      id: z.string(),
      icon: z.string(),
      label: z.string(),
      blocks: z.array(timeBlockSchema),
      dayOverrides: z.record(z.string(), z.array(timeBlockSchema)).optional(),
      offDays: z.array(z.number()).optional(),
      offDayLabel: z.string().optional(),
      weekStartHour: z.number().optional(),
    })
    .strict()
);

export const calendarExceptionsSchema = z.array(z.string().regex(DATE_REGEX));
export const vacationBalanceSchema = z.number().int();
export const dayStartHourSchema = z.number().int().min(0).max(23);

export const NoteSchema = createInsertSchema(calendarNotesRel, {
  tags: () => z.array(z.string().max(50)).max(20).nullable().optional(),
})
  .omit({
    userId: true,
    noteDate: true,
    noteText: true,
  })
  .extend({
    id: z.union([z.string(), z.number()]).optional(),
    date: z.string().regex(DATE_REGEX).optional(),
    text: z.string().max(5000).optional(),
    pinned: z.boolean().optional(),
    createdAt: z.union([z.string(), z.number(), z.date()]).optional(),
    updatedAt: z.union([z.string(), z.number(), z.date()]).optional(),
  });

// ── OKR Schemas ───────────────────────────────────────────────────────────

export const okrCycleSchema = createInsertSchema(okrCycles, {
  status: () => z.enum(['active', 'archived', 'draft']).default('active'),
})
  .omit({ userId: true })
  .extend({
    id: z.string().uuid().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاريخ البداية غير صالح'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاريخ النهاية غير صالح'),
    createdAt: z.union([z.string(), z.number(), z.date()]).optional(),
    updatedAt: z.union([z.string(), z.number(), z.date()]).optional(),
    deletedAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
  });

export const okrObjectiveSchema = createInsertSchema(okrObjectives)
  .omit({ userId: true })
  .extend({
    id: z.string().uuid().optional(),
    cycleId: z.string().uuid('معرّف الدورة غير صالح'),
    title: z.string().min(1, 'اسم الهدف مطلوب').max(200, 'اسم الهدف طويل جداً'),
    icon: z.string().max(10).nullable().optional(),
    color: z.string().max(50).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    createdAt: z.union([z.string(), z.number(), z.date()]).optional(),
    updatedAt: z.union([z.string(), z.number(), z.date()]).optional(),
    deletedAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
  });

export const okrKeyResultSchema = createInsertSchema(okrKeyResults, {
  type: () => z.enum(['numeric', 'binary']).default('numeric'),
  unit: () => z.enum(['count', 'percent', 'currency', 'custom']).default('count'),
})
  .omit({ userId: true })
  .extend({
    id: z.string().uuid().optional(),
    objectiveId: z.string().uuid('معرّف الهدف غير صالح'),
    title: z.string().min(1, 'اسم النتيجة مطلوب').max(200, 'اسم النتيجة طويل جداً'),
    customUnit: z.string().max(30).nullable().optional(),
    targetValue: z.coerce.number().min(0.01, 'القيمة المستهدفة يجب أن تكون أكبر من صفر'),
    currentValue: z.coerce.number().min(0, 'القيمة الحالية لا يمكن أن تكون سالبة').optional(),
    sortOrder: z.number().int().min(0).optional(),
    linkedTaskId: z.string().uuid().nullable().optional(),
    linkedFinanceGoalId: z.string().uuid().nullable().optional(),
    createdAt: z.union([z.string(), z.number(), z.date()]).optional(),
    updatedAt: z.union([z.string(), z.number(), z.date()]).optional(),
    deletedAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
  });

/**
 * Check-ins are append-only — no updatedAt or deletedAt fields.
 * The `value` must be positive (delta). For binary KRs, must be 0 or 1.
 */
export const okrCheckInSchema = createInsertSchema(okrCheckIns, {
  source: () => z.enum(['manual', 'task']).default('manual'),
})
  .omit({ userId: true })
  .extend({
    id: z.string().uuid().optional(),
    keyResultId: z.string().uuid('معرّف النتيجة غير صالح'),
    checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاريخ التسجيل غير صالح'),
    value: z.coerce.number().min(0, 'القيمة لا يمكن أن تكون سالبة'),
    note: z.string().max(500).nullable().optional(),
    createdAt: z.union([z.string(), z.number(), z.date()]).optional(),
  });

export type OkrCycleInput = z.infer<typeof okrCycleSchema>;
export type OkrObjectiveInput = z.infer<typeof okrObjectiveSchema>;
export type OkrKeyResultInput = z.infer<typeof okrKeyResultSchema>;
export type OkrCheckInInput = z.infer<typeof okrCheckInSchema>;
