import { Controller, Post, Put, Get, UseGuards, UseInterceptors, UseFilters } from '@nestjs/common';
import { Request, Response } from 'express';
import { CompanyService } from '../../services/company.service';
import { companyValidationSchemas } from '../validators/company.validator';
import { AuthGuard } from '../guards/auth.guard';
import { MonitoringInterceptor } from '../interceptors/monitoring.interceptor';
import { HttpExceptionFilter } from '../filters/http-exception.filter';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { AuditLog } from '../decorators/audit.decorator';
import { Logger } from 'winston';
import * as httpStatus from 'http-status'; // v1.6.0
import { ErrorCode, getErrorMessage } from '../constants/error.constants';
import {
  CompanyType,
  CompanyStatus,
  VerificationStatus,
  ICompany
} from '../interfaces/company.interface';

/**
 * Controller handling company-related HTTP requests with enhanced security and HIPAA compliance
 * Implements comprehensive validation, monitoring, and audit logging
 */
@Controller('companies')
@UseInterceptors(MonitoringInterceptor)
@UseFilters(HttpExceptionFilter)
@AuditLog()
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly logger: Logger
  ) {}

  /**
   * Register a new healthcare company with enhanced security validation
   * @param req Express request object
   * @param res Express response object
   */
  @Post('/register')
  @UseGuards(AuthGuard)
  @RateLimit({ max: 5, window: '15m' })
  async registerCompany(req: Request, res: Response): Promise<Response> {
    try {
      // Validate request body against enhanced registration schema
      const validationResult = await companyValidationSchemas.validateCompanyRegistration(req.body);
      if (!validationResult.isValid) {
        return res.status(httpStatus.BAD_REQUEST).json({
          error: getErrorMessage(ErrorCode.FHIR_001),
          details: validationResult.error
        });
      }

      // Create company with validated data
      const company = await this.companyService.createCompany(validationResult.data);

      this.logger.info('Company registered successfully', {
        companyId: company.id,
        type: company.type,
        timestamp: new Date().toISOString()
      });

      return res.status(httpStatus.CREATED).json(company);
    } catch (error) {
      this.logger.error('Company registration failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });

      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        error: getErrorMessage(ErrorCode.SYS_001)
      });
    }
  }

  /**
   * Update company profile with change tracking and validation
   * @param req Express request object
   * @param res Express response object
   */
  @Put('/:id')
  @UseGuards(AuthGuard)
  @RateLimit({ max: 10, window: '15m' })
  async updateCompanyProfile(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      // Validate update data
      const validationResult = await companyValidationSchemas.validateCompanyUpdate(req.body);
      if (!validationResult.isValid) {
        return res.status(httpStatus.BAD_REQUEST).json({
          error: getErrorMessage(ErrorCode.FHIR_001),
          details: validationResult.error
        });
      }

      // Update company profile
      const updatedCompany = await this.companyService.updateCompany(id, validationResult.data);

      this.logger.info('Company profile updated', {
        companyId: id,
        updatedFields: Object.keys(req.body),
        timestamp: new Date().toISOString()
      });

      return res.status(httpStatus.OK).json(updatedCompany);
    } catch (error) {
      this.logger.error('Company update failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });

      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        error: getErrorMessage(ErrorCode.SYS_001)
      });
    }
  }

  /**
   * Retrieve company profile by ID with security checks
   * @param req Express request object
   * @param res Express response object
   */
  @Get('/:id')
  @UseGuards(AuthGuard)
  @RateLimit({ max: 100, window: '15m' })
  async getCompanyProfile(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const company = await this.companyService.getCompanyById(id);

      this.logger.info('Company profile retrieved', {
        companyId: id,
        timestamp: new Date().toISOString()
      });

      return res.status(httpStatus.OK).json(company);
    } catch (error) {
      this.logger.error('Company retrieval failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });

      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        error: getErrorMessage(ErrorCode.SYS_001)
      });
    }
  }

  /**
   * Verify company credentials and update verification status
   * @param req Express request object
   * @param res Express response object
   */
  @Post('/:id/verify')
  @UseGuards(AuthGuard)
  @RateLimit({ max: 3, window: '1h' })
  async verifyCompany(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const verificationResult = await this.companyService.verifyCompany(id);

      this.logger.info('Company verification completed', {
        companyId: id,
        status: verificationResult.verificationStatus,
        timestamp: new Date().toISOString()
      });

      return res.status(httpStatus.OK).json(verificationResult);
    } catch (error) {
      this.logger.error('Company verification failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });

      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        error: getErrorMessage(ErrorCode.SYS_001)
      });
    }
  }

  /**
   * Update company status with audit logging
   * @param req Express request object
   * @param res Express response object
   */
  @Put('/:id/status')
  @UseGuards(AuthGuard)
  @RateLimit({ max: 10, window: '15m' })
  async updateCompanyStatus(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!Object.values(CompanyStatus).includes(status)) {
        return res.status(httpStatus.BAD_REQUEST).json({
          error: 'Invalid company status'
        });
      }

      const updatedCompany = await this.companyService.updateCompanyStatus(id, status);

      this.logger.info('Company status updated', {
        companyId: id,
        oldStatus: updatedCompany.status,
        newStatus: status,
        timestamp: new Date().toISOString()
      });

      return res.status(httpStatus.OK).json(updatedCompany);
    } catch (error) {
      this.logger.error('Company status update failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });

      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        error: getErrorMessage(ErrorCode.SYS_001)
      });
    }
  }
}