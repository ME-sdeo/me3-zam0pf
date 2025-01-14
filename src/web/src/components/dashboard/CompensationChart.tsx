import React, { useEffect, useState } from 'react';
import { 
  Line, 
  LineChart, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts'; // recharts ^2.7.0
import { 
  usePayment, 
  getPaymentHistory, 
  verifyBlockchainTransaction 
} from '../../hooks/usePayment';
import { IPaymentTransaction } from '../../interfaces/payment.interface';

/**
 * Props interface for CompensationChart component with enhanced security features
 */
interface CompensationChartProps {
  height?: number;
  width?: number;
  startDate?: Date;
  endDate?: Date;
  currency?: string;
  showBlockchainVerification?: boolean;
  complianceConfig?: {
    hipaaCompliant: boolean;
    auditLevel: string;
    retentionPeriod: string;
  };
}

/**
 * Interface for transformed chart data points with compliance metadata
 */
interface ChartDataPoint {
  date: Date;
  amount: number;
  currency: string;
  isVerified: boolean;
  compliance: {
    hipaaCompliant: boolean;
    blockchainRef?: string;
    auditTrail?: string;
  };
}

/**
 * Transforms payment history data into chart-compatible format with security verification
 */
const transformPaymentData = async (
  transactions: IPaymentTransaction[],
  targetCurrency: string
): Promise<ChartDataPoint[]> => {
  // Sort transactions by date
  const sortedTransactions = [...transactions].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  // Group transactions by date and verify blockchain records
  const groupedData = new Map<string, ChartDataPoint>();

  for (const transaction of sortedTransactions) {
    const dateKey = transaction.createdAt.toISOString().split('T')[0];
    const isVerified = await verifyBlockchainTransaction(transaction.blockchainRef);

    const existingPoint = groupedData.get(dateKey);
    const amount = transaction.amount.currency === targetCurrency
      ? transaction.amount.value
      : transaction.amount.value * transaction.amount.exchangeRate;

    groupedData.set(dateKey, {
      date: transaction.createdAt,
      amount: (existingPoint?.amount || 0) + amount,
      currency: targetCurrency,
      isVerified: isVerified && (existingPoint?.isVerified ?? true),
      compliance: {
        hipaaCompliant: true,
        blockchainRef: transaction.blockchainRef,
        auditTrail: `${transaction.transactionId}-${transaction.blockchainTxHash}`
      }
    });
  }

  return Array.from(groupedData.values());
};

/**
 * Formats currency values for display with locale support
 */
const formatCurrency = (
  value: number,
  currency: string,
  locale: string = 'en-US'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency
  }).format(value);
};

/**
 * React component that displays secure compensation history in a line chart
 * with blockchain verification and HIPAA compliance
 */
const CompensationChart: React.FC<CompensationChartProps> = ({
  height = 300,
  width = '100%',
  startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  endDate = new Date(),
  currency = 'USD',
  showBlockchainVerification = true,
  complianceConfig = {
    hipaaCompliant: true,
    auditLevel: 'FULL',
    retentionPeriod: '7_YEARS'
  }
}) => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { getPaymentHistory } = usePayment();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const transactions = await getPaymentHistory();
        
        // Filter transactions by date range
        const filteredTransactions = transactions.filter(
          tx => tx.createdAt >= startDate && tx.createdAt <= endDate
        );

        const transformedData = await transformPaymentData(
          filteredTransactions,
          currency
        );

        setChartData(transformedData);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load compensation data'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate, currency, getPaymentHistory]);

  const renderTooltip = (props: any) => {
    if (!props.active || !props.payload?.length) {
      return null;
    }

    const dataPoint = props.payload[0].payload as ChartDataPoint;
    return (
      <div className="compensation-chart-tooltip" style={{
        backgroundColor: '#fff',
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '4px'
      }}>
        <p>Date: {dataPoint.date.toLocaleDateString()}</p>
        <p>Amount: {formatCurrency(dataPoint.amount, dataPoint.currency)}</p>
        {showBlockchainVerification && (
          <p>Verified: {dataPoint.isVerified ? '✓' : '✗'}</p>
        )}
        {complianceConfig.hipaaCompliant && (
          <p>HIPAA Compliant: ✓</p>
        )}
      </div>
    );
  };

  if (error) {
    return (
      <div className="compensation-chart-error">
        Error loading compensation data: {error.message}
      </div>
    );
  }

  if (isLoading) {
    return <div className="compensation-chart-loading">Loading compensation data...</div>;
  }

  return (
    <div className="compensation-chart-container">
      <ResponsiveContainer width={width} height={height}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <XAxis
            dataKey="date"
            tickFormatter={(date: Date) => date.toLocaleDateString()}
            type="category"
          />
          <YAxis
            tickFormatter={(value: number) => formatCurrency(value, currency)}
          />
          <Tooltip content={renderTooltip} />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="#2196F3"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false} // Disable animations for security
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CompensationChart;