import { useState, useCallback } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export default function useToasts() {
  const [quotaError, setQuotaError] = useState(false);
  const [newDayToast, setNewDayToast] = useState(false);

  // PWA update notification
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
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
