import { combineReducers } from '@reduxjs/toolkit'; // ^1.9.0

// Import feature reducers
import authReducer from './auth.reducer';
import consentReducer from './consent.reducer';
import marketplaceReducer from './marketplace.reducer';
import fhirReducer from './fhir.reducer';
import paymentReducer from './payment.reducer';
import notificationReducer from './notification.reducer';

// Import state interfaces
import { IAuthState } from '../../interfaces/auth.interface';
import { IConsentState } from './consent.reducer';
import { MarketplaceState } from './marketplace.reducer';
import { IFHIRState } from './fhir.reducer';
import { IPaymentState } from './payment.reducer';
import { NotificationState } from './notification.reducer';

/**
 * Comprehensive interface defining the complete Redux store state
 * Combines all feature states with strict typing
 */
export interface RootState {
  auth: IAuthState;
  consent: IConsentState;
  marketplace: MarketplaceState;
  fhir: IFHIRState;
  payment: IPaymentState;
  notification: NotificationState;
}

/**
 * Root reducer combining all feature reducers
 * Implements centralized state management with proper type inference
 */
const rootReducer = combineReducers<RootState>({
  auth: authReducer,
  consent: consentReducer,
  marketplace: marketplaceReducer,
  fhir: fhirReducer,
  payment: paymentReducer,
  notification: notificationReducer
});

export default rootReducer;