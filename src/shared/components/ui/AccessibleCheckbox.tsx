import { useAccessibleClick } from '@/shared/hooks';
import { Tick } from './Icons';

interface AccessibleCheckboxProps {
  checked: boolean;
  color: string;
  onToggle: () => void;
  label: string;
}

export function AccessibleCheckbox({ checked, color, onToggle, label }: AccessibleCheckboxProps) {
  const handleKeyDown = useAccessibleClick();

  return (
    <div
      role="checkbox"
      aria-checked={!!checked}
      aria-label={label}
      tabIndex={0}
      className={`chk ${checked ? 'on' : ''}`}
      style={{ color, borderColor: color }}
      onClick={onToggle}
      onKeyDown={(e) => handleKeyDown(e, onToggle)}
    >
      {checked && <Tick />}
    </div>
  );
}
