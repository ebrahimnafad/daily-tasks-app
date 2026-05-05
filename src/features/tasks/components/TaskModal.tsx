import { useEffect, useRef, memo } from 'react';
import type { TaskForm } from '@/types';

const CATEGORIES = [
  { label: 'عبادة', color: 'var(--gold)' },
  { label: 'عمل', color: '#6e9fcf' },
  { label: 'أسرة', color: '#9bc87a' },
  { label: 'صحة', color: '#9bc87a' },
  { label: 'تنبيه', color: '#d97e6a' },
  { label: 'شخصي', color: '#b07ecf' },
  { label: 'أخرى', color: '#aaaaaa' },
];
const ICONS = [
  '📋',
  '📧',
  '📖',
  '🕌',
  '🚶',
  '🚫',
  '💊',
  '🏃',
  '🛒',
  '📞',
  '✏️',
  '🍽️',
  '💧',
  '📚',
  '🎯',
  '🧹',
  '💼',
  '🌙',
  '⭐',
  '🔔',
];
const TIMES = [
  'الصباح الباكر',
  'الصباح',
  'الضحى',
  'قبل الظهر',
  'الظهر',
  'بعد الظهر',
  'العصر',
  'بعد العصر',
  'المغرب',
  'بين المغرب والعشاء',
  'العشاء',
  'الليل',
  'طوال اليوم',
];
const RECURRENCE_OPTIONS = ['يومي', 'أيام العمل', 'أسبوعي', 'مرة واحدة'];

interface ModalState {
  mode: 'add' | 'edit';
  taskId?: string | number;
}

interface TaskModalProps {
  modal: ModalState | null;
  form: TaskForm;
  onFormField: <K extends keyof TaskForm>(field: K, value: TaskForm[K]) => void;
  onSave: () => void;
  onClose: () => void;
}

function TaskModal({ modal, form, onFormField, onSave, onClose }: TaskModalProps) {
  const titleId = 'modal-title';
  const modalRef = useRef<HTMLDivElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => titleInput.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [modal]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;

    const focusableSelectors =
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(el.querySelectorAll<HTMLElement>(focusableSelectors));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    el.addEventListener('keydown', handleTab);
    return () => el.removeEventListener('keydown', handleTab);
  }, []);

  const handleBlockerChange = (i: number, val: string) => {
    const arr = [...form.blockers] as [string, string, string];
    arr[i] = val;
    onFormField('blockers', arr);
  };
  const handleHelperChange = (i: number, val: string) => {
    const arr = [...form.helpers] as [string, string, string];
    arr[i] = val;
    onFormField('helpers', arr);
  };

  if (!modal) return null;

  return (
    <div className="ov" onClick={onClose} role="presentation" aria-hidden="false">
      <div
        ref={modalRef}
        className="mb"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="tm-title">
          {modal.mode === 'add' ? '➕ مهمة جديدة' : '✏️ تعديل المهمة'}
        </h2>

        <div className="sg">
          <label className="ml" id="icon-label">
            الأيقونة
          </label>
          <div className="ig" role="radiogroup" aria-labelledby="icon-label">
            {ICONS.map((ic) => (
              <div
                key={ic}
                className={`io ${form.icon === ic ? 'sel' : ''}`}
                role="radio"
                {...{ 'aria-checked': form.icon === ic ? 'true' : 'false' }}
                aria-label={ic}
                tabIndex={form.icon === ic ? 0 : -1}
                onClick={() => onFormField('icon', ic)}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    onFormField('icon', ic);
                  }
                }}
              >
                {ic}
              </div>
            ))}
          </div>
        </div>

        <div className="sg">
          <label className="ml" htmlFor="task-title">
            اسم المهمة *
          </label>
          <input
            id="task-title"
            ref={titleInput}
            className="mi"
            placeholder="اكتب المهمة هنا..."
            value={form.title}
            onChange={(e) => onFormField('title', e.target.value)}
          />
        </div>

        <div className="tm-row">
          <div className="tm-col">
            <label className="ml" htmlFor="task-category">
              التصنيف
            </label>
            <select
              id="task-category"
              className="ms"
              value={form.category}
              onChange={(e) => onFormField('category', e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.label} value={c.label}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="tm-col">
            <label className="ml" htmlFor="task-time">
              الوقت
            </label>
            <select
              id="task-time"
              className="ms"
              value={form.time}
              onChange={(e) => onFormField('time', e.target.value)}
            >
              {TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="tm-row-xl">
          <div className="tm-col">
            <label className="ml" htmlFor="task-recurrence">
              التكرار
            </label>
            <select
              id="task-recurrence"
              className="ms"
              value={form.recurrence}
              onChange={(e) => onFormField('recurrence', e.target.value)}
            >
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="tm-col">
            <label className="ml" htmlFor="task-alert">
              وقت التنبيه (اختياري)
            </label>
            <input
              id="task-alert"
              type="time"
              className="ms"
              value={form.alertTime || ''}
              onChange={(e) => onFormField('alertTime', e.target.value)}
            />
          </div>
        </div>

        <div className="sg tm-switch-row">
          <label className="ml tm-switch-label" id="warning-label">
            🚫 تنبيه مهم (تأشير أحمر)
          </label>
          <button
            role="switch"
            {...{ 'aria-checked': form.isWarning ? 'true' : 'false' }}
            aria-labelledby="warning-label"
            className="tg tm-switch-btn"
            onClick={() => onFormField('isWarning', !form.isWarning)}
          >
            <div className={`tgtr ${form.isWarning ? 'on' : ''}`} aria-hidden="true" />
            <div className={`tgth ${form.isWarning ? 'on' : ''}`} aria-hidden="true" />
          </button>
        </div>

        <div className="sg">
          <label className="ml">⚠️ العوائق المحتملة</label>
          {form.blockers.map((b, i) => (
            <input
              key={i}
              className="mi tm-input-mb"
              placeholder={`عائق ${i + 1}...`}
              value={b}
              aria-label={`عائق ${i + 1}`}
              onChange={(e) => handleBlockerChange(i, e.target.value)}
            />
          ))}
        </div>

        <div className="sg">
          <label className="ml">✅ المساعدات</label>
          {form.helpers.map((h, i) => (
            <input
              key={i}
              className="mi tm-input-mb"
              placeholder={`مساعدة ${i + 1}...`}
              value={h}
              aria-label={`مساعدة ${i + 1}`}
              onChange={(e) => handleHelperChange(i, e.target.value)}
            />
          ))}
        </div>

        <button className="svbtn" disabled={!form.title.trim()} onClick={onSave}>
          {modal.mode === 'add' ? 'إضافة المهمة' : 'حفظ التعديلات'}
        </button>
        <button className="cxbtn" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </div>
  );
}

export default memo(TaskModal);
export { CATEGORIES };
