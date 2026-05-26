import { useEffect } from 'react';
import type { CheckedMap, SubCheckedMap, DailySnapshot } from '@/types';

export interface SyncManagerProps {
  snapshotImpl: (
    date?: string,
    fallbackChecked?: CheckedMap,
    fallbackSubChecked?: SubCheckedMap,
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
      }>;
      const { date, checked, subChecked } = customEvent.detail;
      snapshotImpl(date, checked, subChecked, okrSummary);
    };

    window.addEventListener('mhm_midnight', handleMidnight);
    return () => window.removeEventListener('mhm_midnight', handleMidnight);
  }, [snapshotImpl, okrSummary]);

  return null;
}
