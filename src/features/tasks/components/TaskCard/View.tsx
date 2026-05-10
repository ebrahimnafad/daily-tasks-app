import { useTaskCardContext } from './TaskCardContext';
import Header from './Header';
import Subtasks from './Subtasks';
import Brief from './Brief';
import Actions from './Actions';

export default function View() {
  const { task, done } = useTaskCardContext();

  return (
    <article
      className={`task-card ${done ? 'done' : ''} ${task.isWarning ? 'warn' : ''}`}
      aria-label={`مهمة: ${task.title}`}
    >
      <Header />
      <Subtasks />
      <Brief />
      <Actions />
    </article>
  );
}

View.Header = Header;
View.Subtasks = Subtasks;
View.Brief = Brief;
View.Actions = Actions;
