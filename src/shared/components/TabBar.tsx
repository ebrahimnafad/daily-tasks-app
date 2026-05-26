import { useMemo, useEffect, useState } from 'react';

interface TabBarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  financeBadge: number;
  onLogout?: () => void;
}

interface Tab {
  id: string;
  icon: string;
  label: string;
}

export default function TabBar({ activeTab, onTabChange, financeBadge, onLogout }: TabBarProps) {
  const tabs = useMemo<Tab[]>(
    () => [
      { id: 'tasks', icon: '📋', label: 'المهام' },
      { id: 'okr', icon: '🎯', label: 'الأهداف' },
      { id: 'calendar', icon: '📅', label: 'التقويم' },
      { id: 'finance', icon: '💰', label: 'المالية' },
    ],
    []
  );

  // Compact mode: hide labels on very small viewports (≤360px)
  const [compact, setCompact] = useState(() => window.innerWidth <= 360);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 360px)');
    const handler = (e: MediaQueryListEvent) => setCompact(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <nav
      className={`tab-bar${compact ? ' tab-bar--compact' : ''}`}
      role="tablist"
      aria-label="التنقل الرئيسي"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            className={`tab-bar__item ${isActive ? 'tab-bar__item--active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="tab-bar__icon" aria-hidden="true">
              {tab.icon}
            </span>
            {!compact && <span className="tab-bar__label">{tab.label}</span>}
            {tab.id === 'finance' && financeBadge > 0 && (
              <span className="tab-bar__badge" aria-label={`${financeBadge} دفعات مستحقة`}>
                {financeBadge}
              </span>
            )}
            {isActive && <span className="tab-bar__indicator" />}
          </button>
        );
      })}

      {onLogout && (
        <button
          id="logout-btn"
          className="tab-bar__item tab-bar__item--logout"
          aria-label="تسجيل الخروج"
          title="تسجيل الخروج"
          onClick={() => {
            if (window.confirm('هل تريد تسجيل الخروج؟')) onLogout();
          }}
        >
          <span className="tab-bar__icon" aria-hidden="true">
            🚪
          </span>
          <span className="tab-bar__label">خروج</span>
        </button>
      )}
    </nav>
  );
}
