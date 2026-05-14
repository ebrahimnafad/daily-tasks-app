import { describe, it, expect } from 'vitest';
import {
  TaskSchema,
  parseTaskFormSafe,
  ExpenseSchema,
  parseSafe,
  ExpenseCategorySchema,
  IncomeSchema,
  GoalSchema,
} from '../schemas';
import { z } from 'zod';

describe('TaskSchema', () => {
  const validTask = {
    id: 1,
    icon: '📋' as const,
    title: 'Test Task',
    category: 'عمل',
    color: '#FF5733',
    shifts: ['morning', 'evening'] as const,
    timeBlock: 'morning',
    isWarning: false,
    recurrence: 'daily',
    date: undefined,
    alertTime: undefined,
    isPrayerTask: false,
    subtasks: [],
    brief: {
      blockers: ['', '', ''],
      helpers: ['', '', ''],
    },
  };

  it('should validate correct task', () => {
    expect(() => TaskSchema.parse(validTask)).not.toThrow();
  });

  it('should reject title > 200 chars', () => {
    const task = {
      ...validTask,
      title: 'a'.repeat(201),
    };

    expect(() => TaskSchema.parse(task)).toThrow();
  });

  it('should reject empty title', () => {
    const task = {
      ...validTask,
      title: '',
    };

    expect(() => TaskSchema.parse(task)).toThrow();
  });

  it('should reject invalid icon', () => {
    const task = {
      ...validTask,
      icon: '🤔',
    };

    expect(() => TaskSchema.parse(task)).toThrow();
  });

  it('should reject invalid color format', () => {
    const task = {
      ...validTask,
      color: 'not-a-color',
    };

    expect(() => TaskSchema.parse(task)).toThrow();
  });

  it('should accept valid hex color', () => {
    const task = {
      ...validTask,
      color: '#FF5733',
    };

    expect(() => TaskSchema.parse(task)).not.toThrow();
  });

  it('should accept var() color', () => {
    const task = {
      ...validTask,
      color: 'var(--primary)',
    };

    expect(() => TaskSchema.parse(task)).not.toThrow();
  });

  it('should reject empty shifts array', () => {
    const task = {
      ...validTask,
      shifts: [],
    };

    expect(() => TaskSchema.parse(task)).toThrow();
  });

  it('should reject invalid shift value', () => {
    const task = {
      ...validTask,
      shifts: ['invalid' as 'morning'],
    };

    expect(() => TaskSchema.parse(task)).toThrow();
  });

  it('should reject negative id', () => {
    const task = {
      ...validTask,
      id: -1,
    };

    expect(() => TaskSchema.parse(task)).toThrow();
  });

  it('should accept valid date format', () => {
    const task = {
      ...validTask,
      date: '2026-05-08',
    };

    expect(() => TaskSchema.parse(task)).not.toThrow();
  });

  it('should reject invalid date format', () => {
    const task = {
      ...validTask,
      date: '08-05-2026',
    };

    expect(() => TaskSchema.parse(task)).toThrow();
  });

  it('should accept valid alertTime format', () => {
    const task = {
      ...validTask,
      alertTime: '14:30',
    };

    expect(() => TaskSchema.parse(task)).not.toThrow();
  });

  it('should reject invalid alertTime format', () => {
    const task = {
      ...validTask,
      alertTime: '2:30 PM',
    };

    expect(() => TaskSchema.parse(task)).toThrow();
  });

  it('should validate array of tasks via TaskSchema', () => {
    const tasks = [validTask];

    expect(() => z.array(TaskSchema).parse(tasks)).not.toThrow();
  });

  it('should throw on invalid array of tasks', () => {
    const tasks = [{ ...validTask, title: '' }];

    expect(() => z.array(TaskSchema).parse(tasks)).toThrow();
  });

  it('should accept variable-length brief arrays (what saveTask actually writes)', () => {
    // saveTask filters empty strings, so brief arrays can be 0..N items
    expect(() =>
      TaskSchema.parse({ ...validTask, brief: { blockers: [], helpers: [] } })
    ).not.toThrow();
    expect(() =>
      TaskSchema.parse({
        ...validTask,
        brief: { blockers: ['blocker 1'], helpers: ['helper 1', 'helper 2'] },
      })
    ).not.toThrow();
  });

  it('should reject brief arrays exceeding the max length', () => {
    const tooMany = Array.from({ length: 11 }, (_, i) => `item ${i}`);
    expect(() =>
      TaskSchema.parse({ ...validTask, brief: { blockers: tooMany, helpers: [] } })
    ).toThrow();
  });
});

