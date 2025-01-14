import { PublicClientApplication, AuthenticationResult, InteractionRequiredAuthError } from '@azure/msal-browser'; // @azure/msal-browser ^2.32.0
import { AuthError as MSALAuthError } from '@azure/msal-browser/error'; // @azure/msal-browser ^2.32.0
import { BehaviorSubject, Observable, timer, Subscription } from 'rxjs'; // rxjs ^7.8.0
import { createLogger, format, transports } from 'winston'; // winston ^3.8.0
import jwt from 'jsonwebtoken'; // jsonwebtoken ^9.0.0

import { 
    IAuthState, 
    IAuthUser, 
    IAuthTokens, 
    IMFAConfig, 
    ILoginCredentials 
} from '../interfaces/auth.interface';
import { 
    UserRole, 
    MFAMethod, 
    AuthStatus, 
    AuthError,
    AUTH_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    MFA_SESSION_KEY,
    AUTH_STATE_KEY,
    MFAChallengeResponse,
    MFAVerificationPayload,
    ExtendedAccountInfo
} from '../types/auth.types';

// Constants for authentication configuration
const AUTH_STORAGE_KEY = 'auth_state';
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_LOGIN_ATTEMPTS = 3;
const MFA_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Core authentication service implementing secure authentication flows
 * Handles HIPAA/GDPR compliant authentication, MFA, and session management
 */
export class AuthService {
    private readonly authState$ = new BehaviorSubject<IAuthState>({
        isAuthenticated: false,
        status: AuthStatus.UNAUTHENTICATED,
        user: null,
        tokens: null,
        lastActivity: 0,
        sessionExpiry: 0
    });

    private readonly logger = createLogger({
        format: format.combine(
            format.timestamp(),
            format.json()
        ),
        transports: [
            new transports.File({ filename: 'security-audit.log' })
        ]
    });

    private refreshTokenSubscription?: Subscription;
    private sessionMonitorSubscription?: Subscription;
    private loginAttempts: Map<string, number> = new Map();

    constructor(
        private readonly msalClient: PublicClientApplication,
        private readonly config: {
            b2cTenantName: string;
            clientId: string;
            apiScopes: string[];
        }
    ) {
        this.initializeService();
    }

    /**
     * Initialize the authentication service and restore any existing session
     */
    private async initializeService(): Promise<void> {
        try {
            await this.restoreAuthState();
            this.startSessionMonitoring();
            this.startTokenRefreshTimer();
        } catch (error) {
            await this.logSecurityEvent({
                eventType: 'SERVICE_INITIALIZATION_ERROR',
                error
            });
        }
    }

    /**
     * Authenticate user with Azure AD B2C
     * @param credentials User login credentials
     */
    public async login(credentials: ILoginCredentials): Promise<void> {
        try {
            const attempts = this.loginAttempts.get(credentials.email) || 0;
            if (attempts >= MAX_LOGIN_ATTEMPTS) {
                await this.handleAccountLockout(credentials.email);
                throw new Error(AuthError.ACCOUNT_LOCKED);
            }

            const result = await this.msalClient.loginPopup({
                scopes: this.config.apiScopes,
                prompt: 'select_account'
            });

            await this.handleAuthenticationResult(result);
            this.loginAttempts.delete(credentials.email);
        } catch (error) {
            await this.handleAuthError(error as MSALAuthError, credentials.email);
        }
    }

    /**
     * Handle MFA challenge verification
     * @param verificationPayload MFA verification details
     */
    public async verifyMFAChallenge(verificationPayload: MFAVerificationPayload): Promise<boolean> {
        try {
            const currentState = this.authState$.value;
            if (currentState.status !== AuthStatus.MFA_REQUIRED) {
                throw new Error(AuthError.UNAUTHORIZED);
            }

            // Verify MFA challenge with Azure AD B2C
            const result = await this.msalClient.acquireTokenPopup({
                scopes: this.config.apiScopes,
                extraQueryParameters: {
                    mfaToken: verificationPayload.challengeId
                }
            });

            await this.handleAuthenticationResult(result);
            await this.logSecurityEvent({
                eventType: 'MFA_VERIFICATION_SUCCESS',
                userId: currentState.user?.id
            });

            return true;
        } catch (error) {
            await this.handleAuthError(error as MSALAuthError);
            return false;
        }
    }

