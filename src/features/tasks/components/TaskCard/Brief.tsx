import { useTaskCardContext } from './TaskCardContext';
import { BriefPanel } from '@/features/tasks';

export default function Brief() {
  const { isBriefOpen, task } = useTaskCardContext();

  if (!isBriefOpen) return null;

  return <BriefPanel brief={task.brief} />;
}
