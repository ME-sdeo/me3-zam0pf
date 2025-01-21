import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames'; // v2.3.1
import { 
  Paper,
  Popper,
  ClickAwayListener,
  MenuList,
  MenuItem,
  Grow,
  useTheme
} from '@material-ui/core'; // v5.0.0

// Types
export type DropdownPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

export interface DropdownItem {
  id: string | number;
  label: string;
  value: any;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  onSelect: (item: DropdownItem) => void;
  className?: string;
  disabled?: boolean;
  defaultOpen?: boolean;
  placement?: DropdownPlacement;
  role?: string;
  'aria-label'?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  onSelect,
  className,
  disabled = false,
  defaultOpen = false,
  placement = 'bottom-start',
  role = 'menu',
  'aria-label': ariaLabel = 'Dropdown menu'
}) => {
  // Refs
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  // State
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Theme
  const theme = useTheme();

  // Handlers
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setIsOpen(false);
      setFocusedIndex(-1);
      // Announce dropdown closure to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.textContent = 'Dropdown menu closed';
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);
    }
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        setFocusedIndex(-1);
        break;

      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => {
          const nextIndex = prev < items.length - 1 ? prev + 1 : 0;
          // Skip disabled items
          return items[nextIndex].disabled ? 
            (nextIndex < items.length - 1 ? nextIndex + 1 : 0) : 
            nextIndex;
        });
        break;

      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => {
          const nextIndex = prev > 0 ? prev - 1 : items.length - 1;
          // Skip disabled items
          return items[nextIndex].disabled ? 
            (nextIndex > 0 ? nextIndex - 1 : items.length - 1) : 
            nextIndex;
        });
        break;

      case 'Home':
        event.preventDefault();
        setFocusedIndex(0);
        break;

      case 'End':
        event.preventDefault();
        setFocusedIndex(items.length - 1);
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex >= 0) {
          handleItemClick(items[focusedIndex]);
        }
        break;

      default:
        // Handle character search
        if (event.key.length === 1) {
          const char = event.key.toLowerCase();
          const matchIndex = items.findIndex((item, index) => 
            index > focusedIndex && 
            item.label.toLowerCase().startsWith(char)
          );
          if (matchIndex >= 0) {
            setFocusedIndex(matchIndex);
          }
        }
    }
  }, [isOpen, items, focusedIndex]);

  const handleItemClick = useCallback((item: DropdownItem) => {
    if (item.disabled) return;

    onSelect(item);
    setSelectedIndex(items.findIndex(i => i.id === item.id));
    setIsOpen(false);

    // Announce selection to screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = `Selected ${item.label}`;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  }, [items, onSelect]);

  // Effects
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleKeyDown, handleClickOutside]);

  // Focus management
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && menuRef.current) {
      const menuItems = menuRef.current.getElementsByTagName('li');
      if (menuItems[focusedIndex]) {
        menuItems[focusedIndex].focus();
      }
    }
  }, [isOpen, focusedIndex]);

  return (
    <div 
      className={classNames('dropdown-container', className)}
      ref={anchorRef}
    >
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        role="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
      >
        {trigger}
      </div>

      <Popper
        open={isOpen}
        anchorEl={anchorRef.current}
        placement={placement}
        transition
        style={{ zIndex: theme.zIndex.modal }}
      >
        {({ TransitionProps }: { TransitionProps: any }) => (
          <Grow {...TransitionProps}>
            <Paper elevation={8}>
              <ClickAwayListener onClickAway={() => setIsOpen(false)}>
                <MenuList
                  ref={menuRef}
                  role={role}
                  aria-label={ariaLabel}
                  className="dropdown-menu"
                >
                  {items.map((item, index) => (
                    <MenuItem
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      disabled={item.disabled}
                      selected={index === selectedIndex}
                      tabIndex={index === focusedIndex ? 0 : -1}
                      role="menuitem"
                      aria-disabled={item.disabled}
                    >
                      {item.icon && (
                        <span className="dropdown-item-icon" aria-hidden="true">
                          {item.icon}
                        </span>
                      )}
                      <span className="dropdown-item-label">
                        {item.label}
                      </span>
                    </MenuItem>
                  ))}
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </div>
  );
};

export default Dropdown;