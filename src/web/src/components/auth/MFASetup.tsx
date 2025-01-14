import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../common/Button';
import { MFAMethod } from '../../types/auth.types';

// Rate limiting constants
const MAX_ATTEMPTS = 3;
const ATTEMPT_WINDOW = 300000; // 5 minutes in milliseconds

interface MFASetupProps {
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export const MFASetup: React.FC<MFASetupProps> = ({ onComplete, onError }) => {
  const { t } = useTranslation();
  const { setupMFA, verifyMFA } = useAuth();

  // Component state
  const [selectedMethod, setSelectedMethod] = useState<MFAMethod | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(0);

  // Reset verification states when method changes
  useEffect(() => {
    setVerificationCode('');
    setError(null);
    setQrCodeUrl(null);
  }, [selectedMethod]);

  // Rate limiting check
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    if (attempts >= MAX_ATTEMPTS && (now - lastAttemptTime) < ATTEMPT_WINDOW) {
      setError(t('mfa.error.tooManyAttempts'));
      return false;
    }
    if ((now - lastAttemptTime) >= ATTEMPT_WINDOW) {
      setAttempts(0);
    }
    return true;
  }, [attempts, lastAttemptTime, t]);

  // Handle MFA method selection
  const handleMethodSelection = useCallback(async (method: MFAMethod) => {
    try {
      setLoading(true);
      setError(null);
      setSelectedMethod(method);
      
      // Clear sensitive data
      setVerificationCode('');
      setQrCodeUrl(null);
      
      await setupMFA(method);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mfa.error.setupFailed'));
      onError?.(err instanceof Error ? err : new Error(t('mfa.error.setupFailed')));
    } finally {
      setLoading(false);
    }
  }, [setupMFA, t, onError]);

  // Handle phone number submission for SMS verification
  const handlePhoneNumberSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!checkRateLimit()) return;

    try {
      setLoading(true);
      setError(null);

      // Validate phone number format (E.164)
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(phoneNumber)) {
        throw new Error(t('mfa.error.invalidPhone'));
      }

      await setupMFA(MFAMethod.SMS);
      setAttempts(prev => prev + 1);
      setLastAttemptTime(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mfa.error.smsFailed'));
      onError?.(err instanceof Error ? err : new Error(t('mfa.error.smsFailed')));
    } finally {
      setLoading(false);
    }
  }, [phoneNumber, setupMFA, checkRateLimit, t, onError]);

  // Handle QR code setup for authenticator app
  const handleQRCodeSetup = useCallback(async () => {
    if (!checkRateLimit()) return;

    try {
      setLoading(true);
      setError(null);

      await setupMFA(MFAMethod.AUTHENTICATOR_APP);
      setAttempts(prev => prev + 1);
      setLastAttemptTime(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mfa.error.qrFailed'));
      onError?.(err instanceof Error ? err : new Error(t('mfa.error.qrFailed')));
    } finally {
      setLoading(false);
    }
  }, [setupMFA, checkRateLimit, t, onError]);

  // Handle verification code submission
  const handleVerificationSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!checkRateLimit()) return;

    try {
      setLoading(true);
      setError(null);

      // Validate verification code format
      const codeRegex = /^\d{6}$/;
      if (!codeRegex.test(verificationCode)) {
        throw new Error(t('mfa.error.invalidCode'));
      }

      await verifyMFA(verificationCode);
      setSetupComplete(true);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mfa.error.verificationFailed'));
      onError?.(err instanceof Error ? err : new Error(t('mfa.error.verificationFailed')));
      setAttempts(prev => prev + 1);
      setLastAttemptTime(Date.now());
    } finally {
      setLoading(false);
    }
  }, [verificationCode, verifyMFA, checkRateLimit, t, onComplete, onError]);

  return (
    <div className="mfa-setup" role="region" aria-label={t('mfa.setup.title')}>
      {!selectedMethod && (
        <div className="mfa-setup__method-selection">
          <h2>{t('mfa.setup.selectMethod')}</h2>
          <div className="mfa-setup__methods">
            <Button
              variant="primary"
              onClick={() => handleMethodSelection(MFAMethod.SMS)}
              disabled={loading}
              aria-label={t('mfa.setup.smsButton')}
            >
              {t('mfa.setup.sms')}
            </Button>
            <Button
              variant="primary"
              onClick={() => handleMethodSelection(MFAMethod.AUTHENTICATOR_APP)}
              disabled={loading}
              aria-label={t('mfa.setup.authenticatorButton')}
            >
              {t('mfa.setup.authenticator')}
            </Button>
          </div>
        </div>
      )}

      {selectedMethod === MFAMethod.SMS && (
        <form onSubmit={handlePhoneNumberSubmit} className="mfa-setup__sms">
          <label htmlFor="phone-number">{t('mfa.setup.phoneLabel')}</label>
          <input
            id="phone-number"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1234567890"
            required
            pattern="^\+[1-9]\d{1,14}$"
            aria-invalid={error ? 'true' : 'false'}
            disabled={loading}
          />
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={!phoneNumber || loading}
          >
            {t('mfa.setup.sendCode')}
          </Button>
        </form>
      )}

      {selectedMethod === MFAMethod.AUTHENTICATOR_APP && !qrCodeUrl && (
        <div className="mfa-setup__authenticator">
          <p>{t('mfa.setup.authenticatorInstructions')}</p>
          <Button
            variant="primary"
            onClick={handleQRCodeSetup}
            loading={loading}
            disabled={loading}
          >
            {t('mfa.setup.generateQR')}
          </Button>
        </div>
      )}

      {qrCodeUrl && (
        <div className="mfa-setup__qr-code">
          <img
            src={qrCodeUrl}
            alt={t('mfa.setup.qrCodeAlt')}
            className="mfa-setup__qr-image"
          />
        </div>
      )}

      {(selectedMethod === MFAMethod.SMS || qrCodeUrl) && (
        <form onSubmit={handleVerificationSubmit} className="mfa-setup__verification">
          <label htmlFor="verification-code">{t('mfa.setup.codeLabel')}</label>
          <input
            id="verification-code"
            type="text"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            placeholder="123456"
            required
            pattern="\d{6}"
            maxLength={6}
            aria-invalid={error ? 'true' : 'false'}
            disabled={loading}
          />
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={!verificationCode || loading}
          >
            {t('mfa.setup.verify')}
          </Button>
        </form>
      )}

      {error && (
        <div className="mfa-setup__error" role="alert">
          {error}
        </div>
      )}

      {setupComplete && (
        <div className="mfa-setup__success" role="alert">
          {t('mfa.setup.success')}
        </div>
      )}
    </div>
  );
};

export default MFASetup;