describe('parseTaskFormSafe', () => {
  const validForm = {
    icon: '📋',
    title: 'Test Task',
    category: 'عمل',
    color: '#FF5733',
    shifts: ['morning'],
    timeBlock: 'anytime',
    isWarning: false,
    recurrence: 'daily',
    blockers: ['', '', ''],
    helpers: ['', '', ''],
  };

  it('should return success for valid form', () => {
    const result = parseTaskFormSafe(validForm);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validForm);
  });

  it('should return errors for invalid form', () => {
    const result = parseTaskFormSafe({ ...validForm, title: '' });

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should collect multiple errors', () => {
    const result = parseTaskFormSafe({
      ...validForm,
      title: '',
      icon: 'invalid' as '📋',
    });

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('ExpenseSchema', () => {
  it('should validate valid expense', () => {
    const expense = {
      id: '1',
      categoryId: 'cat1',
      title: 'Rent',
      icon: '🏠',
      amount: 5000,
      frequency: 'monthly' as const,
      type: 'fixed' as const,
      isActive: true,
    };

    expect(() => ExpenseSchema.parse(expense)).not.toThrow();
  });

  it('should reject negative amount', () => {
    const expense = {
      id: '1',
      categoryId: 'cat1',
      title: 'Rent',
      amount: -100,
      frequency: 'monthly' as const,
      type: 'fixed' as const,
      isActive: true,
    };

    expect(() => ExpenseSchema.parse(expense)).toThrow();
  });

  it('should reject invalid frequency', () => {
    const expense = {
      id: '1',
      categoryId: 'cat1',
      title: 'Rent',
      amount: 5000,
      frequency: 'daily' as const,
      type: 'fixed' as const,
      isActive: true,
    };

    expect(() => ExpenseSchema.parse(expense)).toThrow();
  });
});

describe('ExpenseCategorySchema', () => {
  it('should validate valid category', () => {
    const category = {
      id: '1',
      name: 'Housing',
      icon: '🏠',
      color: '#FF5733',
      monthlyBudget: 5000,
      isCustom: false,
      order: 0,
    };

    expect(() => ExpenseCategorySchema.parse(category)).not.toThrow();
  });

  it('should reject invalid color', () => {
    const category = {
      id: '1',
      name: 'Housing',
      icon: '🏠',
      color: 'red',
      monthlyBudget: 5000,
      isCustom: false,
      order: 0,
    };

    expect(() => ExpenseCategorySchema.parse(category)).toThrow();
  });
});

describe('IncomeSchema', () => {
  it('should validate valid income', () => {
    const income = {
      id: '1',
      title: 'Salary',
      icon: '💰',
      amount: 10000,
      frequency: 'monthly' as const,
      type: 'fixed' as const,
      isActive: true,
    };

    expect(() => IncomeSchema.parse(income)).not.toThrow();
  });
});

describe('GoalSchema', () => {
  it('should validate valid goal', () => {
    const goal = {
      id: '1',
      title: 'Emergency Fund',
      icon: '🎯',
      targetAmount: 50000,
      currentSaved: 10000,
      monthlyTarget: 1000,
      isActive: true,
    };

    expect(() => GoalSchema.parse(goal)).not.toThrow();
  });

  it('should accept nullable deadline', () => {
    const goal = {
      id: '1',
      title: 'Emergency Fund',
      icon: '🎯',
      targetAmount: 50000,
      currentSaved: 10000,
      deadline: null,
      monthlyTarget: 1000,
      isActive: true,
    };

    expect(() => GoalSchema.parse(goal)).not.toThrow();
  });
});

describe('parseSafe helper', () => {
  it('should return success with data', () => {
    const result = parseSafe(ExpenseSchema, {
      id: '1',
      categoryId: 'cat1',
      title: 'Rent',
      amount: 5000,
      frequency: 'monthly',
      type: 'fixed',
      isActive: true,
      icon: '🏠',
    });

    expect(result.success).toBe(true);
    expect(result.data.id).toBe('1');
  });

  it('should return errors on failure', () => {
    const result = parseSafe(ExpenseSchema, {
      id: '1',
      categoryId: 'cat1',
      title: 'Rent',
      amount: -100,
      frequency: 'monthly',
      type: 'fixed',
      isActive: true,
    });

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
