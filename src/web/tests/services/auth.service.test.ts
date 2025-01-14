import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0
import { PublicClientApplication, AuthenticationResult, InteractionRequiredAuthError } from '@azure/msal-browser'; // ^2.32.0
import { BehaviorSubject } from 'rxjs'; // rxjs ^7.8.0

import { AuthService } from '../../src/services/auth.service';
import { 
    AuthStatus, 
    AuthError, 
    UserRole, 
    MFAMethod 
} from '../../src/types/auth.types';
import { 
    IAuthState, 
    ILoginCredentials, 
    IAuthUser, 
    IAuthTokens 
} from '../../src/interfaces/auth.interface';

// Mock MSAL instance
const mockMsalInstance = {
    loginPopup: jest.fn(),
    acquireTokenPopup: jest.fn(),
    acquireTokenSilent: jest.fn(),
    logout: jest.fn()
} as unknown as jest.Mocked<PublicClientApplication>;

// Mock configuration
const mockConfig = {
    b2cTenantName: 'myelixir',
    clientId: 'test-client-id',
    apiScopes: ['user.read']
};

// Mock authentication result
const mockAuthResult: AuthenticationResult = {
    accessToken: 'mock-access-token',
    idToken: 'mock-id-token',
    uniqueId: 'test-user-id',
    tokenType: 'Bearer',
    scopes: ['user.read'],
    account: {
        homeAccountId: 'home-account-id',
        environment: 'test-env',
        tenantId: 'tenant-id',
        username: 'test@example.com',
        localAccountId: 'local-account-id'
    },
    expiresOn: new Date(Date.now() + 3600000)
};

