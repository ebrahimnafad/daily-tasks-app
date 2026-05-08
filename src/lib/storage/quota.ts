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

async function sendToArchive(archives: { key: string; data: string; date: string }[]) {
  try {
    await fetch('/api/db?resource=archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archives }),
    });
  } catch (e) {
    console.error('Archive failed:', e);
  }
}

export async function archiveOldData(daysRetain = 90): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysRetain);

  const toArchive: { key: string; data: string; date: string }[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('mhm_date_')) continue;

    const dateStr = key.replace('mhm_date_', '');
    if (new Date(dateStr) < cutoff) {
      const data = localStorage.getItem(key);
      if (data) {
        toArchive.push({ key, data, date: dateStr });
      }
    }
  }

  if (toArchive.length > 0) {
    await sendToArchive(toArchive);
    toArchive.forEach((a) => localStorage.removeItem(a.key));
  }

  return toArchive.length;
}
