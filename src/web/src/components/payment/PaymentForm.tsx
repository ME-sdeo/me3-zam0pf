import React, { useCallback, useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form'; // react-hook-form ^7.45.0
import { useStripe, useElements } from '@stripe/stripe-react-js'; // @stripe/stripe-react-js
import { CardElement } from '@stripe/stripe-react-js'; // @stripe/stripe-react-js
import * as yup from 'yup'; // yup ^1.2.0
import { usePayment } from '../../hooks/usePayment';
import { PaymentMethodType } from '../../interfaces/payment.interface';
import { TransactionStatus } from '../../types/marketplace.types';

// Card element styling for accessibility and visual consistency
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      letterSpacing: '0.025em',
      fontFamily: 'Source Code Pro, monospace',
      '::placeholder': {
        color: '#aab7c4',
      },
      backgroundColor: '#fff',
      padding: '10px 12px',
      borderRadius: '4px',
      border: '1px solid #e6e6e6',
    },
    invalid: {
      color: '#9e2146',
      '::placeholder': {
        color: '#9e2146',
      },
    },
  },
  hidePostalCode: true,
  aria: {
    label: 'Secure payment card input',
    invalid: 'Payment card information is invalid',
    required: 'Payment card information is required',
  },
};

// Form validation schema
const validationSchema = yup.object().shape({
  name: yup.string().required('Cardholder name is required'),
  complianceAcknowledgment: yup.boolean()
    .oneOf([true], 'You must acknowledge the compliance requirements')
    .required('Compliance acknowledgment is required'),
  purposeOfUse: yup.string()
    .required('Purpose of use is required')
    .min(10, 'Purpose of use must be at least 10 characters'),
  dataJurisdiction: yup.string()
    .required('Data jurisdiction is required'),
});

interface IPaymentFormProps {
  amount: number;
  currency: string;
  complianceLevel: 'HIPAA' | 'GDPR' | 'BOTH';
  onSuccess: (transactionId: string, blockchainRef: string) => void;
  onError: (error: Error) => void;
  onComplianceError: (error: Error) => void;
}

interface IFormInputs {
  name: string;
  complianceAcknowledgment: boolean;
  purposeOfUse: string;
  dataJurisdiction: string;
}

