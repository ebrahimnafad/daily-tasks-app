import { useMemo } from 'react';

interface TabBarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  financeBadge: number;
}

interface Tab {
  id: string;
  icon: string;
  label: string;
}

export default function TabBar({ activeTab, onTabChange, financeBadge }: TabBarProps) {
  const tabs = useMemo<Tab[]>(
    () => [
      { id: 'tasks', icon: '📋', label: 'المهام' },
      { id: 'finance', icon: '💰', label: 'المالية' },
    ],
    []
  );

  return (
    <nav className="tab-bar" role="tablist" aria-label="التنقل الرئيسي">
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
            <span className="tab-bar__label">{tab.label}</span>
            {tab.id === 'finance' && financeBadge > 0 && (
              <span className="tab-bar__badge" aria-label={`${financeBadge} دفعات مستحقة`}>
                {financeBadge}
              </span>
            )}
            {isActive && <span className="tab-bar__indicator" />}
          </button>
        );
      })}
    </nav>
  );
}
