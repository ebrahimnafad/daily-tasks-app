import { describe, it, expect } from 'vitest';
import { reconcile, reconcileChecked, type LocalState, type RemoteState } from '../reconcile';

describe('reconcile', () => {
  describe('reconcile (generic)', () => {
    it('should prefer remote when timestamp is newer', () => {
      const local: LocalState<{ id: number; title: string }[]> = {
        data: [{ id: 1, title: 'Local Task' }],
        timestamp: 100,
      };
      const remote: RemoteState<{ id: number; title: string }[]> = {
        data: [{ id: 1, title: 'Remote Task' }],
        timestamp: 200,
      };

      const result = reconcile(local, remote);

      expect(result.winner).toBe('remote');
      expect(result.mergedData).toEqual(remote.data);
    });

    it('should prefer local when timestamp is newer', () => {
      const local: LocalState<{ id: number; title: string }[]> = {
        data: [{ id: 1, title: 'Local Task' }],
        timestamp: 300,
      };
      const remote: RemoteState<{ id: number; title: string }[]> = {
        data: [{ id: 1, title: 'Remote Task' }],
        timestamp: 200,
      };

      const result = reconcile(local, remote);

      expect(result.winner).toBe('local');
      expect(result.mergedData).toEqual(local.data);
    });

    it('should merge non-conflicting changes when timestamps equal', () => {
      const local: LocalState<{ id: number; done: boolean }[]> = {
        data: [{ id: 1, done: true }],
        timestamp: 100,
      };
      const remote: RemoteState<{ id: number; done: boolean }[]> = {
        data: [{ id: 2, done: true }],
        timestamp: 100,
      };

      const result = reconcile(local, remote);

      expect(result.winner).toBe('merged');
      expect(result.mergedData).toHaveLength(2);
      expect(result.mergedData).toContainEqual({ id: 1, done: true });
      expect(result.mergedData).toContainEqual({ id: 2, done: true });
    });

    it('should use item-level updatedAt for deterministic merge', () => {
      const local: LocalState<{ id: number; title: string; updatedAt?: number }[]> = {
        data: [{ id: 1, title: 'Local Old', updatedAt: 50 }],
        timestamp: 100,
      };
      const remote: RemoteState<{ id: number; title: string; updatedAt?: number }[]> = {
        data: [{ id: 1, title: 'Remote New', updatedAt: 150 }],
        timestamp: 100,
      };

      const result = reconcile(local, remote);

      expect(result.winner).toBe('merged');
      expect(result.mergedData[0].title).toBe('Remote New');
    });

    it('should handle empty local data', () => {
      const local: LocalState<{ id: number }[]> = {
        data: [],
        timestamp: 0,
      };
      const remote: RemoteState<{ id: number }[]> = {
        data: [{ id: 1 }],
        timestamp: 100,
      };

      const result = reconcile(local, remote);

      expect(result.winner).toBe('remote');
      expect(result.mergedData).toEqual(remote.data);
    });

    it('should handle empty remote data', () => {
      const local: LocalState<{ id: number }[]> = {
        data: [{ id: 1 }],
        timestamp: 100,
      };
      const remote: RemoteState<{ id: number }[]> = {
        data: [],
        timestamp: 0,
      };

      const result = reconcile(local, remote);

      expect(result.winner).toBe('local');
      expect(result.mergedData).toEqual(local.data);
    });

    it('should return both timestamps in result', () => {
      const local: LocalState<{ id: number }[]> = {
        data: [],
        timestamp: 100,
      };
      const remote: RemoteState<{ id: number }[]> = {
        data: [],
        timestamp: 200,
      };

      const result = reconcile(local, remote);

      expect(result.localTimestamp).toBe(100);
      expect(result.remoteTimestamp).toBe(200);
    });
  });

  describe('reconcileChecked', () => {
    it('should prefer remote when timestamp is newer', () => {
      const local: LocalState<Record<string, boolean>> = {
        data: { task1: true },
        timestamp: 100,
      };
      const remote: RemoteState<Record<string, boolean>> = {
        data: { task1: false },
        timestamp: 200,
      };

      const result = reconcileChecked(local, remote);

      expect(result.winner).toBe('remote');
      expect(result.mergedData).toEqual({ task1: false });
    });

    it('should merge checked states on equal timestamps', () => {
      const local: LocalState<Record<string, boolean>> = {
        data: { task1: true },
        timestamp: 100,
      };
      const remote: RemoteState<Record<string, boolean>> = {
        data: { task2: true },
        timestamp: 100,
      };

      const result = reconcileChecked(local, remote);

      expect(result.winner).toBe('merged');
      expect(result.mergedData).toEqual({ task1: true, task2: true });
    });
  });
});
