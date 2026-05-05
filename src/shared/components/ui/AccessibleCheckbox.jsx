import { useAccessibleClick } from "@/shared/hooks";
import { Tick } from "./Icons.jsx";

export function AccessibleCheckbox({ checked, color, onToggle, label }) {
  const handleKeyDown = useAccessibleClick();

  return (
    <div
      role="checkbox"
      aria-checked={!!checked}
      aria-label={label}
      tabIndex={0}
      className={`chk ${checked ? "on" : ""}`}
      style={{ color, borderColor: color }}
      onClick={onToggle}
      onKeyDown={(e) => handleKeyDown(e, onToggle)}
    >
      {checked && <Tick />}
    </div>
  );
}
