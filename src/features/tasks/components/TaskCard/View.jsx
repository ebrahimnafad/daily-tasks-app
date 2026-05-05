import { useTaskCardContext } from './TaskCardContext';
import Header from './Header';
import Subtasks from './Subtasks';
import Brief from './Brief';

export default function View() {
  const { task, done } = useTaskCardContext();

  return (
    <article
      className={`card ${done ? "done" : ""} ${task.isWarning ? "warn" : ""}`}
      aria-label={`مهمة: ${task.title}`}
    >
      <Header />
      <Subtasks />
      <Brief />
    </article>
  );
}

View.Header = Header;
View.Subtasks = Subtasks;
View.Brief = Brief;
