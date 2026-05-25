import { useEffect } from 'react';
import type { CheckedMap, SubCheckedMap } from '@/types';

export interface SyncManagerProps {
  snapshotImpl: (
    date?: string,
    fallbackChecked?: CheckedMap,
    fallbackSubChecked?: SubCheckedMap
  ) => void;
}

export function SyncManager({ snapshotImpl }: SyncManagerProps) {
  useEffect(() => {
    const handleMidnight = (e: Event) => {
      const customEvent = e as CustomEvent<{
        date: string;
        checked: CheckedMap;
        subChecked: SubCheckedMap;
      }>;
      const { date, checked, subChecked } = customEvent.detail;
      snapshotImpl(date, checked, subChecked);
    };

    window.addEventListener('mhm_midnight', handleMidnight);
    return () => window.removeEventListener('mhm_midnight', handleMidnight);
  }, [snapshotImpl]);

  return null;
}
