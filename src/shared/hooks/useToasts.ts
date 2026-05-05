import { useState, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export interface ToastsReturn {
  quotaError: boolean;
  onQuota: () => void;
  newDayToast: boolean;
  onNewDay: () => void;
  needRefresh: boolean;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

export default function useToasts(): ToastsReturn {
  const [quotaError, setQuotaError] = useState(false);
  const [newDayToast, setNewDayToast] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      if (r) setInterval(() => r.update(), 60 * 60 * 1000);
    },
  });

  const onQuota = useCallback(() => setQuotaError(true), []);
  const onNewDay = useCallback(() => {
    setNewDayToast(true);
    setTimeout(() => setNewDayToast(false), 4000);
  }, []);

  return {
    quotaError,
    onQuota,
    newDayToast,
    onNewDay,
    needRefresh,
    updateServiceWorker,
  };
}
