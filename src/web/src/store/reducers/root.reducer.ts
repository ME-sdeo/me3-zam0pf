import { combineReducers } from '@reduxjs/toolkit'; // ^1.9.0

// Import feature reducers
import { reducer as authReducer } from './auth.reducer';
import { reducer as consentReducer } from './consent.reducer';
import { reducer as marketplaceReducer } from './marketplace.reducer';
import { reducer as fhirReducer } from './fhir.reducer';
import { reducer as paymentReducer } from './payment.reducer';
import { reducer as notificationReducer } from './notification.reducer';

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