import { describe, it, expect, beforeEach } from 'vitest';
import { enqueuePending, dequeuePendingEntity, flushPending, PENDING_SYNC_KEY } from '../syncQueue';
import { lsGet } from '@/lib/storage/localStorage';

// Mock localStorage for Node environment
const store = new Map<string, string>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).localStorage = {
  getItem: (key: string) => store.get(key) || null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
};

describe('syncQueue', () => {
  beforeEach(() => {
    store.clear();
  });

  it('should enqueue and flush pending items', () => {
    enqueuePending('tasks', { id: 1, title: 'test' });
    const queue = flushPending();
    expect(queue).toHaveLength(1);
    expect(queue[0].payload).toEqual({ id: 1, title: 'test' });
    expect(flushPending()).toHaveLength(0);
  });

  it('should handle chained mutation conflicts by dequeueing specific entity', () => {
    // 1. Enqueue multiple mutations for different entities
    enqueuePending('tasks', { id: 1, title: 'Task 1 v1' }, 1);
    enqueuePending('tasks', { id: 2, title: 'Task 2 v1' }, 2);
    // 2. Enqueue a chained mutation for entity 1
    enqueuePending('tasks', { id: 1, title: 'Task 1 v2' }, 1);

    // Initial check: entity 1 should only have the LATEST mutation (due to the way enqueuePending deduplicates by entityId)
    // Wait, enqueuePending currently does:
    // const filtered = entityId ? queue.filter((q) => !(q.type === type && q.entityId === entityId)) : ...
    // So it drops previous mutations for the SAME entity! This IS chained mutation handling.

    let queue = lsGet(PENDING_SYNC_KEY, []);
    expect(queue).toHaveLength(2); // One for Task 1, one for Task 2
    expect(queue.find((q) => q.entityId === 1)?.payload).toEqual({ id: 1, title: 'Task 1 v2' });

    // 3. Now simulate a 409/410 conflict on entity 1, we dequeue it entirely
    dequeuePendingEntity('tasks', 1);

    queue = lsGet(PENDING_SYNC_KEY, []);
    expect(queue).toHaveLength(1); // Only Task 2 remains
    expect(queue[0].entityId).toBe(2);
  });
});
