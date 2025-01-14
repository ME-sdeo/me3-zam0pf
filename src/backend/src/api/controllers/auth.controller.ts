/**
 * @file Authentication controller implementing HIPAA-compliant Azure AD B2C integration
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express'; // version: 4.18.x
import rateLimit from 'express-rate-limit'; // version: 6.x
import winston from 'winston'; // version: 3.x
import { AuthService } from '../../services/auth.service';
import { 
  validateLoginRequest, 
  validateMFASetup, 
  validateMFAVerification,
  LoginRequestDTO,
  MFASetupDTO,
  MFAVerificationDTO
} from '../validators/auth.validator';
import { ErrorCode, ERROR_MESSAGES, getHttpStatusCode } from '../../constants/error.constants';
import { IAuthRequest } from '../../interfaces/auth.interface';

// Route prefix for authentication endpoints
const ROUTE_PREFIX = '/api/v1/auth';

/**
 * HIPAA-compliant authentication controller implementing secure user authentication
 * with Azure AD B2C integration, MFA, and enhanced security features
 */
export class AuthController {
  private router: Router;
  private authService: AuthService;
  private logger: winston.Logger;

  constructor(authService: AuthService) {
    this.router = Router();
    this.authService = authService;
    this.setupLogger();
    this.initializeRoutes();
  }

  /**
   * Initializes Winston logger with HIPAA-compliant configuration
   */
  private setupLogger(): void {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      defaultMeta: { service: 'auth-controller' },
      transports: [
        new winston.transports.File({ 
          filename: 'auth-audit.log',
          level: 'info'
        })
      ]
    });
  }

  /**
   * Initializes authentication routes with security middleware
   */
  private initializeRoutes(): void {
    // Configure rate limiting
    const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per window
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false
    });

    const mfaLimiter = rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 3, // 3 attempts per window
      standardHeaders: true,
      legacyHeaders: false
    });

    // Register routes with security middleware
    this.router.post(`${ROUTE_PREFIX}/login`, loginLimiter, this.login.bind(this));
    this.router.post(`${ROUTE_PREFIX}/refresh`, this.refreshToken.bind(this));
    this.router.post(`${ROUTE_PREFIX}/mfa/setup`, mfaLimiter, this.setupMFA.bind(this));
    this.router.post(`${ROUTE_PREFIX}/mfa/verify`, mfaLimiter, this.verifyMFA.bind(this));
    this.router.post(`${ROUTE_PREFIX}/logout`, this.logout.bind(this));
  }

  /**
   * Handles user login with enhanced security validation
   * @param req Express request object
   * @param res Express response object
   */
  private async login(req: Request, res: Response): Promise<void> {
    try {
      const loginData = req.body as LoginRequestDTO;
      
      // Validate login request with enhanced security checks
      const validationResult = await validateLoginRequest(loginData);
      if (!validationResult.isValid) {
        this.logger.warn('Login validation failed', {
          errors: validationResult.errors,
          securityContext: validationResult.securityContext
        });
        res.status(400).json({ 
          error: ERROR_MESSAGES[ErrorCode.AUTH_001],
          details: validationResult.errors
        });
        return;
      }

      // Validate device fingerprint
      const deviceValid = await this.authService.validateDeviceFingerprint(
        loginData.deviceFingerprint,
        req.ip
      );
      if (!deviceValid) {
        this.logger.warn('Device validation failed', { 
          deviceFingerprint: loginData.deviceFingerprint,
          ip: req.ip
        });
        res.status(401).json({ error: ERROR_MESSAGES[ErrorCode.AUTH_001] });
        return;
      }

      // Authenticate user
      const authResult = await this.authService.authenticateUser(
        loginData.email,
        loginData.password,
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || '',
          deviceFingerprint: loginData.deviceFingerprint,
          location: loginData.loginLocation
        }
      );

      this.logger.info('User authenticated successfully', {
        userId: authResult.user.id,
        securityContext: validationResult.securityContext
      });

      res.status(200).json(authResult);
    } catch (error) {
      this.logger.error('Login error', { error, ip: req.ip });
      const statusCode = getHttpStatusCode(ErrorCode.AUTH_001);
      res.status(statusCode).json({ error: ERROR_MESSAGES[ErrorCode.AUTH_001] });
    }
  }

  /**
   * Handles token refresh with security validation
   * @param req Express request object
   * @param res Express response object
   */
  private async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token is required' });
        return;
      }

      const tokens = await this.authService.refreshTokens(refreshToken, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || ''
      });

      this.logger.info('Token refreshed successfully', { ip: req.ip });
      res.status(200).json(tokens);
    } catch (error) {
      this.logger.error('Token refresh error', { error, ip: req.ip });
      const statusCode = getHttpStatusCode(ErrorCode.AUTH_002);
      res.status(statusCode).json({ error: ERROR_MESSAGES[ErrorCode.AUTH_002] });
    }
  }

  /**
   * Handles MFA setup with enhanced security validation
   * @param req Express request object
   * @param res Express response object
   */
  private async setupMFA(req: Request, res: Response): Promise<void> {
    try {
      const setupData = req.body as MFASetupDTO;
      
      // Validate MFA setup request
      const validationResult = await validateMFASetup(setupData);
      if (!validationResult.isValid) {
        this.logger.warn('MFA setup validation failed', {
          errors: validationResult.errors
        });
        res.status(400).json({ 
          error: 'Invalid MFA setup request',
          details: validationResult.errors
        });
        return;
      }

      const mfaSetup = await this.authService.setupMFA(
        (req as IAuthRequest).user.id,
        setupData.method
      );

      this.logger.info('MFA setup completed', {
        userId: (req as IAuthRequest).user.id,
        method: setupData.method
      });

      res.status(200).json(mfaSetup);
    } catch (error) {
      this.logger.error('MFA setup error', { error, ip: req.ip });
      res.status(500).json({ error: 'MFA setup failed' });
    }
  }

  /**
   * Handles MFA verification with security validation
   * @param req Express request object
   * @param res Express response object
   */
  private async verifyMFA(req: Request, res: Response): Promise<void> {
    try {
      const verificationData = req.body as MFAVerificationDTO;
      
      // Validate MFA verification request
      const validationResult = await validateMFAVerification(verificationData);
      if (!validationResult.isValid) {
        this.logger.warn('MFA verification validation failed', {
          errors: validationResult.errors
        });
        res.status(400).json({ 
          error: 'Invalid MFA verification request',
          details: validationResult.errors
        });
        return;
      }

      const verified = await this.authService.verifyMFA(
        (req as IAuthRequest).user.id,
        verificationData.verificationCode
      );

      this.logger.info('MFA verification completed', {
        userId: (req as IAuthRequest).user.id,
        success: verified
      });

      res.status(verified ? 200 : 401).json({ verified });
    } catch (error) {
      this.logger.error('MFA verification error', { error, ip: req.ip });
      res.status(500).json({ error: 'MFA verification failed' });
    }
  }

  /**
   * Handles user logout with session cleanup
   * @param req Express request object
   * @param res Express response object
   */
  private async logout(req: IAuthRequest, res: Response): Promise<void> {
    try {
      await this.authService.logout(req.user.id, req.token);
      
      this.logger.info('User logged out successfully', {
        userId: req.user.id
      });
      
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      this.logger.error('Logout error', { error, ip: req.ip });
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  /**
   * Returns the configured router instance
   */
  public getRouter(): Router {
    return this.router;
  }
}

export default AuthController;