import { useEffect } from 'react';
import type { CheckInSource } from './useOkrSync';

export function useTaskOkrBridge(
  recordCheckIn: (krId: string, value: number, note: undefined, source: CheckInSource) => void,
  addToast: (msg: string) => void
) {
  useEffect(() => {
    const handleChecked = (e: Event) => {
      const { keyResultId } = (e as CustomEvent).detail;
      if (keyResultId) recordCheckIn(keyResultId, 1, undefined, 'task');
    };

    const handleUnchecked = (e: Event) => {
      const { keyResultId } = (e as CustomEvent).detail;
      if (keyResultId) addToast('تم تسجيل التقدم مسبقاً ولا يمكن التراجع عنه');
    };

    window.addEventListener('mhm_task_checked', handleChecked);
    window.addEventListener('mhm_task_unchecked', handleUnchecked);

    return () => {
      window.removeEventListener('mhm_task_checked', handleChecked);
      window.removeEventListener('mhm_task_unchecked', handleUnchecked);
    };
  }, [recordCheckIn, addToast]);
}
