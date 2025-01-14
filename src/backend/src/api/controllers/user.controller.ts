import { Request, Response } from 'express'; // version: 4.18.x
import asyncHandler from 'express-async-handler'; // version: ^1.2.0
import rateLimit from 'express-rate-limit'; // version: ^6.7.0
import winston from 'winston'; // version: ^3.8.0
import { v4 as uuidv4 } from 'uuid'; // version: ^9.0.0

import { UserService } from '../../services/user.service';
import { validateRequest } from '../middlewares/validation.middleware';
import { UserRole, UserStatus } from '../../interfaces/user.interface';
import { AuthenticationError } from '../../utils/error.util';
import { logger, createLogMetadata } from '../../utils/logger.util';
import { USER_VALIDATION } from '../../constants/validation.constants';

// Rate limiting configuration for user operations
const createUserLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // 5 requests per window
  message: 'Too many user creation attempts, please try again later'
});

const updateUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 10 // 10 requests per window
});

/**
 * Controller implementing HIPAA-compliant user management operations
 */
export class UserController {
  private userService: UserService;

  constructor(userService: UserService) {
    this.userService = userService;
  }

  /**
   * Creates a new user with HIPAA compliance and security controls
   */
  public createUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const correlationId = uuidv4();
    const ipAddress = req.ip;

    try {
      // Validate request payload
      await validateRequest(req.body, USER_VALIDATION);

      // Create user with security context
      const user = await this.userService.createUser(req.body, {
        ipAddress,
        correlationId
      });

      // Log successful user creation
      logger.info('User created successfully', createLogMetadata({
        action: 'user.create',
        userId: user.id,
        userRole: user.role,
        correlationId,
        ipAddress
      }));

      // Return success response with security headers
      res.status(201)
        .set({
          'X-Correlation-ID': correlationId,
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY'
        })
        .json({
          success: true,
          data: {
            id: user.id,
            email: user.email,
            role: user.role,
            status: user.status
          }
        });
    } catch (error) {
      throw new AuthenticationError(
        'AUTH_001',
        { email: req.body.email },
        correlationId
      );
    }
  });

  /**
   * Retrieves user details with security validation
   */
  public getUserById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const correlationId = uuidv4();
    const { userId } = req.params;

    const user = await this.userService.getUserById(userId, {
      ipAddress: req.ip,
      userRole: req.user.role,
      correlationId
    });

    // Log user retrieval
    logger.info('User retrieved successfully', createLogMetadata({
      action: 'user.read',
      userId,
      accessorId: req.user.id,
      correlationId
    }));

    res.status(200)
      .set({
        'X-Correlation-ID': correlationId,
        'Cache-Control': 'no-store'
      })
      .json({
        success: true,
        data: user
      });
  });

  /**
   * Updates user profile with HIPAA compliance checks
   */
  public updateUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const correlationId = uuidv4();
    const { userId } = req.params;

    const updatedUser = await this.userService.updateUser(
      userId,
      req.body,
      {
        ipAddress: req.ip,
        userRole: req.user.role,
        correlationId
      }
    );

    // Log user update
    logger.info('User updated successfully', createLogMetadata({
      action: 'user.update',
      userId,
      updaterId: req.user.id,
      correlationId
    }));

    res.status(200)
      .set({
        'X-Correlation-ID': correlationId,
        'Cache-Control': 'no-store'
      })
      .json({
        success: true,
        data: updatedUser
      });
  });

  /**
   * Enables MFA for user with enhanced security
   */
  public enableMFA = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const correlationId = uuidv4();
    const { userId, mfaMethod } = req.body;

    const mfaConfig = await this.userService.enableMFA(userId, mfaMethod, {
      ipAddress: req.ip,
      correlationId
    });

    // Log MFA enablement
    logger.info('MFA enabled successfully', createLogMetadata({
      action: 'user.mfa.enable',
      userId,
      mfaMethod,
      correlationId
    }));

    res.status(200)
      .set({
        'X-Correlation-ID': correlationId,
        'Cache-Control': 'no-store'
      })
      .json({
        success: true,
        data: mfaConfig
      });
  });

  /**
   * Verifies user access with security controls
   */
  public verifyAccess = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const correlationId = uuidv4();
    const { userId, resourceId } = req.params;

    const accessVerified = await this.userService.verifyUserAccess(
      userId,
      resourceId,
      {
        ipAddress: req.ip,
        userRole: req.user.role,
        correlationId
      }
    );

    // Log access verification
    logger.info('Access verification completed', createLogMetadata({
      action: 'user.access.verify',
      userId,
      resourceId,
      result: accessVerified,
      correlationId
    }));

    res.status(200)
      .set({
        'X-Correlation-ID': correlationId,
        'Cache-Control': 'no-store'
      })
      .json({
        success: true,
        data: { hasAccess: accessVerified }
      });
  });
}

// Export controller instance
export default new UserController(new UserService());