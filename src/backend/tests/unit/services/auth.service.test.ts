/**
 * @file Unit tests for AuthService implementing HIPAA-compliant authentication flows
 * @version 1.0.0
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals'; // version: ^29.0.0
import { ConfidentialClientApplication, AuthorizationCodeRequest } from '@azure/msal-node'; // version: 2.1.x
import speakeasy from 'speakeasy'; // version: 2.0.x
import winston from 'winston'; // version: 3.8.x
import { AuthService } from '../../../src/services/auth.service';
import { IAuthUser, UserRole, MFAMethod } from '../../../src/interfaces/auth.interface';
import { authConfig } from '../../../src/config/auth.config';

// Mock external dependencies
jest.mock('@azure/msal-node');
jest.mock('speakeasy');
jest.mock('winston');
jest.mock('../../../src/config/auth.config');

describe('AuthService', () => {
  let authService: AuthService;
  let mockMsalClient: jest.Mocked<ConfidentialClientApplication>;
  let mockLogger: jest.Mocked<winston.Logger>;

  // Test data
  const testAuthContext = {
    ipAddress: '192.168.1.1',
    userAgent: 'test-agent',
    geoLocation: {
      country: 'US',
      region: 'CA'
    },
    deviceId: 'test-device-123',
    riskLevel: 'low' as const
  };

  const testUser: IAuthUser = {
    id: 'test-user-123',
    email: 'test@example.com',
    role: UserRole.CONSUMER,
    mfaEnabled: true,
    mfaMethod: MFAMethod.AUTHENTICATOR,
    permissions: ['read:health-records'],
    lastActivity: new Date()
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize mock MSAL client
    mockMsalClient = {
      acquireTokenByCode: jest.fn(),
      getTokenCache: jest.fn(),
    } as unknown as jest.Mocked<ConfidentialClientApplication>;

    // Initialize mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<winston.Logger>;

    // Initialize AuthService with mocks
    authService = new AuthService();
    (authService as any).msalClient = mockMsalClient;
    (authService as any).auditLogger = mockLogger;
  });

  afterEach(() => {
    // Clear token and MFA caches
    (authService as any).tokenCache.clear();
    (authService as any).mfaCache.clear();
  });

  describe('authenticateUser', () => {
    const testCode = 'test-auth-code';
    const testTokens = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      idToken: 'test-id-token',
      uniqueId: testUser.id,
      account: {
        username: testUser.email
      }
    };

    it('should authenticate user with valid credentials and return tokens', async () => {
      // Arrange
      mockMsalClient.acquireTokenByCode.mockResolvedValue(testTokens);

      // Act
      const result = await authService.authenticateUser(testCode, testAuthContext);

      // Assert
      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Data encryption performed',
        expect.any(Object)
      );
    });

    it('should handle invalid credentials and throw AuthError', async () => {
      // Arrange
      mockMsalClient.acquireTokenByCode.mockRejectedValue(new Error('Invalid code'));

      // Act & Assert
      await expect(
        authService.authenticateUser(testCode, testAuthContext)
      ).rejects.toThrow('Authentication failed: Invalid credentials provided');
    });

    it('should validate token claims for HIPAA compliance', async () => {
      // Arrange
      mockMsalClient.acquireTokenByCode.mockResolvedValue(testTokens);

      // Act
      const result = await authService.authenticateUser(testCode, testAuthContext);

      // Assert
      expect(result.scope).toContain('fhir-api');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('HIPAA compliance validated'),
        expect.any(Object)
      );
    });
  });

  describe('setupMFA', () => {
    const testUserId = 'test-user-123';
    const testSecret = {
      base32: 'test-secret-base32',
      otpauth_url: 'otpauth://totp/test'
    };

    it('should generate and store TOTP secret securely', async () => {
      // Arrange
      (speakeasy.generateSecret as jest.Mock).mockReturnValue(testSecret);

      // Act
      const result = await authService.setupMFA(testUserId, MFAMethod.AUTHENTICATOR);

      // Assert
      expect(result.secret).toBe(testSecret.base32);
      expect(result.qrCode).toBe(testSecret.otpauth_url);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'MFA setup completed',
        expect.any(Object)
      );
    });

    it('should handle unsupported MFA methods', async () => {
      // Act & Assert
      await expect(
        authService.setupMFA(testUserId, 'unsupported' as MFAMethod)
      ).rejects.toThrow('Unsupported MFA method');
    });
  });

  describe('validateMFACode', () => {
    const testUserId = 'test-user-123';
    const testCode = '123456';
    const testSecret = 'test-secret';

    beforeEach(() => {
      // Setup MFA cache
      (authService as any).mfaCache.set(testUserId, {
        secret: testSecret,
        attempts: 0
      });
    });

    it('should verify valid TOTP tokens', async () => {
      // Arrange
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      // Act
      const result = await authService.validateMFACode(testUserId, testCode);

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'MFA verification successful',
        expect.any(Object)
      );
    });

    it('should enforce attempt limits', async () => {
      // Arrange
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);
      const maxAttempts = authConfig.mfa.maxAttempts;

      // Act & Assert
      for (let i = 0; i < maxAttempts; i++) {
        await authService.validateMFACode(testUserId, testCode);
      }

      await expect(
        authService.validateMFACode(testUserId, testCode)
      ).rejects.toThrow('Maximum MFA attempts exceeded');
    });
  });

  describe('validateAccessToken', () => {
    const testToken = 'test-access-token';
    const testDecodedToken = {
      sub: testUser.id,
      email: testUser.email,
      role: testUser.role,
      mfaEnabled: true
    };

    it('should validate token signatures and claims', async () => {
      // Arrange
      (authService as any).tokenCache.set(testToken, {
        accessToken: testToken,
        refreshToken: 'test-refresh'
      });

      // Act
      const result = await authService.validateAccessToken(testToken);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(testUser.id);
      expect(result.role).toBe(testUser.role);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Token validation successful',
        expect.any(Object)
      );
    });

    it('should handle expired tokens', async () => {
      // Act & Assert
      await expect(
        authService.validateAccessToken('expired-token')
      ).rejects.toThrow('Authentication failed: Security token has expired');
    });
  });

  describe('validateRole', () => {
    it('should validate user roles and permissions correctly', async () => {
      // Arrange
      const requiredRole = UserRole.CONSUMER;
      const requiredPermissions = ['read:health-records'];

      // Act
      const result = await authService.validateRole(testUser, requiredRole, requiredPermissions);

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Role validation successful',
        expect.any(Object)
      );
    });

    it('should reject insufficient permissions', async () => {
      // Arrange
      const requiredRole = UserRole.ADMIN;
      const requiredPermissions = ['admin:all'];

      // Act & Assert
      await expect(
        authService.validateRole(testUser, requiredRole, requiredPermissions)
      ).rejects.toThrow('Insufficient permissions');
    });
  });
});