export const PaymentForm: React.FC<IPaymentFormProps> = ({
  amount,
  currency,
  complianceLevel,
  onSuccess,
  onError,
  onComplianceError,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [cardError, setCardError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [complianceVerified, setComplianceVerified] = useState(false);

  const {
    createPaymentIntent,
    confirmPayment,
    verifyBlockchainTransaction,
    loading,
    error: paymentError,
  } = usePayment();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<IFormInputs>({
    defaultValues: {
      name: '',
      complianceAcknowledgment: false,
      purposeOfUse: '',
      dataJurisdiction: '',
    },
    mode: 'onChange',
  });

  // Verify compliance requirements on mount
  useEffect(() => {
    const verifyCompliance = async () => {
      try {
        // Compliance verification logic would go here
        setComplianceVerified(true);
      } catch (error) {
        onComplianceError(error instanceof Error ? error : new Error('Compliance verification failed'));
        setComplianceVerified(false);
      }
    };

    verifyCompliance();
  }, [complianceLevel, onComplianceError]);

  const handlePaymentSubmit = useCallback(async (formData: IFormInputs) => {
    if (!stripe || !elements || !complianceVerified) {
      return;
    }

    setProcessing(true);
    setCardError(null);

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Create payment method
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          name: formData.name,
        },
      });

      if (stripeError || !paymentMethod) {
        throw new Error(stripeError?.message || 'Failed to create payment method');
      }

      // Create payment intent with compliance metadata
      const paymentIntent = await createPaymentIntent({
        amount: {
          value: amount,
          currency: currency as any, // Type assertion to handle currency validation
          exchangeRate: 1,
          exchangeRateTimestamp: new Date(),
          isRefundable: true,
        },
        paymentMethod: {
          id: paymentMethod.id,
          type: PaymentMethodType.CREDIT_CARD,
          last4: paymentMethod.card?.last4 || '',
          brand: paymentMethod.card?.brand || '',
          expiryDate: new Date(),
          isDefault: true,
          billingAddress: '',
          postalCode: '',
          country: '',
        },
        metadata: {
          requestId: '', // Added required fields
          dataProvider: '',
          dataConsumer: '',
          recordCount: 0,
          consentId: '',
          purposeOfUse: formData.purposeOfUse,
          dataJurisdiction: formData.dataJurisdiction,
          timestamp: new Date().toISOString(),
        },
      });

      // Confirm payment with blockchain verification
      const confirmedPayment = await confirmPayment(
        paymentIntent.transactionId, // Updated to use transactionId
        {
          complianceMetadata: {
            level: complianceLevel,
            verifiedAt: new Date().toISOString(),
          },
        }
      );

      // Verify blockchain transaction
      const blockchainVerified = await verifyBlockchainTransaction(
        confirmedPayment.blockchainRef
      );

      if (!blockchainVerified) {
        throw new Error('Blockchain verification failed');
      }

      if (confirmedPayment.status === TransactionStatus.COMPLETED) {
        onSuccess(confirmedPayment.transactionId, confirmedPayment.blockchainRef);
      } else {
        throw new Error('Payment confirmation failed');
      }
    } catch (error) {
      setCardError(error instanceof Error ? error.message : 'Payment processing failed');
      onError(error instanceof Error ? error : new Error('Payment processing failed'));
    } finally {
      setProcessing(false);
    }
  }, [
    stripe,
    elements,
    amount,
    currency,
    complianceLevel,
    complianceVerified,
    createPaymentIntent,
    confirmPayment,
    verifyBlockchainTransaction,
    onSuccess,
    onError,
  ]);

  if (!complianceVerified) {
    return <div role="alert">Verifying compliance requirements...</div>;
  }

  return (
    <form
      onSubmit={handleSubmit(handlePaymentSubmit)}
      className="payment-form"
      aria-label="Payment form"
    >
      <div className="form-group">
        <Controller
          name="name"
          control={control}
          rules={{ required: true }}
          render={({ field }) => (
            <div>
              <label htmlFor="name" className="form-label">
                Cardholder Name
              </label>
              <input
                {...field}
                type="text"
                id="name"
                className="form-control"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {errors.name && (
                <span id="name-error" className="error-message" role="alert">
                  {errors.name.message}
                </span>
              )}
            </div>
          )}
        />
      </div>

      <div className="form-group">
        <label htmlFor="card-element" className="form-label">
          Payment Card
        </label>
        <CardElement
          id="card-element"
          options={CARD_ELEMENT_OPTIONS}
          onChange={(event) => {
            if (event.error) {
              setCardError(event.error.message);
            } else {
              setCardError(null);
            }
          }}
        />
        {cardError && (
          <span className="error-message" role="alert">
            {cardError}
          </span>
        )}
      </div>

      <div className="form-group">
        <Controller
          name="purposeOfUse"
          control={control}
          rules={{ required: true }}
          render={({ field }) => (
            <div>
              <label htmlFor="purposeOfUse" className="form-label">
                Purpose of Use
              </label>
              <textarea
                {...field}
                id="purposeOfUse"
                className="form-control"
                aria-invalid={!!errors.purposeOfUse}
                aria-describedby={errors.purposeOfUse ? 'purpose-error' : undefined}
              />
              {errors.purposeOfUse && (
                <span id="purpose-error" className="error-message" role="alert">
                  {errors.purposeOfUse.message}
                </span>
              )}
            </div>
          )}
        />
      </div>

      <div className="form-group">
        <Controller
          name="dataJurisdiction"
          control={control}
          rules={{ required: true }}
          render={({ field }) => (
            <div>
              <label htmlFor="dataJurisdiction" className="form-label">
                Data Jurisdiction
              </label>
              <select
                {...field}
                id="dataJurisdiction"
                className="form-control"
                aria-invalid={!!errors.dataJurisdiction}
                aria-describedby={errors.dataJurisdiction ? 'jurisdiction-error' : undefined}
              >
                <option value="">Select jurisdiction</option>
                <option value="US">United States (HIPAA)</option>
                <option value="EU">European Union (GDPR)</option>
                <option value="BOTH">Both HIPAA and GDPR</option>
              </select>
              {errors.dataJurisdiction && (
                <span id="jurisdiction-error" className="error-message" role="alert">
                  {errors.dataJurisdiction.message}
                </span>
              )}
            </div>
          )}
        />
      </div>

      <div className="form-group">
        <Controller
          name="complianceAcknowledgment"
          control={control}
          rules={{ required: true }}
          render={({ field: { onChange, value, ...field } }) => (
            <div className="checkbox-group">
              <input
                {...field}
                type="checkbox"
                id="complianceAcknowledgment"
                checked={value}
                onChange={(e) => onChange(e.target.checked)}
                aria-invalid={!!errors.complianceAcknowledgment}
                aria-describedby={errors.complianceAcknowledgment ? 'compliance-error' : undefined}
              />
              <label htmlFor="complianceAcknowledgment" className="checkbox-label">
                I acknowledge and agree to comply with all applicable healthcare data privacy regulations
              </label>
              {errors.complianceAcknowledgment && (
                <span id="compliance-error" className="error-message" role="alert">
                  {errors.complianceAcknowledgment.message}
                </span>
              )}
            </div>
          )}
        />
      </div>

      <button
        type="submit"
        className="submit-button"
        disabled={processing || loading || !stripe || !elements}
        aria-busy={processing || loading}
      >
        {processing || loading ? 'Processing...' : `Pay ${amount} ${currency}`}
      </button>

      {paymentError && (
        <div className="error-message" role="alert">
          {paymentError}
        </div>
      )}
    </form>
  );
};

export default PaymentForm;