import { describe, it, expect } from 'vitest';
import { computeTaskDelta } from '../delta';
import type { Task } from '@/types';

// Mock task generator for clean tests
const t = (id: string, title: string, extra?: Partial<Task>): Task =>
  ({
    id,
    title,
    subtasks: [],
    shifts: ['morning'],
    ...extra,
  }) as Task;

describe('computeTaskDelta', () => {
  it('detects no changes when arrays are identical', () => {
    const prev = [t('1', 'A'), t('2', 'B')];
    const next = [t('1', 'A'), t('2', 'B')];

    const delta = computeTaskDelta(prev, next);
    expect(delta.changed).toHaveLength(0);
    expect(delta.deletedIds).toHaveLength(0);
  });

  it('detects no changes when tasks are just reordered', () => {
    const prev = [t('1', 'A'), t('2', 'B'), t('3', 'C')];
    const next = [t('3', 'C'), t('1', 'A'), t('2', 'B')];

    const delta = computeTaskDelta(prev, next);
    expect(delta.changed).toHaveLength(0);
    expect(delta.deletedIds).toHaveLength(0);
  });

  it('detects added tasks', () => {
    const prev = [t('1', 'A')];
    const next = [t('1', 'A'), t('2', 'B')];

    const delta = computeTaskDelta(prev, next);
    expect(delta.changed).toHaveLength(1);
    expect(delta.changed[0].id).toBe('2');
    expect(delta.deletedIds).toHaveLength(0);
  });

  it('detects deleted tasks', () => {
    const prev = [t('1', 'A'), t('2', 'B')];
    const next = [t('1', 'A')];

    const delta = computeTaskDelta(prev, next);
    expect(delta.changed).toHaveLength(0);
    expect(delta.deletedIds).toEqual(['2']);
  });

  it('detects modified tasks', () => {
    const prev = [t('1', 'A'), t('2', 'B')];
    const next = [t('1', 'A'), t('2', 'B Modified')];

    const delta = computeTaskDelta(prev, next);
    expect(delta.changed).toHaveLength(1);
    expect(delta.changed[0].id).toBe('2');
    expect(delta.changed[0].title).toBe('B Modified');
    expect(delta.deletedIds).toHaveLength(0);
  });

  it('handles addition, modification, deletion, and reordering simultaneously', () => {
    const prev = [t('1', 'A'), t('2', 'B'), t('3', 'C')];
    // 1 modified, 2 deleted, 3 unchanged, 4 added. Then shuffled.
    const next = [t('4', 'D'), t('3', 'C'), t('1', 'A Modified')];

    const delta = computeTaskDelta(prev, next);
    expect(delta.changed).toHaveLength(2);
    // order of `changed` matches order in `next` array
    expect(delta.changed.map((c) => c.id)).toEqual(['4', '1']);
    expect(delta.deletedIds).toEqual(['2']);
  });
});
