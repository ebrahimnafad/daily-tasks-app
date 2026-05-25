import { LS_KEYS } from '@/lib/storage/keys';

const CLIENT_ID_KEY = LS_KEYS.CLIENT_ID;

export function getClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

interface MutationMeta {
  timestamp: number;
  clientId: string;
  version: number;
}

let globalVersion = 0;

export function getLocalVersion(): number {
  return globalVersion;
}

export function incrementVersion(): number {
  globalVersion += 1;
  return globalVersion;
}

export function wrapMutation<T>(data: T): T & MutationMeta {
  return {
    ...data,
    timestamp: Date.now(),
    clientId: getClientId(),
    version: incrementVersion(),
  };
}

export function getMutationMeta(): MutationMeta {
  return {
    timestamp: Date.now(),
    clientId: getClientId(),
    version: getLocalVersion(),
  };
}
