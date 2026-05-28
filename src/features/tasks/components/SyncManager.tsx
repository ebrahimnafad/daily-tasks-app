import { useEffect } from 'react';
import type { CheckedMap, SubCheckedMap, DailySnapshot } from '@/types';

export interface SyncManagerProps {
  snapshotImpl: (
    date?: string,
    fallbackChecked?: CheckedMap,
    fallbackSubChecked?: SubCheckedMap,
    fallbackSkipped?: CheckedMap,
    okrSummary?: DailySnapshot['okrSummary']
  ) => void;
  okrSummary?: DailySnapshot['okrSummary'];
}

export function SyncManager({ snapshotImpl, okrSummary }: SyncManagerProps) {
  useEffect(() => {
    const handleMidnight = (e: Event) => {
      const customEvent = e as CustomEvent<{
        date: string;
        checked: CheckedMap;
        subChecked: SubCheckedMap;
        skipped: CheckedMap;
      }>;
      const { date, checked, subChecked, skipped } = customEvent.detail;
      snapshotImpl(date, checked, subChecked, skipped, okrSummary);
    };

    window.addEventListener('mhm_midnight', handleMidnight);
    return () => window.removeEventListener('mhm_midnight', handleMidnight);
  }, [snapshotImpl, okrSummary]);

  return null;
}
