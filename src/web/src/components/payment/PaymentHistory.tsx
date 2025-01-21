import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { 
  DatePicker,
  LocalizationProvider 
} from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  VerifiedUser as VerifiedIcon,
  Warning as UnverifiedIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { HIPAACompliance } from '@healthcare/hipaa-compliance'; // version ^2.0.0

import Table from '../common/Table';
import { usePayment } from '../../hooks/usePayment';
import { TransactionStatus } from '../../types/marketplace.types';
import { IPaymentTransaction } from '../../interfaces/payment.interface';

// HIPAA compliance configuration
const COMPLIANCE_CONFIG = {
  level: 'FULL',
  masking: {
    transactionId: 'PARTIAL',
    amount: 'FULL',
    blockchainRef: 'PARTIAL'
  }
} as const;

interface PaymentHistoryProps {
  className?: string;
  complianceLevel?: 'FULL' | 'PARTIAL' | 'NONE';
}

const PaymentHistory: React.FC<PaymentHistoryProps> = ({
  className,
  complianceLevel = 'FULL'
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const hipaaCompliance = new HIPAACompliance(COMPLIANCE_CONFIG);

  // State management
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date()
  });
  const [verificationStatus, setVerificationStatus] = useState<Map<string, boolean>>(new Map());

  // Custom hook for payment functionality
  const { 
    getPaymentHistory, 
    verifyBlockchainTransaction,
    loading,
    paymentHistory 
  } = usePayment();

  // Load initial payment history
  useEffect(() => {
    const fetchHistory = async () => {
      await getPaymentHistory(
        'current-user-id',
        1,
        10
      );
    };
    fetchHistory();
  }, [getPaymentHistory]);

  // Handle date range changes
  const handleDateRangeChange = useCallback(async (startDate: Date, endDate: Date) => {
    setDateRange({ startDate, endDate });
    await getPaymentHistory(
      'current-user-id',
      1,
      10
    );
  }, [getPaymentHistory]);

  // Verify blockchain transaction
  const handleVerifyTransaction = useCallback(async (transactionId: string) => {
    const isVerified = await verifyBlockchainTransaction(transactionId);
    setVerificationStatus(prev => new Map(prev).set(transactionId, isVerified));
  }, [verifyBlockchainTransaction]);

  // Format amount with HIPAA compliance
  const formatAmount = useCallback((amount: number, currency: string): string => {
    return hipaaCompliance.maskFinancialData(
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency
      }).format(amount),
      complianceLevel
    );
  }, [hipaaCompliance, complianceLevel]);

  // Table columns configuration
  const columns = useMemo(() => [
    {
      field: 'transactionId',
      header: 'Transaction ID',
      width: '20%',
      render: (value: string) => (
        <Typography variant="body2">
          {hipaaCompliance.maskIdentifier(value, 'TRANSACTION')}
        </Typography>
      )
    },
    {
      field: 'createdAt',
      header: 'Date',
      width: '15%',
      render: (value: Date) => format(new Date(value), 'MMM dd, yyyy HH:mm')
    },
    {
      field: 'amount',
      header: 'Amount',
      width: '15%',
      render: (value: { value: number; currency: string }) => (
        <Typography variant="body2">
          {formatAmount(value.value, value.currency)}
        </Typography>
      )
    },
    {
      field: 'status',
      header: 'Status',
      width: '15%',
      render: (value: TransactionStatus) => (
        <Chip
          label={value}
          color={value === TransactionStatus.COMPLETED ? 'success' : 'default'}
          size="small"
        />
      )
    },
    {
      field: 'blockchainRef',
      header: 'Blockchain Verification',
      width: '35%',
      render: (value: string, row: IPaymentTransaction) => (
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            {hipaaCompliance.maskIdentifier(value, 'BLOCKCHAIN')}
          </Typography>
          <Tooltip title="Verify transaction">
            <IconButton
              size="small"
              onClick={() => handleVerifyTransaction(row.transactionId)}
              disabled={loading}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {verificationStatus.has(row.transactionId) && (
            <Tooltip
              title={verificationStatus.get(row.transactionId) 
                ? 'Transaction verified' 
                : 'Transaction verification failed'}
            >
              {verificationStatus.get(row.transactionId) 
                ? <VerifiedIcon color="success" />
                : <UnverifiedIcon color="error" />
              }
            </Tooltip>
          )}
        </Box>
      )
    }
  ], [hipaaCompliance, formatAmount, handleVerifyTransaction, loading, verificationStatus]);

  return (
    <Paper 
      elevation={0}
      className={className}
      sx={{ p: 3, border: `1px solid ${theme.palette.divider}` }}
    >
      <Box display="flex" flexDirection={isMobile ? 'column' : 'row'} gap={2} mb={3}>
        <Typography variant="h6" component="h2">
          Payment History
        </Typography>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Box display="flex" gap={2}>
            <DatePicker
              label="Start Date"
              value={dateRange.startDate}
              onChange={(date) => date && handleDateRangeChange(date, dateRange.endDate)}
              slotProps={{ textField: { size: 'small' } }}
            />
            <DatePicker
              label="End Date"
              value={dateRange.endDate}
              onChange={(date) => date && handleDateRangeChange(dateRange.startDate, date)}
              slotProps={{ textField: { size: 'small' } }}
            />
          </Box>
        </LocalizationProvider>
      </Box>

      <Table
        columns={columns}
        data={paymentHistory}
        loading={loading}
        pagination
        pageSize={10}
        virtualScroll={!isMobile}
      />
    </Paper>
  );
};

export default PaymentHistory;