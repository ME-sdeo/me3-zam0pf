import React, { useState, useCallback, useRef, useEffect } from 'react';
import classNames from 'classnames';
import '../../styles/components/_tabs.scss';

// Types
export interface TabItem {
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
  id: string;
  ariaControls: string;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: number;
  onChange: (index: number) => void;
  className?: string;
  ariaLabel?: string;
  isHighContrast?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

// Utility function to get tab classes
const getTabClasses = (
  isActive: boolean,
  isDisabled: boolean,
  isFocused: boolean,
  isHighContrast: boolean
): string => {
  return classNames('tab', {
    'tab--active': isActive,
    'tab--disabled': isDisabled,
    'tab--focused': isFocused,
    'tab--high-contrast': isHighContrast
  });
};

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className,
  ariaLabel = 'Navigation tabs',
  isHighContrast = false,
  orientation = 'horizontal'
}) => {
  const [focusedTab, setFocusedTab] = useState<number | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabListRef = useRef<HTMLDivElement>(null);

  // Initialize tab refs
  useEffect(() => {
    tabRefs.current = tabRefs.current.slice(0, tabs.length);
  }, [tabs.length]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = focusedTab !== null ? focusedTab : activeTab;
      const tabCount = tabs.length;

      const getNextEnabledTab = (startIndex: number, direction: number): number => {
        let index = startIndex;
        do {
          index = (index + direction + tabCount) % tabCount;
        } while (tabs[index].disabled && index !== startIndex);
        return index;
      };

      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowUp': {
          event.preventDefault();
          const nextIndex = getNextEnabledTab(currentIndex, -1);
          setFocusedTab(nextIndex);
          tabRefs.current[nextIndex]?.focus();
          break;
        }
        case 'ArrowRight':
        case 'ArrowDown': {
          event.preventDefault();
          const nextIndex = getNextEnabledTab(currentIndex, 1);
          setFocusedTab(nextIndex);
          tabRefs.current[nextIndex]?.focus();
          break;
        }
        case 'Home': {
          event.preventDefault();
          const firstEnabledTab = getNextEnabledTab(-1, 1);
          setFocusedTab(firstEnabledTab);
          tabRefs.current[firstEnabledTab]?.focus();
          break;
        }
        case 'End': {
          event.preventDefault();
          const lastEnabledTab = getNextEnabledTab(tabCount, -1);
          setFocusedTab(lastEnabledTab);
          tabRefs.current[lastEnabledTab]?.focus();
          break;
        }
      }
    },
    [focusedTab, activeTab, tabs]
  );

  // Handle tab click
  const handleTabClick = useCallback(
    (index: number) => {
      if (!tabs[index].disabled) {
        onChange(index);
        setFocusedTab(index);
      }
    },
    [onChange, tabs]
  );

  // Handle focus management
  const handleTabFocus = useCallback((index: number) => {
    setFocusedTab(index);
  }, []);

  const handleTabBlur = useCallback(() => {
    setFocusedTab(null);
  }, []);

  return (
    <div className={classNames('tabs', className)}>
      <div
        ref={tabListRef}
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation={orientation}
        onKeyDown={handleKeyDown}
        className="tabs__list"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => (tabRefs.current[index] = el)}
            role="tab"
            aria-selected={activeTab === index}
            aria-disabled={tab.disabled}
            aria-controls={tab.ariaControls}
            id={tab.id}
            tabIndex={activeTab === index ? 0 : -1}
            className={getTabClasses(
              activeTab === index,
              !!tab.disabled,
              focusedTab === index,
              isHighContrast
            )}
            onClick={() => handleTabClick(index)}
            onFocus={() => handleTabFocus(index)}
            onBlur={handleTabBlur}
            disabled={tab.disabled}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={tab.ariaControls}
          role="tabpanel"
          id={tab.ariaControls}
          aria-labelledby={tab.id}
          hidden={activeTab !== index}
          className="tabs__panel"
        >
          {activeTab === index && tab.content}
        </div>
      ))}
    </div>
  );
};

export default Tabs;