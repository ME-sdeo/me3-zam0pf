import { renderHook, act } from '@testing-library/react-hooks'; // @testing-library/react-hooks ^8.0.1
import { Provider } from 'react-redux'; // react-redux ^8.0.5
import { configureStore } from '@reduxjs/toolkit'; // @reduxjs/toolkit ^1.9.5
import { useAuth } from '../../src/hooks/useAuth';
import { 
    ILoginCredentials, 
    IMFAConfig 
} from '../../src/interfaces/auth.interface';
import { 
    AuthStatus, 
    MFAMethod, 
    UserRole, 
    AuthError 
} from '../../src/types/auth.types';

// Mock MSAL browser package
jest.mock('@azure/msal-browser', () => ({
    PublicClientApplication: jest.fn().mockImplementation(() => ({
        loginPopup: jest.fn(),
        logoutPopup: jest.fn(),
        acquireTokenSilent: jest.fn(),
        getAllAccounts: jest.fn()
    })),
    Configuration: jest.fn()
}));

// Mock security metrics utility
jest.mock('../../src/utils/security', () => ({
    SecurityMetrics: jest.fn().mockImplementation(() => ({
        trackLoginAttempt: jest.fn(),
        trackLoginSuccess: jest.fn(),
        trackLoginFailure: jest.fn(),
        trackMFASetup: jest.fn(),
        trackMFASetupFailure: jest.fn(),
        trackMFASuccess: jest.fn(),
        trackMFAFailure: jest.fn(),
        trackLogout: jest.fn(),
        trackLogoutFailure: jest.fn(),
        trackSessionExpiry: jest.fn(),
        trackTokenRefreshFailure: jest.fn()
    }))
}));

