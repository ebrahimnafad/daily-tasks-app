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

export function reconcile<T extends { id: string | number; updatedAt?: number }>(
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

function deterministicMerge<T extends { id: string | number; updatedAt?: number }>(
  local: T[],
  remote: T[]
): T[] {
  const merged = new Map<string | number, T>();

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

export function mergeArrays<
  T extends { id: string | number; updatedAt?: string; deletedAt?: string | null },
>(local: T[], remote: T[]): T[] {
  const localArr = [...local];

  remote.forEach((serverItem) => {
    const localIndex = localArr.findIndex(
      (localItem) => String(localItem.id) === String(serverItem.id)
    );
    if (localIndex === -1) {
      if (!serverItem.deletedAt) {
        localArr.push(serverItem);
      }
    } else {
      const localTs = localArr[localIndex].updatedAt
        ? new Date(localArr[localIndex].updatedAt!).getTime()
        : 0;
      const serverTs = serverItem.updatedAt ? new Date(serverItem.updatedAt!).getTime() : 0;

      // Tiebreaker: If server timestamp >= local timestamp, server wins
      if (serverTs >= localTs) {
        if (serverItem.deletedAt) {
          localArr.splice(localIndex, 1);
        } else {
          localArr[localIndex] = serverItem;
        }
      }
    }
  });

  return localArr;
}