    /**
     * Initiate MFA setup for a user
     * @param method MFA method to setup
     */
    public async setupMFA(method: MFAMethod): Promise<MFAChallengeResponse> {
        try {
            const currentState = this.authState$.value;
            if (!currentState.isAuthenticated) {
                throw new Error(AuthError.UNAUTHORIZED);
            }

            const response = await this.msalClient.acquireTokenSilent({
                scopes: ['https://myelixir.onmicrosoft.com/api/mfa.setup'],
                account: currentState.user?.azureAccount
            });

            const challenge: MFAChallengeResponse = {
                challengeId: response.uniqueId,
                method,
                expiresAt: Date.now() + MFA_TIMEOUT
            };

            await this.logSecurityEvent({
                eventType: 'MFA_SETUP_INITIATED',
                userId: currentState.user?.id,
                method
            });

            return challenge;
        } catch (error) {
            await this.handleAuthError(error as MSALAuthError);
            throw error;
        }
    }

    /**
     * Validate authentication tokens
     * @param tokens Authentication tokens to validate
     */
    private async validateTokens(tokens: IAuthTokens): Promise<boolean> {
        try {
            const decodedToken = jwt.decode(tokens.accessToken, { complete: true });
            if (!decodedToken) {
                throw new Error(AuthError.INVALID_CREDENTIALS);
            }

            // Verify token expiration
            const expirationTime = (decodedToken.payload as any).exp * 1000;
            if (Date.now() >= expirationTime) {
                throw new Error(AuthError.TOKEN_EXPIRED);
            }

            // Verify token issuer
            const issuer = `https://${this.config.b2cTenantName}.b2clogin.com/${this.config.b2cTenantName}.onmicrosoft.com/v2.0`;
            if ((decodedToken.payload as any).iss !== issuer) {
                throw new Error(AuthError.UNAUTHORIZED);
            }

            return true;
        } catch (error) {
            await this.logSecurityEvent({
                eventType: 'TOKEN_VALIDATION_FAILED',
                error
            });
            return false;
        }
    }

    /**
     * Monitor active session for security compliance
     */
    private startSessionMonitoring(): void {
        this.sessionMonitorSubscription?.unsubscribe();
        this.sessionMonitorSubscription = timer(0, 60000).subscribe(async () => {
            const currentState = this.authState$.value;
            if (!currentState.isAuthenticated) return;

            const inactivityTime = Date.now() - currentState.lastActivity;
            if (inactivityTime >= SESSION_TIMEOUT) {
                await this.handleSessionTimeout();
            }
        });
    }

    /**
     * Start token refresh timer
     */
    private startTokenRefreshTimer(): void {
        this.refreshTokenSubscription?.unsubscribe();
        this.refreshTokenSubscription = timer(0, TOKEN_REFRESH_INTERVAL).subscribe(async () => {
            const currentState = this.authState$.value;
            if (!currentState.isAuthenticated || !currentState.tokens) return;

            try {
                const result = await this.msalClient.acquireTokenSilent({
                    scopes: this.config.apiScopes,
                    account: currentState.user?.azureAccount
                });

                await this.handleAuthenticationResult(result);
            } catch (error) {
                await this.handleAuthError(error as MSALAuthError);
            }
        });
    }

