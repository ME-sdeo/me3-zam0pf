import { configureStore, ThunkAction, Action } from '@reduxjs/toolkit'; // ^1.9.0
import { createLogger } from 'redux-logger'; // ^3.0.6
import rootReducer, { RootState } from './reducers/root.reducer';

// Import HIPAA-compliant security middleware
import { 
  securityMiddleware, 
  SecurityContext 
} from '@myelixir/security-middleware'; // ^1.0.0

// Import audit logging middleware
import { 
  auditMiddleware, 
  AuditContext 
} from '@myelixir/audit-middleware'; // ^1.0.0

/**
 * Configure Redux store with HIPAA-compliant security features
 * and comprehensive middleware support
 */
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => 
    getDefaultMiddleware({
      // Configure serialization checks for HIPAA compliance
      serializableCheck: {
        // Ignore blockchain transaction actions
        ignoredActions: ['BLOCKCHAIN_TRANSACTION'],
        // Ignore non-serializable values in specific paths
        ignoredPaths: [
          'auth.securityContext.lastActivity',
          'fhir.validationResult.timestamp',
          'payment.currentPaymentIntent'
        ]
      },
      // Enable immutability checks for data integrity
      immutableCheck: true,
      // Enable thunk middleware for async actions
      thunk: {
        extraArgument: {
          security: {
            validateToken: true,
            enforceHIPAA: true,
            auditLevel: 'strict'
          }
        }
      }
    }).concat(
      // Add HIPAA-compliant security middleware
      securityMiddleware({
        validateTokens: true,
        enforceEncryption: true,
        auditAccess: true,
        blockUntrustedOrigins: true
      }),
      // Add audit logging middleware
      auditMiddleware({
        level: 'HIPAA_FULL',
        retention: '7_YEARS',
        includeMetadata: true,
        maskSensitiveData: true
      }),
      // Add logger in development only
      process.env.NODE_ENV !== 'production' 
        ? createLogger({ 
            collapsed: true,
            // Sanitize sensitive data in logs
            sanitize: (state) => ({
              ...state,
              auth: {
                ...state.auth,
                tokens: '[REDACTED]',
                mfaState: '[REDACTED]'
              },
              payment: {
                ...state.payment,
                currentPaymentIntent: '[REDACTED]'
              }
            })
          }) 
        : []
    ),
  devTools: process.env.NODE_ENV !== 'production' && {
    // Configure Redux DevTools with security features
    trace: true,
    traceLimit: 25,
    // Sanitize sensitive data in DevTools
    actionSanitizer: (action) => {
      if (action.type.includes('auth/') || action.type.includes('payment/')) {
        return { ...action, payload: '[REDACTED]' };
      }
      return action;
    },
    stateSanitizer: (state) => ({
      ...state,
      auth: {
        ...state.auth,
        tokens: '[REDACTED]',
        mfaState: '[REDACTED]'
      },
      payment: {
        ...state.payment,
        currentPaymentIntent: '[REDACTED]'
      }
    })
  }
});

// Type definitions for enhanced type safety
export type AppDispatch = typeof store.dispatch;

export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  { 
    security: SecurityContext;
    audit: AuditContext;
  },
  Action<string>
>;

export default store;