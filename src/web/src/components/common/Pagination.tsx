import React, { useCallback, useMemo } from 'react';
import { Pagination as MuiPagination, PaginationItem } from '@mui/material';
import { useTheme, useMediaQuery } from '@mui/material';

// @mui/material version ^5.0.0
// react version ^18.0.0

interface PaginationProps {
  /** Total number of items to paginate */
  totalItems: number;
  /** Number of items per page */
  pageSize: number;
  /** Current active page number (1-based) */
  currentPage: number;
  /** Callback function when page changes */
  onPageChange: (page: number) => void;
  /** Optional CSS class name for styling */
  className?: string;
  /** Whether the pagination is disabled */
  disabled?: boolean;
  /** Number of siblings to show on each side of current page */
  siblingCount?: number;
  /** Number of boundary pages to show */
  boundaryCount?: number;
  /** ARIA label for accessibility */
  ariaLabel?: string;
  /** Whether to show first page button */
  showFirstButton?: boolean;
  /** Whether to show last page button */
  showLastButton?: boolean;
  /** Shape of pagination items */
  shape?: 'circular' | 'rounded';
  /** Size of pagination items */
  size?: 'small' | 'medium' | 'large';
}

/**
 * Calculates the total number of pages based on total items and page size
 * @param totalItems - Total number of items
 * @param pageSize - Number of items per page
 * @returns Total number of pages
 */
const calculateTotalPages = (totalItems: number, pageSize: number): number => {
  if (totalItems <= 0 || pageSize <= 0) {
    return 0;
  }
  return Math.ceil(totalItems / pageSize);
};

/**
 * Pagination component implementing Material Design principles with accessibility support
 * Compliant with WCAG 2.1 Level AA requirements
 */
export const Pagination: React.FC<PaginationProps> = ({
  totalItems,
  pageSize,
  currentPage,
  onPageChange,
  className = '',
  disabled = false,
  siblingCount: propsSiblingCount,
  boundaryCount: propsBoundaryCount,
  ariaLabel = 'Pagination navigation',
  showFirstButton = true,
  showLastButton = true,
  shape = 'circular',
  size = 'medium',
}) => {
  // Get theme and screen size for responsive behavior
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Calculate responsive configuration
  const { siblingCount, boundaryCount } = useMemo(() => ({
    siblingCount: propsSiblingCount ?? (isMobile ? 0 : 1),
    boundaryCount: propsBoundaryCount ?? (isMobile ? 1 : 2),
  }), [isMobile, propsSiblingCount, propsBoundaryCount]);

  // Calculate total pages
  const totalPages = useMemo(() => 
    calculateTotalPages(totalItems, pageSize),
    [totalItems, pageSize]
  );

  /**
   * Handles page change events with validation
   * @param event - React change event
   * @param page - New page number
   */
  const handlePageChange = useCallback((
    event: React.ChangeEvent<unknown>,
    page: number
  ) => {
    event.preventDefault();
    
    // Validate page bounds
    if (page < 1 || page > totalPages) {
      return;
    }

    onPageChange(page);
  }, [totalPages, onPageChange]);

  // Don't render if there's only one page
  if (totalPages <= 1) {
    return null;
  }

  return (
    <MuiPagination
      page={currentPage}
      count={totalPages}
      onChange={handlePageChange}
      disabled={disabled}
      siblingCount={siblingCount}
      boundaryCount={boundaryCount}
      showFirstButton={showFirstButton}
      showLastButton={showLastButton}
      shape={shape}
      size={size}
      className={className}
      aria-label={ariaLabel}
      renderItem={(item) => (
        <PaginationItem
          {...item}
          aria-label={
            item.type === 'page'
              ? `Go to page ${item.page}`
              : `Go to ${item.type} page`
          }
          component="button"
          role="button"
        />
      )}
      sx={{
        '& .MuiPaginationItem-root': {
          margin: theme.spacing(0, 0.5),
          [theme.breakpoints.down('sm')]: {
            margin: theme.spacing(0, 0.25),
            minWidth: 32,
            height: 32,
          },
        },
      }}
    />
  );
};

export default Pagination;