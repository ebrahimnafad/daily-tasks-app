import { z } from 'zod';

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

export const ExpenseCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(50),
  icon: z.string().emoji().max(2),
  color: z.string().regex(HEX_COLOR_REGEX, 'لون غير صالح'),
  monthlyBudget: z.number().positive().max(1000000),
  isCustom: z.boolean(),
  order: z.number().int().min(0),
});

export const ExpenseSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  title: z.string().min(1).max(100),
  icon: z.string().max(2),
  amount: z.number().positive().max(1000000),
  frequency: ExpenseFrequencySchema,
  type: ExpenseTypeSchema,
  isActive: z.boolean(),
  dueDay: z.number().int().min(1).max(31).optional(),
  quarterMonth: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  totalAmount: z.number().positive().optional(),
  totalInstallments: z.number().int().positive().optional(),
  endDate: z.string().regex(DATE_REGEX).optional(),
  seasonMonth: z.number().int().min(1).max(12).optional(),
  monthlySetAside: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
});

export const TransactionSchema = z.object({
  id: z.string().min(1),
  expenseId: z.string().optional(),
  categoryId: z.string().min(1),
  amount: z.number().positive().max(1000000),
  date: z.string().regex(DATE_REGEX),
  status: z.enum(['paid', 'pending']),
  notes: z.string().max(500).optional(),
  currencySymbol: z.string().optional(),
  exchangeRate: z.number().optional(),
  originalAmount: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const IncomeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  icon: z.string().max(2),
  amount: z.number().positive().max(10000000),
  frequency: IncomeFrequencySchema,
  type: IncomeTypeSchema,
  isActive: z.boolean(),
  notes: z.string().max(500).optional(),
});

export const GoalSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  icon: z.string().max(2),
  targetAmount: z.number().positive().max(10000000),
  currentSaved: z.number().nonnegative(),
  deadline: z.string().regex(DATE_REGEX).nullable().optional(),
  monthlyTarget: z.number().nonnegative().max(1000000),
  isActive: z.boolean(),
  notes: z.string().max(500).optional(),
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
