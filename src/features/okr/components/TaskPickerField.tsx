import { useState, useRef, useEffect, useMemo } from 'react';
import type { Task } from '@/types';

type FilterType = 'recurring' | 'once' | 'all';

const RECURRING_RECURRENCES = ['يومي', 'أسبوعي', 'شهري', 'سنوي', 'كل يومين', 'أيام العمل', 'صلاة'];
const ONCE_RECURRENCES = ['مرة واحدة', 'موعد محدد'];

const FILTER_LABELS: Record<FilterType, string> = {
  recurring: 'متكررة',
  once: 'مرة واحدة',
  all: 'الكل',
};

const RECURRENCE_BADGE: Record<string, string> = {
  يومي: 'يومي',
  أسبوعي: 'أسبوعي',
  شهري: 'شهري',
  سنوي: 'سنوي',
  'كل يومين': 'كل يومين',
  'أيام العمل': 'أيام العمل',
  صلاة: 'صلاة',
  'مرة واحدة': 'مرة واحدة',
  'موعد محدد': 'موعد محدد',
};

interface TaskPickerFieldProps {
  tasks: Task[];
  value: string | null;
  onChange: (taskId: string | null) => void;
  label?: string;
  /** IDs of tasks already linked to other KRs */
  linkedTaskIds?: Set<string>;
}

const MAX_VISIBLE = 20;

export default function TaskPickerField({
  tasks,
  value,
  onChange,
  label = 'ربط بمهمة (اختياري)',
  linkedTaskIds = new Set(),
}: TaskPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('recurring');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedTask = useMemo(
    () => (value ? (tasks.find((t) => t.id === value) ?? null) : null),
    [value, tasks]
  );

  const filtered = useMemo(() => {
    let list = tasks;

    // Filter by recurrence type
    if (filter === 'recurring') {
      list = list.filter((t) => RECURRING_RECURRENCES.includes(t.recurrence));
    } else if (filter === 'once') {
      list = list.filter((t) => ONCE_RECURRENCES.includes(t.recurrence));
    }

    // Filter by search term
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }

    return list;
  }, [tasks, filter, search]);

  const capped = filtered.length > MAX_VISIBLE;
  const visible = capped ? filtered.slice(0, MAX_VISIBLE) : filtered;

  return (
    <div className="okr-task-picker" ref={containerRef}>
      <label className="form-label">{label}</label>

      {selectedTask ? (
        <div className="okr-task-picker__selected">
          <span className="okr-task-picker__selected-icon">{selectedTask.icon}</span>
          <span className="okr-task-picker__selected-title">{selectedTask.title}</span>
          <button
            type="button"
            className="okr-task-picker__clear"
            onClick={() => onChange(null)}
            aria-label="إلغاء الربط"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="okr-task-picker__trigger"
          onClick={() => setOpen((v) => !v)}
        >
          اختر مهمة...
        </button>
      )}

      {open && (
        <div className="okr-task-picker__dropdown">
          {/* Search */}
          <input
            type="text"
            className="okr-task-picker__search"
            placeholder="بحث بالعنوان..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />

          {/* Filter tabs */}
          <div className="okr-task-picker__filter-tabs">
            {(['recurring', 'once', 'all'] as FilterType[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`okr-task-picker__filter-tab ${filter === f ? 'okr-task-picker__filter-tab--active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>

          {/* Task list */}
          <div className="okr-task-picker__list">
            {visible.length === 0 ? (
              <div className="okr-task-picker__empty">
                {tasks.length === 0
                  ? 'لا توجد مهام'
                  : search.trim()
                    ? 'لا توجد مهام مطابقة'
                    : 'لا توجد مهام من هذا النوع'}
              </div>
            ) : (
              <>
                {visible.map((t) => {
                  const isLinked = linkedTaskIds.has(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`okr-task-picker__item ${isLinked ? 'okr-task-picker__item--linked' : ''}`}
                      onClick={() => {
                        onChange(t.id);
                        setOpen(false);
                        setSearch('');
                      }}
                    >
                      <span className="okr-task-picker__item-icon">{t.icon}</span>
                      <span className="okr-task-picker__item-title">{t.title}</span>
                      <span className="okr-task-picker__item-badge">
                        {RECURRENCE_BADGE[t.recurrence] ?? t.recurrence}
                      </span>
                      {isLinked && (
                        <span className="okr-task-picker__item-linked-badge">مرتبطة</span>
                      )}
                    </button>
                  );
                })}
                {capped && (
                  <div className="okr-task-picker__empty">
                    ابحث لتضييق النتائج ({filtered.length} مهمة)
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
