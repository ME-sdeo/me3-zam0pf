import React, { useState, useEffect, useCallback, useRef } from 'react';
import CircularProgress from '@mui/material/CircularProgress'; // v5.0.0
import { IFHIRResource, IFHIRValidationResult } from '../../interfaces/fhir.interface';
import { validateFHIRResource } from '../../utils/fhir.util';
import Alert from '../common/Alert';
import { useFHIR } from '../../hooks/useFHIR';
import { FHIR_VALIDATION_RULES } from '../../constants/fhir.constants';

interface FHIRValidatorProps {
  resource: IFHIRResource;
  onValidationComplete: (result: IFHIRValidationResult) => void;
  autoValidate?: boolean;
}

interface ValidationMetrics {
  totalValidations: number;
  successfulValidations: number;
  averageValidationTime: number;
  lastValidationTime: number;
}

const FHIRValidator: React.FC<FHIRValidatorProps> = ({
  resource,
  onValidationComplete,
  autoValidate = true
}) => {
  // State management
  const [validationResult, setValidationResult] = useState<IFHIRValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [metrics, setMetrics] = useState<ValidationMetrics>({
    totalValidations: 0,
    successfulValidations: 0,
    averageValidationTime: 0,
    lastValidationTime: 0
  });

  // Refs for performance tracking and caching
  const validationCache = useRef<Map<string, IFHIRValidationResult>>(new Map());
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Custom hook for FHIR operations
  const { loading, error } = useFHIR({
    strictValidation: FHIR_VALIDATION_RULES.STRICT_MODE,
    enableMetrics: true
  });

  /**
   * Validates the FHIR resource with enhanced error handling and performance tracking
   */
  const validateResource = useCallback(async (resourceToValidate: IFHIRResource) => {
    const startTime = performance.now();
    const cacheKey = JSON.stringify(resourceToValidate);

    try {
      setIsValidating(true);

      // Check validation cache
      const cachedResult = validationCache.current.get(cacheKey);
      if (cachedResult) {
        setValidationResult(cachedResult);
        onValidationComplete(cachedResult);
        return;
      }

      // Set validation timeout
      timeoutRef.current = setTimeout(() => {
        setIsValidating(false);
        throw new Error('Validation timeout exceeded');
      }, FHIR_VALIDATION_RULES.VALIDATION_TIMEOUT);

      // Perform validation
      const result = await validateFHIRResource(resourceToValidate);
      
      // Update metrics
      const validationTime = performance.now() - startTime;
      setMetrics(prev => {
        const newTotal = prev.totalValidations + 1;
        const newSuccessful = prev.successfulValidations + (result.valid ? 1 : 0);
        return {
          totalValidations: newTotal,
          successfulValidations: newSuccessful,
          averageValidationTime: (prev.averageValidationTime * prev.totalValidations + validationTime) / newTotal,
          lastValidationTime: validationTime
        };
      });

      // Cache result
      if (validationCache.current.size >= 100) {
        const firstKey = validationCache.current.keys().next().value;
        validationCache.current.delete(firstKey);
      }
      validationCache.current.set(cacheKey, result);

      // Update state and notify parent
      setValidationResult(result);
      onValidationComplete(result);

    } catch (error) {
      const errorResult: IFHIRValidationResult = {
        valid: false,
        errors: [{
          type: 'Structure',
          field: 'root',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          code: 'VALIDATION_ERROR',
          severity: 'Error',
          path: [],
          context: { error }
        }],
        warnings: [],
        processingTime: performance.now() - startTime,
        resourceCount: 1
      };
      setValidationResult(errorResult);
      onValidationComplete(errorResult);
    } finally {
      setIsValidating(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  }, [onValidationComplete]);

  // Auto-validation effect
  useEffect(() => {
    if (autoValidate && resource) {
      validateResource(resource);
    }
  }, [resource, autoValidate, validateResource]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      validationCache.current.clear();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Success rate calculation for accessibility announcements
  const successRate = metrics.totalValidations > 0
    ? (metrics.successfulValidations / metrics.totalValidations) * 100
    : 100;

  return (
    <div
      className="fhir-validator"
      role="region"
      aria-label="FHIR Resource Validation"
      aria-busy={isValidating}
    >
      {/* Validation Status */}
      <div role="status" aria-live="polite" className="validation-status">
        {isValidating && (
          <div className="validation-progress">
            <CircularProgress size={24} />
            <span className="sr-only">Validating FHIR resource...</span>
          </div>
        )}
      </div>

      {/* Validation Results */}
      {validationResult && !isValidating && (
        <div className="validation-results" aria-live="polite">
          {validationResult.valid ? (
            <Alert
              severity="success"
              message="Resource validation successful"
              className="validation-alert"
            />
          ) : (
            <div role="alert">
              {validationResult.errors.map((error, index) => (
                <Alert
                  key={`${error.field}-${index}`}
                  severity="error"
                  message={`${error.field}: ${error.message}`}
                  className="validation-alert"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Validation Metrics - Only shown when meeting success rate target */}
      {successRate >= 99.9 && (
        <div 
          className="validation-metrics"
          role="complementary"
          aria-label="Validation metrics"
        >
          <span className="sr-only">
            Validation success rate: {successRate.toFixed(1)}%
          </span>
          <span className="sr-only">
            Average validation time: {metrics.averageValidationTime.toFixed(0)}ms
          </span>
        </div>
      )}

      {/* Error Boundary Fallback */}
      {error && (
        <Alert
          severity="error"
          message="An error occurred during validation. Please try again."
          className="validation-alert"
        />
      )}
    </div>
  );
};

export default FHIRValidator;