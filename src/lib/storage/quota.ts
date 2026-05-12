export interface StorageStats {
  used: number;
  limit: number;
  percentage: number;
  itemCount: number;
  warning: boolean;
  critical: boolean;
}

const STORAGE_LIMIT = 10 * 1024 * 1024; // ~10MB

export function getStorageUsage(): StorageStats {
  let totalBytes = 0;
  let keys = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      totalBytes += key.length + (localStorage.getItem(key)?.length || 0);
      keys++;
    }
  }

  const percentage = (totalBytes / STORAGE_LIMIT) * 100;

  return {
    used: totalBytes,
    limit: STORAGE_LIMIT,
    percentage,
    itemCount: keys,
    warning: percentage > 80,
    critical: percentage > 95,
  };
}
