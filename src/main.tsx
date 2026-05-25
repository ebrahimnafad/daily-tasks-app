import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { LS_KEYS } from '@/lib/storage/keys';

const SCHEMA_VERSION = 'v2-uuid';
if (localStorage.getItem(LS_KEYS.SCHEMA_VERSION) !== SCHEMA_VERSION) {
  const keys = Object.keys(localStorage);
  keys.forEach((key) => {
    if (key.startsWith('mhm_')) {
      localStorage.removeItem(key);
    }
  });
  localStorage.setItem(LS_KEYS.SCHEMA_VERSION, SCHEMA_VERSION);
} else {
  // Always ensure the old pending_sync queue is wiped when switching to delta sync
  // to avoid sending full arrays to the delta endpoint.
  const legacyQueue = localStorage.getItem(LS_KEYS.PENDING_SYNC);
  if (legacyQueue && legacyQueue.includes('"tasks"')) {
    localStorage.removeItem(LS_KEYS.PENDING_SYNC);
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: true,
      retry: 3,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
