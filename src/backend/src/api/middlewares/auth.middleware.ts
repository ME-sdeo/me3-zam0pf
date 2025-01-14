/**
 * @file Authentication and authorization middleware for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Implements HIPAA-compliant security controls with Azure AD B2C integration
 */

import { Request, Response, NextFunction, RequestHandler } from 'express'; // version: 4.18.x
import jwt from 'jsonwebtoken'; // version: 9.0.x
import { RateLimiterMemory } from 'rate-limiter-flexible'; // version: 2.4.x
import { AuthService } from '../../services/auth.service';
import { IAuthRequest } from '../../interfaces/auth.interface';
import { authConfig } from '../../config/auth.config';
import { ErrorCode, ERROR_MESSAGES } from '../../constants/error.constants';
import { UserRole } from '../../interfaces/user.interface';

// Constants for authentication headers and settings
const TOKEN_HEADER = 'Authorization';
const TOKEN_PREFIX = 'Bearer';
const MFA_HEADER = 'X-MFA-Token';
const BACKUP_CODE_HEADER = 'X-Backup-Code';
const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60; // 15 minutes
const RATE_LIMIT_MAX = 100;

// Initialize rate limiter for login attempts
const loginRateLimiter = new RateLimiterMemory({
  points: RATE_LIMIT_MAX,
  duration: RATE_LIMIT_WINDOW,
});

// Initialize AuthService
const authService = new AuthService();

/**
 * Enhanced Express middleware for JWT authentication with MFA support
 * Implements HIPAA-compliant security controls and audit logging
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Rate limiting check
    try {
      await loginRateLimiter.consume(req.ip);
    } catch (error) {
      res.status(429).json({ 
        error: 'Too many authentication attempts. Please try again later.' 
      });
      return;
    }

    // Extract token from Authorization header
    const authHeader = req.headers[TOKEN_HEADER.toLowerCase()];
    if (!authHeader || typeof authHeader !== 'string') {
      throw new Error(ERROR_MESSAGES[ErrorCode.AUTH_001]);
    }

    // Validate token format
    const [prefix, token] = authHeader.split(' ');
    if (prefix !== TOKEN_PREFIX || !token) {
      throw new Error(ERROR_MESSAGES[ErrorCode.AUTH_001]);
    }

    // Validate token and extract user information
    const user = await authService.validateAccessToken(token);

    // Validate HIPAA compliance requirements
    if (!user.mfaEnabled && authConfig.mfa.required) {
      throw new Error('MFA is required for HIPAA compliance');
    }

    // Create enhanced request object with auth context
    const authRequest = req as IAuthRequest;
    authRequest.user = user;
    authRequest.token = token;
    authRequest.sessionId = jwt.decode(token)?.['sessionId'] as string;
    authRequest.ipAddress = req.ip;
    authRequest.userAgent = req.headers['user-agent'];

    // Log security event
    await authService.logSecurityEvent({
      userId: user.id,
      eventType: 'authentication',
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date()
    });

    next();
  } catch (error) {
    res.status(401).json({ 
      error: error.message || ERROR_MESSAGES[ErrorCode.AUTH_001]
    });
  }
};

/**
 * Enhanced middleware for granular role-based access control
 * Implements detailed permission validation and audit logging
 */
export const authorize = (
  allowedRoles: UserRole[],
  requiredPermissions: string[] = []
): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authRequest = req as IAuthRequest;
      
      // Validate user authentication
      if (!authRequest.user) {
        throw new Error(ERROR_MESSAGES[ErrorCode.AUTH_001]);
      }

      // Check user role
      if (!allowedRoles.includes(authRequest.user.role)) {
        throw new Error(ERROR_MESSAGES[ErrorCode.AUTH_002]);
      }

      // Validate granular permissions
      if (requiredPermissions.length > 0) {
        const hasAllPermissions = requiredPermissions.every(
          permission => authRequest.user.permissions.includes(permission)
        );
        if (!hasAllPermissions) {
          throw new Error(ERROR_MESSAGES[ErrorCode.AUTH_002]);
        }
      }

      // Log authorization event
      await authService.logSecurityEvent({
        userId: authRequest.user.id,
        eventType: 'authorization',
        status: 'success',
        resource: req.path,
        action: req.method,
        timestamp: new Date()
      });

      next();
    } catch (error) {
      res.status(403).json({ 
        error: error.message || ERROR_MESSAGES[ErrorCode.AUTH_002]
      });
    }
  };
};

/**
 * Enhanced MFA verification middleware with multiple authentication methods
 * Implements progressive security controls and backup authentication
 */
export const verifyMFA = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authRequest = req as IAuthRequest;
    
    // Validate user context
    if (!authRequest.user) {
      throw new Error(ERROR_MESSAGES[ErrorCode.AUTH_001]);
    }

    // Extract MFA token or backup code
    const mfaToken = req.headers[MFA_HEADER.toLowerCase()];
    const backupCode = req.headers[BACKUP_CODE_HEADER.toLowerCase()];

    if (!mfaToken && !backupCode) {
      throw new Error('MFA verification required');
    }

    let mfaVerified = false;

    // Try primary MFA method
    if (mfaToken) {
      mfaVerified = await authService.verifyMFA(
        authRequest.user.id,
        mfaToken as string
      );
    }

    // Try backup code if primary MFA fails
    if (!mfaVerified && backupCode) {
      mfaVerified = await authService.verifyBackupCode(
        authRequest.user.id,
        backupCode as string
      );
    }

    if (!mfaVerified) {
      throw new Error('MFA verification failed');
    }

    // Update request context with MFA verification
    authRequest.mfaVerified = true;

    // Log MFA verification
    await authService.logSecurityEvent({
      userId: authRequest.user.id,
      eventType: 'mfa_verification',
      status: 'success',
      method: mfaToken ? 'totp' : 'backup_code',
      timestamp: new Date()
    });

    next();
  } catch (error) {
    res.status(401).json({ 
      error: error.message || 'MFA verification failed'
    });
  }
};

/**
 * Enhanced token refresh middleware with session management
 * Implements secure token rotation and validation
 */
export const refreshTokenMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const refreshToken = req.body.refreshToken;
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    // Validate and refresh tokens
    const newTokens = await authService.refreshToken(refreshToken);

    // Update response with new tokens
    res.locals.tokens = newTokens;

    // Log token refresh
    await authService.logSecurityEvent({
      userId: jwt.decode(newTokens.accessToken)?.['sub'] as string,
      eventType: 'token_refresh',
      status: 'success',
      timestamp: new Date()
    });

    next();
  } catch (error) {
    res.status(401).json({ 
      error: error.message || ERROR_MESSAGES[ErrorCode.AUTH_002]
    });
  }
};