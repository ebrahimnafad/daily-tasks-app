import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const SCHEMA_VERSION = 'v2-uuid';
if (localStorage.getItem('mhm_schema_version') !== SCHEMA_VERSION) {
  const keys = Object.keys(localStorage);
  keys.forEach((key) => {
    if (key.startsWith('mhm_')) {
      localStorage.removeItem(key);
    }
  });
  localStorage.setItem('mhm_schema_version', SCHEMA_VERSION);
} else {
  // Always ensure the old pending_sync queue is wiped when switching to delta sync
  // to avoid sending full arrays to the delta endpoint.
  const legacyQueue = localStorage.getItem('mhm_pending_sync');
  if (legacyQueue && legacyQueue.includes('"tasks"')) {
    localStorage.removeItem('mhm_pending_sync');
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
