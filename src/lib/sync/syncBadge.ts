import type { SyncStatus } from '@/types';

export interface SyncBadgeInfo {
  icon: string;
  text: string;
  cls: string;
}

export const SYNC_STATUS_MAP: Record<SyncStatus, SyncBadgeInfo> = {
  syncing: { icon: '⏳', text: 'جاري الحفظ...', cls: 'syncing' },
  synced: { icon: '☁️', text: 'محفوظ سحابياً', cls: 'synced' },
  offline: { icon: '💾', text: 'محفوظ محلياً', cls: 'offline' },
  error: { icon: '⚠️', text: 'خطأ في المزامنة', cls: 'error' },
};

export function getSyncBadgeInfo(status: SyncStatus): SyncBadgeInfo {
  return SYNC_STATUS_MAP[status] ?? SYNC_STATUS_MAP.offline;
}
