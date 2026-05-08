export interface RemoteState<T> {
  data: T;
  timestamp: number;
  clientId?: string;
}

export interface LocalState<T> {
  data: T;
  timestamp: number;
  clientId?: string;
}

export interface ReconciliationResult<T> {
  winner: 'local' | 'remote' | 'merged';
  mergedData: T;
  localTimestamp: number;
  remoteTimestamp: number;
}

export function reconcile<T extends { id: number; updatedAt?: number }>(
  local: LocalState<T[]>,
  remote: LocalState<T[]>
): ReconciliationResult<T[]> {
  const { timestamp: localTimestamp, data: localData } = local;
  const { timestamp: remoteTimestamp, data: remoteData } = remote;

  if (remoteTimestamp > localTimestamp) {
    return {
      winner: 'remote',
      mergedData: remoteData,
      localTimestamp,
      remoteTimestamp,
    };
  }

  if (localTimestamp > remoteTimestamp) {
    return {
      winner: 'local',
      mergedData: localData,
      localTimestamp,
      remoteTimestamp,
    };
  }

  return {
    winner: 'merged',
    mergedData: deterministicMerge(localData, remoteData),
    localTimestamp,
    remoteTimestamp,
  };
}

function deterministicMerge<T extends { id: number; updatedAt?: number }>(
  local: T[],
  remote: T[]
): T[] {
  const merged = new Map<number, T>();

  local.forEach((item) => merged.set(item.id, item));

  remote.forEach((item) => {
    const existing = merged.get(item.id);
    if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) {
      merged.set(item.id, item);
    }
  });

  return Array.from(merged.values());
}

export function reconcileChecked(
  local: LocalState<Record<string, boolean>>,
  remote: LocalState<Record<string, boolean>>
): ReconciliationResult<Record<string, boolean>> {
  const { timestamp: localTimestamp, data: localData } = local;
  const { timestamp: remoteTimestamp, data: remoteData } = remote;

  if (remoteTimestamp > localTimestamp) {
    return {
      winner: 'remote',
      mergedData: remoteData,
      localTimestamp,
      remoteTimestamp,
    };
  }

  if (localTimestamp > remoteTimestamp) {
    return {
      winner: 'local',
      mergedData: localData,
      localTimestamp,
      remoteTimestamp,
    };
  }

  return {
    winner: 'merged',
    mergedData: { ...remoteData, ...localData },
    localTimestamp,
    remoteTimestamp,
  };
}
