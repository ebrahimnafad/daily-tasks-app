import { TaskSchema } from './src/validation/schemas.ts';
const t = {
  id: 1,
  icon: '📋',
  title: 'Test',
  category: 'عادي',
  color: '#000000',
  shifts: ['morning'],
  timeBlock: 'anytime',
  isWarning: false,
  recurrence: 'يومياً',
  isPrayerTask: false,
  subtasks: [],
  brief: { blockers: [], helpers: [] },
  date: '',
};
const res = TaskSchema.safeParse(t);
console.log(res.error?.issues);
