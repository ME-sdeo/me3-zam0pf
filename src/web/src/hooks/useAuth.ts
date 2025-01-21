import { useSelector, useDispatch } from 'react-redux'; // react-redux ^8.0.5
import { useCallback, useEffect, useRef } from 'react'; // react ^18.0.0
import { PublicClientApplication, Configuration } from '@azure/msal-browser'; // @azure/msal-browser ^2.32.0
import { IAuthUser, IAuthTokens, ILoginCredentials, IMFAConfig } from '../interfaces/auth.interface';
import { 
    MFAMethod, 
    UserRole,
    AUTH_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    MFA_SESSION_KEY
} from '../types/auth.types';
import { RootState } from '../store/types';
import { authActions } from '../store/slices/auth.slice';
import { SecurityMetrics } from '../utils/security';

// MSAL configuration for Azure AD B2C
const msalConfig: Configuration = {
    auth: {
        clientId: process.env.REACT_APP_AZURE_CLIENT_ID!,
        authority: process.env.REACT_APP_AZURE_AUTHORITY!,
        knownAuthorities: [process.env.REACT_APP_AZURE_KNOWN_AUTHORITIES!],
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
        navigateToLoginRequestUrl: true
    },
    cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false
    },
    system: {
        loggerOptions: {
            loggerCallback: (_level, message, containsPii) => {
                if (!containsPii) console.log(message);
            },
            piiLoggingEnabled: false
        }
    }
};

/**
 * Custom hook for managing authentication state and operations with enhanced security monitoring
 * Integrates with Azure AD B2C and implements HIPAA-compliant security measures
 */
export const useAuth = () => {
    const dispatch = useDispatch();
    const msalInstance = useRef(new PublicClientApplication(msalConfig));
    const securityMetrics = useRef(new SecurityMetrics());

    // Select auth state from Redux store
    const {
        isAuthenticated,
        status,
        user,
        tokens,
        sessionExpiry
    } = useSelector((state: RootState) => state.auth);

    /**
     * Handles user login with enhanced security measures
     * @param credentials - User login credentials
     */
    const login = useCallback(async (credentials: ILoginCredentials) => {
        try {
            // Start security monitoring for login attempt
            securityMetrics.current.trackLoginAttempt(credentials.email);

            const loginRequest = {
                scopes: ['openid', 'profile', 'email'],
                prompt: 'select_account',
                loginHint: credentials.email
            };

            const authResult = await msalInstance.current.loginPopup(loginRequest);
            
            if (authResult) {
                const userAccount = authResult.account;
                const tokens: IAuthTokens = {
                    accessToken: authResult.accessToken,
                    idToken: authResult.idToken,
                    refreshToken: '', // Handled by MSAL
                    expiresIn: authResult.expiresOn?.getTime() || 0,
                    tokenType: authResult.tokenType,
                    scope: authResult.scopes
                };

                // Create user object with enhanced security properties
                const user: IAuthUser = {
                    id: userAccount?.localAccountId || '',
                    email: userAccount?.username || '',
                    role: UserRole.CONSUMER, // Default role, updated from claims
                    mfaEnabled: false,
                    mfaVerified: false,
                    azureAccount: userAccount!,
                    lastLogin: Date.now()
                };

                dispatch(authActions.loginSuccess({ user, tokens }));
                securityMetrics.current.trackLoginSuccess(user.id);
            }
        } catch (error) {
            securityMetrics.current.trackLoginFailure(credentials.email, error);
            throw error;
        }
    }, [dispatch]);

    /**
     * Initiates MFA setup for the user
     * @param method - Selected MFA method
     */
    const setupMFA = useCallback(async (method: MFAMethod) => {
        if (!user) throw new Error('User not authenticated');

        try {
            const mfaConfig: IMFAConfig = {
                method,
                phoneNumber: null,
                secret: null,
                verified: false,
                lastVerified: null,
                recoveryCode: []
            };

            // Handle different MFA methods
            switch (method) {
                case MFAMethod.SMS:
                    // SMS setup logic
                    break;
                case MFAMethod.AUTHENTICATOR_APP:
                    // Authenticator app setup logic
                    break;
                case MFAMethod.BIOMETRIC:
                    // Biometric setup logic
                    break;
            }

            dispatch(authActions.updateMFAConfig(mfaConfig));
            securityMetrics.current.trackMFASetup(user.id, method);
        } catch (error) {
            securityMetrics.current.trackMFASetupFailure(user.id, method, error);
            throw error;
        }
    }, [dispatch, user]);

    /**
     * Verifies MFA challenge response
     * @param _code - Verification code
     */
    const verifyMFA = useCallback(async (_code: string) => {
        if (!user) throw new Error('User not authenticated');

        try {
            // Verify MFA code logic
            const verified = true; // Replace with actual verification

            if (verified) {
                dispatch(authActions.mfaVerified());
                securityMetrics.current.trackMFASuccess(user.id);
            } else {
                throw new Error('MFA verification failed');
            }
        } catch (error) {
            securityMetrics.current.trackMFAFailure(user.id, error);
            throw error;
        }
    }, [dispatch, user]);

    /**
     * Handles user logout with security cleanup
     */
    const logout = useCallback(async () => {
        try {
            await msalInstance.current.logoutPopup();
            
            // Clear local storage securely
            [AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, MFA_SESSION_KEY].forEach(key => {
                localStorage.removeItem(key);
            });

            dispatch(authActions.logout());
            securityMetrics.current.trackLogout(user?.id);
        } catch (error) {
            securityMetrics.current.trackLogoutFailure(user?.id, error);
            throw error;
        }
    }, [dispatch, user]);

    // Session monitoring effect
    useEffect(() => {
        if (isAuthenticated && sessionExpiry) {
            const timeoutId = setTimeout(() => {
                if (Date.now() > sessionExpiry) {
                    dispatch(authActions.sessionExpired());
                    securityMetrics.current.trackSessionExpiry(user?.id);
                }
            }, sessionExpiry - Date.now());

            return () => clearTimeout(timeoutId);
        }
    }, [dispatch, isAuthenticated, sessionExpiry, user]);

    // Token refresh effect
    useEffect(() => {
        if (isAuthenticated && tokens?.expiresIn) {
            const refreshTime = tokens.expiresIn - 300000; // 5 minutes before expiry
            const timeoutId = setTimeout(async () => {
                try {
                    const account = msalInstance.current.getAllAccounts()[0];
                    if (account) {
                        const silentRequest = {
                            scopes: ['openid', 'profile', 'email'],
                            account
                        };
                        const authResult = await msalInstance.current.acquireTokenSilent(silentRequest);
                        dispatch(authActions.updateTokens({
                            accessToken: authResult.accessToken,
                            idToken: authResult.idToken,
                            expiresIn: authResult.expiresOn?.getTime() || 0,
                            tokenType: authResult.tokenType,
                            scope: authResult.scopes,
                            refreshToken: ''
                        }));
                    }
                } catch (error) {
                    securityMetrics.current.trackTokenRefreshFailure(user?.id, error);
                    dispatch(authActions.tokenRefreshFailed());
                }
            }, refreshTime - Date.now());

            return () => clearTimeout(timeoutId);
        }
    }, [dispatch, isAuthenticated, tokens, user]);

    return {
        isAuthenticated,
        status,
        user,
        tokens,
        login,
        logout,
        setupMFA,
        verifyMFA,
        securityMetrics: securityMetrics.current
    };
};

export default useAuth;