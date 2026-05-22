import { TaskSchema } from './src/validation/schemas.js';

const mockTask = {
  id: 'some-uuid',
  icon: '📋',
  title: 'Test Task',
  category: 'أخرى',
  color: '#aaaaaa',
  shifts: ['morning', 'evening'],
  timeBlock: 'anytime',
  isWarning: false,
  recurrence: 'يومي',
  date: '',
  alertTime: '',
  isPrayerTask: false,
  isPinned: false,
  subtasks: [],
  brief: {
    blockers: [],
    helpers: [],
  },
};

const result = TaskSchema.safeParse(mockTask);
if (!result.success) {
  console.log('Validation Failed:');
  console.log(JSON.stringify(result.error.format(), null, 2));
} else {
  console.log('Validation Succeeded!');
}