describe('useAuth Hook', () => {
    // Test store setup
    const mockStore = configureStore({
        reducer: {
            auth: (state = {
                isAuthenticated: false,
                status: AuthStatus.UNAUTHENTICATED,
                user: null,
                tokens: null,
                lastActivity: 0,
                sessionExpiry: 0
            }, action) => state
        }
    });

    // Test wrapper component
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <Provider store={mockStore}>{children}</Provider>
    );

    // Mock auth result
    const mockAuthResult = {
        account: {
            localAccountId: 'test-user-id',
            username: 'test@example.com',
            name: 'Test User'
        },
        accessToken: 'mock-access-token',
        idToken: 'mock-id-token',
        tokenType: 'Bearer',
        expiresOn: new Date(Date.now() + 3600000),
        scopes: ['openid', 'profile', 'email']
    };

    // Test credentials
    const testCredentials: ILoginCredentials = {
        email: 'test@example.com',
        password: 'Test123!',
        rememberMe: false
    };

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        // Reset MSAL mock implementation
        const msalMock = require('@azure/msal-browser').PublicClientApplication;
        msalMock.mockImplementation(() => ({
            loginPopup: jest.fn().mockResolvedValue(mockAuthResult),
            logoutPopup: jest.fn().mockResolvedValue(undefined),
            acquireTokenSilent: jest.fn().mockResolvedValue(mockAuthResult),
            getAllAccounts: jest.fn().mockReturnValue([mockAuthResult.account])
        }));
    });

    describe('Login Functionality', () => {
        it('should handle successful login with security validation', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await act(async () => {
                await result.current.login(testCredentials);
            });

            // Verify authentication state
            expect(result.current.isAuthenticated).toBe(true);
            expect(result.current.status).toBe(AuthStatus.AUTHENTICATED);
            expect(result.current.user).toBeTruthy();
            expect(result.current.tokens).toBeTruthy();

            // Verify security metrics were tracked
            expect(result.current.securityMetrics.trackLoginAttempt)
                .toHaveBeenCalledWith(testCredentials.email);
            expect(result.current.securityMetrics.trackLoginSuccess)
                .toHaveBeenCalledWith('test-user-id');
        });

        it('should handle login failure with security monitoring', async () => {
            const loginError = new Error('Invalid credentials');
            const msalMock = require('@azure/msal-browser').PublicClientApplication;
            msalMock.mockImplementation(() => ({
                loginPopup: jest.fn().mockRejectedValue(loginError)
            }));

            const { result } = renderHook(() => useAuth(), { wrapper });

            await act(async () => {
                try {
                    await result.current.login(testCredentials);
                } catch (error) {
                    expect(error).toBe(loginError);
                }
            });

            expect(result.current.securityMetrics.trackLoginFailure)
                .toHaveBeenCalledWith(testCredentials.email, loginError);
        });
    });

    describe('MFA Functionality', () => {
        it('should handle MFA setup with security monitoring', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });
            
            // Setup initial authenticated state
            mockStore.dispatch({ 
                type: 'auth/loginSuccess',
                payload: {
                    user: {
                        id: 'test-user-id',
                        email: 'test@example.com',
                        role: UserRole.CONSUMER,
                        mfaEnabled: false,
                        mfaVerified: false
                    }
                }
            });

            await act(async () => {
                await result.current.setupMFA(MFAMethod.AUTHENTICATOR_APP);
            });

            expect(result.current.securityMetrics.trackMFASetup)
                .toHaveBeenCalledWith('test-user-id', MFAMethod.AUTHENTICATOR_APP);
        });

        it('should handle MFA verification with security validation', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });
            
            // Setup MFA required state
            mockStore.dispatch({
                type: 'auth/mfaRequired',
                payload: {
                    user: {
                        id: 'test-user-id',
                        mfaEnabled: true,
                        mfaVerified: false
                    }
                }
            });

            await act(async () => {
                await result.current.verifyMFA('123456');
            });

            expect(result.current.securityMetrics.trackMFASuccess)
                .toHaveBeenCalledWith('test-user-id');
        });
    });

    describe('Logout Functionality', () => {
        it('should handle logout with security cleanup', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            // Setup authenticated state
            mockStore.dispatch({
                type: 'auth/loginSuccess',
                payload: {
                    user: {
                        id: 'test-user-id',
                        email: 'test@example.com'
                    }
                }
            });

            await act(async () => {
                await result.current.logout();
            });

            // Verify cleanup
            expect(localStorage.getItem('myelixir_auth_token')).toBeNull();
            expect(localStorage.getItem('myelixir_refresh_token')).toBeNull();
            expect(localStorage.getItem('myelixir_mfa_session')).toBeNull();

            expect(result.current.securityMetrics.trackLogout)
                .toHaveBeenCalledWith('test-user-id');
        });
    });

    describe('Session Management', () => {
        it('should handle session expiry', async () => {
            jest.useFakeTimers();
            const { result } = renderHook(() => useAuth(), { wrapper });

            // Setup session with expiry
            mockStore.dispatch({
                type: 'auth/loginSuccess',
                payload: {
                    user: { id: 'test-user-id' },
                    sessionExpiry: Date.now() + 1000
                }
            });

            act(() => {
                jest.advanceTimersByTime(1001);
            });

            expect(result.current.securityMetrics.trackSessionExpiry)
                .toHaveBeenCalledWith('test-user-id');
            
            jest.useRealTimers();
        });

        it('should handle token refresh', async () => {
            jest.useFakeTimers();
            const { result } = renderHook(() => useAuth(), { wrapper });

            // Setup tokens with expiry
            mockStore.dispatch({
                type: 'auth/loginSuccess',
                payload: {
                    user: { id: 'test-user-id' },
                    tokens: {
                        expiresIn: Date.now() + 300000 // 5 minutes
                    }
                }
            });

            act(() => {
                jest.advanceTimersByTime(250000); // Advance close to refresh time
            });

            expect(result.current.tokens).toBeTruthy();
            
            jest.useRealTimers();
        });
    });
});