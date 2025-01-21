import React, { useState, useCallback, useMemo } from 'react';
import {
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TableSortLabel,
  useTheme,
  useMediaQuery,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  GetApp as ExportIcon,
  Lock as SensitiveIcon,
} from '@mui/icons-material';
import { FixedSizeList } from 'react-window';
import { Client as FHIRClient } from 'fhir-kit-client'; // version ^1.8.0

import Pagination from './Pagination';
import Loading from './Loading';

// Interfaces
interface Column {
  field: string;
  header: string;
  sortable?: boolean;
  width?: string;
  sensitive?: boolean;
  fhirType?: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface TableProps {
  columns: Column[];
  data: any[];
  loading?: boolean;
  pagination?: boolean;
  pageSize?: number;
  virtualScroll?: boolean;
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
  onRowSelect?: (row: any) => void;
  onExport?: (format: 'csv' | 'json') => void;
}

interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

// FHIR data formatting utility
const formatFHIRValue = (value: any, fhirType?: string): string => {
  if (!value) return '';
  
  switch (fhirType) {
    case 'date':
      return new Date(value).toLocaleDateString();
    case 'dateTime':
      return new Date(value).toLocaleString();
    case 'code':
      return value.coding?.[0]?.display || value;
    case 'Reference':
      return value.reference || value;
    case 'Quantity':
      return `${value.value} ${value.unit || ''}`;
    default:
      return String(value);
  }
};

export const Table: React.FC<TableProps> = ({
  columns,
  data,
  loading = false,
  pagination = true,
  pageSize = 10,
  virtualScroll = false,
  onSort,
  onRowSelect,
  onExport,
}) => {
  // Theme and responsive hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State management
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: '', direction: 'asc' });

  // Memoized visible columns based on screen size
  const visibleColumns = useMemo(() => {
    return columns.filter(column => !isMobile || !column.width || column.width !== 'extended');
  }, [columns, isMobile]);

  // Sort handler
  const handleSort = useCallback((field: string) => {
    const column = columns.find(col => col.field === field);
    if (!column?.sortable) return;

    const newDirection = sortConfig.field === field && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ field, direction: newDirection });
    onSort?.(field, newDirection);
  }, [columns, sortConfig, onSort]);

  // Row selection handler
  const handleRowClick = useCallback((row: any) => {
    onRowSelect?.(row);
  }, [onRowSelect]);

  // Cell renderer with FHIR data handling
  const renderCell = useCallback((column: Column, row: any) => {
    const value = column.field.split('.').reduce((obj, key) => obj?.[key], row);
    
    if (column.sensitive) {
      return (
        <Tooltip title="Sensitive health information">
          <span>
            <SensitiveIcon fontSize="small" />
            {' [Protected]'}
          </span>
        </Tooltip>
      );
    }

    if (column.render) {
      return column.render(value, row);
    }

    return formatFHIRValue(value, column.fhirType);
  }, []);

  // Pagination handlers
  const paginatedData = useMemo(() => {
    if (!pagination) return data;
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, currentPage, pageSize, pagination]);

  // Virtual scroll row renderer
  const VirtualRow = useCallback(({ index, style }: any) => {
    const row = paginatedData[index];
    return (
      <TableRow
        hover
        onClick={() => handleRowClick(row)}
        style={style}
        sx={{ cursor: onRowSelect ? 'pointer' : 'default' }}
      >
        {visibleColumns.map(column => (
          <TableCell
            key={column.field}
            align="left"
            sx={{ width: column.width }}
          >
            {renderCell(column, row)}
          </TableCell>
        ))}
      </TableRow>
    );
  }, [paginatedData, visibleColumns, handleRowClick, renderCell]);

  if (loading) {
    return <Loading size="large" />;
  }

  return (
    <Paper 
      elevation={0}
      sx={{ 
        width: '100%',
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: theme.shape.borderRadius,
      }}
    >
      <TableContainer>
        <MuiTable
          aria-label="Data table"
          stickyHeader
        >
          <TableHead>
            <TableRow>
              {visibleColumns.map(column => (
                <TableCell
                  key={column.field}
                  sortDirection={sortConfig.field === column.field ? sortConfig.direction : false}
                  sx={{ width: column.width }}
                >
                  {column.sortable ? (
                    <TableSortLabel
                      active={sortConfig.field === column.field}
                      direction={sortConfig.field === column.field ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort(column.field)}
                    >
                      {column.header}
                    </TableSortLabel>
                  ) : column.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {virtualScroll ? (
              <FixedSizeList
                height={400}
                itemCount={paginatedData.length}
                itemSize={53}
                width="100%"
              >
                {VirtualRow}
              </FixedSizeList>
            ) : (
              paginatedData.map((row, index) => (
                <TableRow
                  hover
                  key={index}
                  onClick={() => handleRowClick(row)}
                  sx={{ cursor: onRowSelect ? 'pointer' : 'default' }}
                >
                  {visibleColumns.map(column => (
                    <TableCell
                      key={column.field}
                      align="left"
                      sx={{ width: column.width }}
                    >
                      {renderCell(column, row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </MuiTable>
      </TableContainer>

      {pagination && (
        <Pagination
          totalItems={data.length}
          pageSize={pageSize}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      )}

      {onExport && (
        <IconButton
          onClick={() => onExport('csv')}
          aria-label="Export data"
          sx={{ position: 'absolute', top: 8, right: 8 }}
        >
          <ExportIcon />
        </IconButton>
      )}
    </Paper>
  );
};

export default Table;