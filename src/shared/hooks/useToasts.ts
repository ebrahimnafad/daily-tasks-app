import { useState, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export interface SyncToast {
  id: number;
  message: string;
  type: 'offline' | 'error' | 'warn';
}

export interface ToastsReturn {
  quotaError: boolean;
  onQuota: () => void;
  newDayToast: boolean;
  onNewDay: () => void;
  needRefresh: boolean;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  /** Non-blocking sync error/offline notifications (replaces alert()) */
  syncToasts: SyncToast[];
  addSyncToast: (message: string, type: SyncToast['type']) => void;
  dismissSyncToast: (id: number) => void;
}

let _toastId = 0;

export default function useToasts(): ToastsReturn {
  const [quotaError, setQuotaError] = useState(false);
  const [newDayToast, setNewDayToast] = useState(false);
  const [syncToasts, setSyncToasts] = useState<SyncToast[]>([]);

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

  const dismissSyncToast = useCallback((id: number) => {
    setSyncToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addSyncToast = useCallback(
    (message: string, type: SyncToast['type']) => {
      const id = ++_toastId;
      setSyncToasts((prev) => [...prev, { id, message, type }]);
      // Offline / warn toasts auto-dismiss after 4s; errors stay until dismissed
      if (type === 'offline' || type === 'warn') {
        setTimeout(() => dismissSyncToast(id), 4000);
      }
    },
    [dismissSyncToast]
  );

  return {
    quotaError,
    onQuota,
    newDayToast,
    onNewDay,
    needRefresh,
    updateServiceWorker,
    syncToasts,
    addSyncToast,
    dismissSyncToast,
  };
}
