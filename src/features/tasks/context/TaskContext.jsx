import { createContext, useContext } from 'react';

export const TaskContext = createContext(null);

export function useTaskContext() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return context;
}
