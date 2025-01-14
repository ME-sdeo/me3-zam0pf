/**
 * @file Notification controller implementing HIPAA-compliant notification delivery
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { injectable } from 'inversify';
import { CircuitBreaker } from 'circuit-breaker-ts';
import httpStatus from 'http-status';
import winston from 'winston';
import { NotificationService } from '../../services/notification.service';
import { IUser } from '../../interfaces/user.interface';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import { ErrorCode, getErrorMessage } from '../../constants/error.constants';

// Constants for rate limiting and circuit breaker
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds

@injectable()
export class NotificationController {
    private readonly circuitBreaker: CircuitBreaker;

    constructor(
        private readonly notificationService: NotificationService,
        private readonly logger: winston.Logger
    ) {
        // Initialize circuit breaker for notification service
        this.circuitBreaker = new CircuitBreaker({
            failureThreshold: CIRCUIT_BREAKER_THRESHOLD,
            resetTimeout: CIRCUIT_BREAKER_TIMEOUT
        });
    }

    /**
     * Sends notification to consumer about new data request
     * @param req Express request
     * @param res Express response
     */
    @authenticate
    @authorize(['COMPANY', 'ADMIN'])
    @validateRequest
    public async sendConsumerRequestNotification(
        req: Request,
        res: Response
    ): Promise<Response> {
        try {
            const correlationId = req.headers['x-correlation-id'] as string;
            if (!correlationId) {
                return res.status(httpStatus.BAD_REQUEST).json({
                    error: 'Missing correlation ID'
                });
            }

            const { userId, requestData } = req.body;

            // Validate request data
            if (!userId || !requestData) {
                return res.status(httpStatus.BAD_REQUEST).json({
                    error: 'Missing required notification data'
                });
            }

            // Send notification through circuit breaker
            await this.circuitBreaker.execute(async () => {
                await this.notificationService.sendConsumerRequestNotification(
                    userId as IUser,
                    {
                        requestId: requestData.requestId,
                        companyName: requestData.companyName,
                        dataType: requestData.dataType,
                        compensation: requestData.compensation
                    }
                );
            });

            // Log successful notification
            this.logger.info('Consumer request notification sent', {
                correlationId,
                userId,
                requestId: requestData.requestId,
                type: 'consumer-request'
            });

            return res.status(httpStatus.OK).json({
                message: 'Notification sent successfully',
                correlationId
            });

        } catch (error) {
            // Log error with security context
            this.logger.error('Failed to send consumer request notification', {
                error: error instanceof Error ? error.message : 'Unknown error',
                correlationId: req.headers['x-correlation-id'],
                userId: req.body.userId
            });

            if (error instanceof Error && error.message === getErrorMessage(ErrorCode.SYS_001)) {
                return res.status(httpStatus.SERVICE_UNAVAILABLE).json({
                    error: error.message
                });
            }

            return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to send notification'
            });
        }
    }

    /**
     * Sends notification about successful data sharing
     * @param req Express request
     * @param res Express response
     */
    @authenticate
    @authorize(['COMPANY', 'ADMIN'])
    @validateRequest
    public async sendDataSharedNotification(
        req: Request,
        res: Response
    ): Promise<Response> {
        try {
            const correlationId = req.headers['x-correlation-id'] as string;
            if (!correlationId) {
                return res.status(httpStatus.BAD_REQUEST).json({
                    error: 'Missing correlation ID'
                });
            }

            const { userId, sharingDetails } = req.body;

            // Validate sharing details
            if (!userId || !sharingDetails) {
                return res.status(httpStatus.BAD_REQUEST).json({
                    error: 'Missing required sharing details'
                });
            }

            // Send notification through circuit breaker
            await this.circuitBreaker.execute(async () => {
                await this.notificationService.sendDataSharedNotification(
                    userId as IUser,
                    {
                        requestId: sharingDetails.requestId,
                        companyName: sharingDetails.companyName,
                        dataType: sharingDetails.dataType,
                        compensation: sharingDetails.compensation
                    }
                );
            });

            // Log successful notification
            this.logger.info('Data shared notification sent', {
                correlationId,
                userId,
                requestId: sharingDetails.requestId,
                type: 'data-shared'
            });

            return res.status(httpStatus.OK).json({
                message: 'Notification sent successfully',
                correlationId
            });

        } catch (error) {
            // Log error with security context
            this.logger.error('Failed to send data shared notification', {
                error: error instanceof Error ? error.message : 'Unknown error',
                correlationId: req.headers['x-correlation-id'],
                userId: req.body.userId
            });

            if (error instanceof Error && error.message === getErrorMessage(ErrorCode.SYS_001)) {
                return res.status(httpStatus.SERVICE_UNAVAILABLE).json({
                    error: error.message
                });
            }

            return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to send notification'
            });
        }
    }

    /**
     * Sends notification to company about request fulfillment
     * @param req Express request
     * @param res Express response
     */
    @authenticate
    @authorize(['ADMIN'])
    @validateRequest
    public async sendCompanyRequestNotification(
        req: Request,
        res: Response
    ): Promise<Response> {
        try {
            const correlationId = req.headers['x-correlation-id'] as string;
            if (!correlationId) {
                return res.status(httpStatus.BAD_REQUEST).json({
                    error: 'Missing correlation ID'
                });
            }

            const { userId, requestDetails } = req.body;

            // Validate request details
            if (!userId || !requestDetails) {
                return res.status(httpStatus.BAD_REQUEST).json({
                    error: 'Missing required request details'
                });
            }

            // Send notification through circuit breaker
            await this.circuitBreaker.execute(async () => {
                await this.notificationService.sendCompanyRequestNotification(
                    userId as IUser,
                    {
                        requestId: requestDetails.requestId,
                        dataType: requestDetails.dataType,
                        recordCount: requestDetails.recordCount,
                        totalCost: requestDetails.totalCost
                    }
                );
            });

            // Log successful notification
            this.logger.info('Company request notification sent', {
                correlationId,
                userId,
                requestId: requestDetails.requestId,
                type: 'company-request'
            });

            return res.status(httpStatus.OK).json({
                message: 'Notification sent successfully',
                correlationId
            });

        } catch (error) {
            // Log error with security context
            this.logger.error('Failed to send company request notification', {
                error: error instanceof Error ? error.message : 'Unknown error',
                correlationId: req.headers['x-correlation-id'],
                userId: req.body.userId
            });

            if (error instanceof Error && error.message === getErrorMessage(ErrorCode.SYS_001)) {
                return res.status(httpStatus.SERVICE_UNAVAILABLE).json({
                    error: error.message
                });
            }

            return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to send notification'
            });
        }
    }
}