    /**
     * Handle authentication result from Azure AD B2C
     * @param result Authentication result from MSAL
     */
    private async handleAuthenticationResult(result: AuthenticationResult): Promise<void> {
        const tokens: IAuthTokens = {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken || '',
            idToken: result.idToken,
            expiresIn: result.expiresOn?.getTime() || 0,
            tokenType: result.tokenType,
            scope: result.scopes
        };

        if (!(await this.validateTokens(tokens))) {
            throw new Error(AuthError.INVALID_CREDENTIALS);
        }

        const user: IAuthUser = {
            id: result.uniqueId,
            email: result.account?.username || '',
            role: UserRole.CONSUMER,
            mfaEnabled: true,
            mfaVerified: false,
            azureAccount: result.account!,
            lastLogin: Date.now()
        };

        this.updateAuthState({
            isAuthenticated: true,
            status: AuthStatus.AUTHENTICATED,
            user,
            tokens,
            lastActivity: Date.now(),
            sessionExpiry: Date.now() + SESSION_TIMEOUT
        });

        await this.logSecurityEvent({
            eventType: 'AUTHENTICATION_SUCCESS',
            userId: user.id
        });
    }

    /**
     * Handle authentication errors
     * @param error Authentication error
     * @param email User email for login attempts tracking
     */
    private async handleAuthError(error: MSALAuthError, email?: string): Promise<void> {
        await this.logSecurityEvent({
            eventType: 'AUTHENTICATION_ERROR',
            error: error.message,
            email
        });

        if (email) {
            const attempts = (this.loginAttempts.get(email) || 0) + 1;
            this.loginAttempts.set(email, attempts);
        }

        if (error instanceof InteractionRequiredAuthError) {
            this.updateAuthState({
                ...this.authState$.value,
                status: AuthStatus.TOKEN_EXPIRED
            });
        }

        throw error;
    }

    /**
     * Handle session timeout
     */
    private async handleSessionTimeout(): Promise<void> {
        await this.logSecurityEvent({
            eventType: 'SESSION_TIMEOUT',
            userId: this.authState$.value.user?.id
        });

        await this.logout();
    }

    /**
     * Handle account lockout
     * @param email User email
     */
    private async handleAccountLockout(email: string): Promise<void> {
        await this.logSecurityEvent({
            eventType: 'ACCOUNT_LOCKOUT',
            email
        });

        // Reset login attempts after lockout period
        setTimeout(() => {
            this.loginAttempts.delete(email);
        }, 30 * 60 * 1000); // 30 minutes lockout
    }

    /**
     * Update authentication state
     * @param newState New authentication state
     */
    private updateAuthState(newState: IAuthState): void {
        this.authState$.next(newState);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newState));
    }

    /**
     * Restore authentication state from storage
     */
    private async restoreAuthState(): Promise<void> {
        const storedState = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!storedState) return;

        const parsedState: IAuthState = JSON.parse(storedState);
        if (parsedState.tokens && await this.validateTokens(parsedState.tokens)) {
            this.updateAuthState(parsedState);
        } else {
            localStorage.removeItem(AUTH_STORAGE_KEY);
        }
    }

    /**
     * Log security event for audit purposes
     * @param event Security event details
     */
    private async logSecurityEvent(event: any): Promise<void> {
        this.logger.info('Security Event', {
            ...event,
            timestamp: new Date().toISOString(),
            sessionId: this.authState$.value.user?.id,
            userAgent: navigator.userAgent
        });
    }

    /**
     * Logout user and clear authentication state
     */
    public async logout(): Promise<void> {
        try {
            await this.msalClient.logout();
            this.refreshTokenSubscription?.unsubscribe();
            this.sessionMonitorSubscription?.unsubscribe();
            localStorage.removeItem(AUTH_STORAGE_KEY);
            
            this.updateAuthState({
                isAuthenticated: false,
                status: AuthStatus.UNAUTHENTICATED,
                user: null,
                tokens: null,
                lastActivity: 0,
                sessionExpiry: 0
            });

            await this.logSecurityEvent({
                eventType: 'LOGOUT_SUCCESS',
                userId: this.authState$.value.user?.id
            });
        } catch (error) {
            await this.logSecurityEvent({
                eventType: 'LOGOUT_ERROR',
                error
            });
        }
    }

    /**
     * Get current authentication state as observable
     */
    public getAuthState(): Observable<IAuthState> {
        return this.authState$.asObservable();
    }
}