import React, { useEffect, useRef, useCallback } from 'react';
import { Portal, Fade } from '@mui/material';
import { themeConfig } from '../../config/theme.config';
import '../styles/components/_modal.scss';

// Modal Props Interface
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  ariaLabel?: string;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

// Focus Management Hook
const useFocusManager = (isOpen: boolean) => {
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const focusableElements = useRef<HTMLElement[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      if (modalRef.current) {
        focusableElements.current = Array.from(
          modalRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ) as HTMLElement[];
        
        if (focusableElements.current.length) {
          focusableElements.current[0].focus();
        }
      }
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  }, [isOpen]);

  return {
    modalRef,
    focusableElements,
    handleTabKey: (event: KeyboardEvent) => {
      const firstFocusableEl = focusableElements.current[0];
      const lastFocusableEl = focusableElements.current[focusableElements.current.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstFocusableEl) {
          lastFocusableEl.focus();
          event.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusableEl) {
          firstFocusableEl.focus();
          event.preventDefault();
        }
      }
    }
  };
};

// Modal Component
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className = '',
  ariaLabel,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}) => {
  const { modalRef, handleTabKey } = useFocusManager(isOpen);

  // Handle keyboard interactions
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (closeOnEscape && event.key === 'Escape') {
      onClose();
    }
    if (event.key === 'Tab') {
      handleTabKey(event);
    }
  }, [closeOnEscape, onClose, handleTabKey]);

  // Handle overlay click
  const handleOverlayClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose();
    }
  }, [closeOnOverlayClick, onClose]);

  // Effect for keyboard event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <Portal>
      <Fade in={isOpen} timeout={themeConfig.transitions.duration.standard}>
        <div
          className={`modal ${className}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby="modal-content"
          aria-hidden={!isOpen}
          aria-label={ariaLabel}
        >
          <div 
            className="modal-overlay"
            onClick={handleOverlayClick}
            data-testid="modal-overlay"
          >
            <div
              ref={modalRef}
              className={`modal-container modal-${size}`}
              role="document"
            >
              <header className="modal-header">
                <h2 
                  id="modal-title"
                  className="modal-title"
                >
                  {title}
                </h2>
                <button
                  type="button"
                  className="modal-close"
                  onClick={onClose}
                  aria-label="Close modal"
                >
                  <span aria-hidden="true">&times;</span>
                </button>
              </header>
              <div 
                id="modal-content"
                className="modal-content"
              >
                {children}
              </div>
            </div>
          </div>
        </div>
      </Fade>
    </Portal>
  );
};

export default Modal;