describe('AuthService', () => {
    let authService: AuthService;
    let localStorageMock: { [key: string]: string };

    beforeEach(() => {
        // Reset mocks and storage
        jest.clearAllMocks();
        localStorageMock = {};

        // Mock localStorage
        global.localStorage = {
            getItem: (key: string) => localStorageMock[key] || null,
            setItem: (key: string, value: string) => { localStorageMock[key] = value; },
            removeItem: (key: string) => { delete localStorageMock[key]; },
            clear: () => { localStorageMock = {}; },
            length: 0,
            key: () => null
        };

        // Mock navigator
        global.navigator = {
            userAgent: 'test-user-agent'
        } as unknown as Navigator;

        // Initialize service
        authService = new AuthService(mockMsalInstance, mockConfig);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    test('should initialize with secure defaults', async () => {
        const authState = await new Promise<IAuthState>(resolve => {
            authService.getAuthState().subscribe(state => resolve(state));
        });

        expect(authState).toEqual({
            isAuthenticated: false,
            status: AuthStatus.UNAUTHENTICATED,
            user: null,
            tokens: null,
            lastActivity: 0,
            sessionExpiry: 0
        });
    });

    test('should handle secure login flow with MFA', async () => {
        // Mock successful login
        mockMsalInstance.loginPopup.mockResolvedValueOnce(mockAuthResult);

        const credentials: ILoginCredentials = {
            email: 'test@example.com',
            password: 'secure-password',
            rememberMe: false
        };

        await authService.login(credentials);

        const authState = await new Promise<IAuthState>(resolve => {
            authService.getAuthState().subscribe(state => resolve(state));
        });

        expect(authState.isAuthenticated).toBe(true);
        expect(authState.status).toBe(AuthStatus.AUTHENTICATED);
        expect(authState.user?.email).toBe('test@example.com');
        expect(authState.user?.mfaEnabled).toBe(true);
        expect(mockMsalInstance.loginPopup).toHaveBeenCalledWith({
            scopes: mockConfig.apiScopes,
            prompt: 'select_account'
        });
    });

    test('should enforce login attempt limits', async () => {
        const credentials: ILoginCredentials = {
            email: 'test@example.com',
            password: 'wrong-password',
            rememberMe: false
        };

        mockMsalInstance.loginPopup.mockRejectedValue(new Error('Invalid credentials'));

        // Attempt login multiple times
        for (let i = 0; i < 3; i++) {
            try {
                await authService.login(credentials);
            } catch (error) {
                expect(error).toBeTruthy();
            }
        }

        // Next attempt should trigger account lockout
        await expect(authService.login(credentials))
            .rejects
            .toThrow(AuthError.ACCOUNT_LOCKED);
    });

    test('should handle MFA setup securely', async () => {
        // Mock authenticated state
        const mockAuthState: IAuthState = {
            isAuthenticated: true,
            status: AuthStatus.AUTHENTICATED,
            user: {
                id: 'test-user-id',
                email: 'test@example.com',
                role: UserRole.CONSUMER,
                mfaEnabled: false,
                mfaVerified: false,
                azureAccount: mockAuthResult.account!,
                lastLogin: Date.now()
            },
            tokens: {
                accessToken: 'test-token',
                refreshToken: 'test-refresh',
                idToken: 'test-id-token',
                expiresIn: Date.now() + 3600000,
                tokenType: 'Bearer',
                scope: ['user.read']
            },
            lastActivity: Date.now(),
            sessionExpiry: Date.now() + 3600000
        };

        (authService as any).authState$.next(mockAuthState);

        mockMsalInstance.acquireTokenSilent.mockResolvedValueOnce({
            ...mockAuthResult,
            uniqueId: 'mfa-challenge-id'
        });

        const mfaResponse = await authService.setupMFA(MFAMethod.AUTHENTICATOR_APP);

        expect(mfaResponse).toEqual({
            challengeId: 'mfa-challenge-id',
            method: MFAMethod.AUTHENTICATOR_APP,
            expiresAt: expect.any(Number)
        });
    });

    test('should validate tokens securely', async () => {
        const mockTokens: IAuthTokens = {
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaXNzIjoiaHR0cHM6Ly9teWVsaXhpci5iMmNsb2dpbi5jb20vbXllbGl4aXIub25taWNyb3NvZnQuY29tL3YyLjAiLCJleHAiOjk5OTk5OTk5OTl9.signature',
            refreshToken: 'test-refresh',
            idToken: 'test-id-token',
            expiresIn: Date.now() + 3600000,
            tokenType: 'Bearer',
            scope: ['user.read']
        };

        const isValid = await (authService as any).validateTokens(mockTokens);
        expect(isValid).toBe(true);
    });

    test('should handle secure logout', async () => {
        await authService.logout();

        const authState = await new Promise<IAuthState>(resolve => {
            authService.getAuthState().subscribe(state => resolve(state));
        });

        expect(authState.isAuthenticated).toBe(false);
        expect(authState.status).toBe(AuthStatus.UNAUTHENTICATED);
        expect(authState.user).toBeNull();
        expect(authState.tokens).toBeNull();
        expect(mockMsalInstance.logout).toHaveBeenCalled();
        expect(localStorageMock['auth_state']).toBeUndefined();
    });

    test('should handle session timeout', async () => {
        jest.useFakeTimers();

        // Set up authenticated session
        const mockAuthState: IAuthState = {
            isAuthenticated: true,
            status: AuthStatus.AUTHENTICATED,
            user: {
                id: 'test-user-id',
                email: 'test@example.com',
                role: UserRole.CONSUMER,
                mfaEnabled: true,
                mfaVerified: true,
                azureAccount: mockAuthResult.account!,
                lastLogin: Date.now()
            },
            tokens: {
                accessToken: 'test-token',
                refreshToken: 'test-refresh',
                idToken: 'test-id-token',
                expiresIn: Date.now() + 3600000,
                tokenType: 'Bearer',
                scope: ['user.read']
            },
            lastActivity: Date.now() - 1800000, // 30 minutes ago
            sessionExpiry: Date.now() + 1800000
        };

        (authService as any).authState$.next(mockAuthState);

        // Advance timers to trigger session timeout
        jest.advanceTimersByTime(1800000);

        const authState = await new Promise<IAuthState>(resolve => {
            authService.getAuthState().subscribe(state => resolve(state));
        });

        expect(authState.isAuthenticated).toBe(false);
        expect(authState.status).toBe(AuthStatus.UNAUTHENTICATED);

        jest.useRealTimers();
    });

    test('should handle token refresh', async () => {
        jest.useFakeTimers();

        // Mock successful token refresh
        mockMsalInstance.acquireTokenSilent.mockResolvedValueOnce(mockAuthResult);

        // Set up state requiring refresh
        const mockAuthState: IAuthState = {
            isAuthenticated: true,
            status: AuthStatus.AUTHENTICATED,
            user: {
                id: 'test-user-id',
                email: 'test@example.com',
                role: UserRole.CONSUMER,
                mfaEnabled: true,
                mfaVerified: true,
                azureAccount: mockAuthResult.account!,
                lastLogin: Date.now()
            },
            tokens: {
                accessToken: 'old-token',
                refreshToken: 'old-refresh',
                idToken: 'old-id-token',
                expiresIn: Date.now() + 300000, // 5 minutes
                tokenType: 'Bearer',
                scope: ['user.read']
            },
            lastActivity: Date.now(),
            sessionExpiry: Date.now() + 3600000
        };

        (authService as any).authState$.next(mockAuthState);

        // Trigger token refresh
        jest.advanceTimersByTime(300000);

        expect(mockMsalInstance.acquireTokenSilent).toHaveBeenCalled();

        const authState = await new Promise<IAuthState>(resolve => {
            authService.getAuthState().subscribe(state => resolve(state));
        });

        expect(authState.tokens?.accessToken).toBe(mockAuthResult.accessToken);

        jest.useRealTimers();
    });
});