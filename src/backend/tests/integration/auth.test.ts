/**
 * @file Integration tests for authentication endpoints with HIPAA compliance
 * @version 1.0.0
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals'; // version: 29.x
import request from 'supertest'; // version: 6.3.x
import { MockMSALClient } from '@azure/msal-node-mock'; // version: 1.0.x
import { TestUtils } from '@hipaa-test-utils'; // version: 2.0.x
import { SecurityService } from '@security-utils'; // version: 1.0.x
import { AuthService } from '../../src/services/auth.service';
import { UserRole, MFAMethod } from '../../src/interfaces/auth.interface';
import { ErrorCode, ERROR_MESSAGES } from '../../src/constants/error.constants';
import { authConfig } from '../../src/config/auth.config';

describe('Authentication Integration Tests', () => {
  let authService: AuthService;
  let mockMsalClient: MockMSALClient;
  let testUtils: TestUtils;
  let securityService: SecurityService;
  let testUser: any;
  let testCompany: any;

  beforeAll(async () => {
    // Initialize test dependencies
    mockMsalClient = new MockMSALClient({
      auth: {
        clientId: authConfig.azureADB2C.clientId,
        authority: `https://${authConfig.azureADB2C.tenantName}.b2clogin.com/`
      }
    });

    authService = new AuthService();
    testUtils = new TestUtils();
    securityService = new SecurityService();

    // Setup test data
    testUser = await testUtils.createTestUser({
      role: UserRole.CONSUMER,
      mfaEnabled: true,
      mfaMethod: MFAMethod.AUTHENTICATOR
    });

    testCompany = await testUtils.createTestUser({
      role: UserRole.COMPANY,
      mfaEnabled: true,
      mfaMethod: MFAMethod.AUTHENTICATOR
    });
  });

  afterAll(async () => {
    await testUtils.cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Azure AD B2C Authentication Flow', () => {
    test('should successfully authenticate user with valid credentials', async () => {
      // Setup mock auth code
      const mockAuthCode = await mockMsalClient.getAuthCode();
      const mockContext = {
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
        geoLocation: { country: 'US', region: 'CA' }
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          code: mockAuthCode,
          context: mockContext
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('idToken');

      // Verify HIPAA compliance
      const hipaaCompliance = await testUtils.verifyHIPAACompliance(response.body);
      expect(hipaaCompliance.isCompliant).toBe(true);
    });

    test('should enforce rate limiting on authentication attempts', async () => {
      const mockContext = {
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent'
      };

      // Attempt multiple rapid authentications
      for (let i = 0; i < authConfig.security.rateLimit.max + 1; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            code: 'invalid-code',
            context: mockContext
          });
      }

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          code: 'valid-code',
          context: mockContext
        });

      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Too many requests');
    });
  });

  describe('Multi-Factor Authentication', () => {
    test('should successfully setup MFA for user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/mfa/setup')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          method: MFAMethod.AUTHENTICATOR
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('secret');
      expect(response.body).toHaveProperty('qrCode');

      // Verify secure transmission
      const securityCheck = await securityService.verifySecureTransmission(response);
      expect(securityCheck.isSecure).toBe(true);
    });

    test('should validate MFA code correctly', async () => {
      // Generate valid TOTP code
      const validCode = await testUtils.generateTOTPCode(testUser.mfaSecret);

      const response = await request(app)
        .post('/api/v1/auth/mfa/verify')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          code: validCode
        });

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(true);
    });

    test('should block access after maximum MFA attempts', async () => {
      const invalidCode = '000000';
      
      // Attempt multiple invalid MFA verifications
      for (let i = 0; i < authConfig.mfa.maxAttempts; i++) {
        await request(app)
          .post('/api/v1/auth/mfa/verify')
          .set('Authorization', `Bearer ${testUser.accessToken}`)
          .send({
            code: invalidCode
          });
      }

      const response = await request(app)
        .post('/api/v1/auth/mfa/verify')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          code: invalidCode
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe(ERROR_MESSAGES[ErrorCode.AUTH_001]);
    });
  });

  describe('Token Management', () => {
    test('should successfully refresh tokens', async () => {
      const response = await request(app)
        .post('/api/v1/auth/token/refresh')
        .send({
          refreshToken: testUser.refreshToken
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');

      // Verify token rotation
      const tokenCheck = await securityService.verifyTokenRotation(
        testUser.refreshToken,
        response.body.refreshToken
      );
      expect(tokenCheck.isRotated).toBe(true);
    });

    test('should invalidate all sessions on security risk', async () => {
      // Simulate security risk
      await securityService.simulateSecurityRisk(testUser.id);

      const response = await request(app)
        .post('/api/v1/auth/token/refresh')
        .send({
          refreshToken: testUser.refreshToken
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe(ERROR_MESSAGES[ErrorCode.AUTH_002]);
    });
  });

  describe('Authorization Controls', () => {
    test('should enforce role-based access control', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe(ERROR_MESSAGES[ErrorCode.AUTH_001]);
    });

    test('should validate IP restrictions', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '10.0.0.1') // Blocked IP
        .send({
          code: 'valid-code',
          context: {
            ipAddress: '10.0.0.1',
            userAgent: 'test-agent'
          }
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe(ERROR_MESSAGES[ErrorCode.AUTH_001]);
    });
  });

  describe('Audit Logging', () => {
    test('should maintain comprehensive audit logs', async () => {
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          code: await mockMsalClient.getAuthCode(),
          context: {
            ipAddress: '192.168.1.1',
            userAgent: 'test-agent'
          }
        });

      const auditLogs = await testUtils.getAuditLogs(loginResponse.body.accessToken);
      
      expect(auditLogs).toContainEqual(expect.objectContaining({
        action: 'user.login',
        status: 'success',
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent'
      }));
    });
  });
});