import type { Task } from '@/types';

export interface TaskDelta {
  changed: Task[];
  deletedIds: string[];
}

export function computeTaskDelta(prevTasks: Task[], newTasks: Task[]): TaskDelta {
  const prevMap = new Map<string, Task>();
  for (const pt of prevTasks) {
    prevMap.set(String(pt.id), pt);
  }

  const changed: Task[] = [];
  const newIds = new Set<string>();

  for (const nt of newTasks) {
    const id = String(nt.id);
    newIds.add(id);
    const old = prevMap.get(id);

    if (!old) {
      changed.push(nt);
    } else {
      // Safe deep comparison assuming JSON-serializable state
      if (JSON.stringify(old) !== JSON.stringify(nt)) {
        changed.push(nt);
      }
    }
  }

  const deletedIds: string[] = [];
  for (const pt of prevTasks) {
    const id = String(pt.id);
    if (!newIds.has(id)) {
      deletedIds.push(id);
    }
  }

  return { changed, deletedIds };
}
