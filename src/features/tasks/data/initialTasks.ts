import type { Task } from '@/types';

/**
 * Initial tasks based on the actual daily routine.
 * Each task declares which shift(s) it belongs to and which time block.
 *
 * shifts: ['morning'] | ['evening'] | ['morning', 'evening']
 * timeBlock: one of the block IDs from scheduleConfig.ts
 */
export const INITIAL_TASKS: Task[] = [
  // ══════════════════════════════════════════════════
  // 🕌 عبادة — تظهر في كلا الوردتين
  // ══════════════════════════════════════════════════
  {
    id: 1,
    icon: '🕌',
    title: 'الصلوات الخمس',
    shifts: ['morning', 'evening'],
    timeBlock: 'prayer',
    isPrayerTask: true,
    category: 'عبادة',
    color: 'var(--gold)',
    isWarning: false,
    recurrence: 'يومي',
    subtasks: [
      { id: 's1', text: 'الفجر' },
      { id: 's2', text: 'الظهر' },
      { id: 's3', text: 'العصر' },
      { id: 's4', text: 'المغرب' },
      { id: 's5', text: 'العشاء' },
    ],
    brief: {
      blockers: ['النوم بعد الفجر', 'الانشغال بالشاشات وقت الأذان', 'الكسل والتأجيل'],
      helpers: ['ضبط منبه لكل أذان', 'تطبيق أذان على الموبايل', 'الوضوء المبكر قبل الوقت'],
    },
  },
];
