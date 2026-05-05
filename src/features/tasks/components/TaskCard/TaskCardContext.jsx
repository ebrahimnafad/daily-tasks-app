import { createContext, useContext } from 'react';

export const TaskCardContext = createContext();
export const useTaskCardContext = () => useContext(TaskCardContext);
