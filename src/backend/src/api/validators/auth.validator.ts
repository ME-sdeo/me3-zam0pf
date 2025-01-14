// @ts-check

import { 
  validate,
  ValidationError,
  IsEmail,
  IsString,
  MinLength,
  Matches,
  IsLatLong,
  MaxLength,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max
} from 'class-validator'; // version: ^0.14.0

import { IAuthUser, MFAMethod } from '../../interfaces/auth.interface';
import { 
  USER_VALIDATION,
  EMAIL_VALIDATION,
  PHONE_VALIDATION 
} from '../../constants/validation.constants';

/**
 * Geographic location interface for location-based validation
 */
interface GeoLocation {
  latitude: number;
  longitude: number;
}

/**
 * Rate limiting information interface
 */
interface RateLimitInfo {
  attempts: number;
  windowStart: number;
  remainingAttempts: number;
}

/**
 * Security context for enhanced validation results
 */
interface SecurityContext {
  deviceVerified: boolean;
  locationVerified: boolean;
  riskScore: number;
  securityFlags: string[];
}

/**
 * Comprehensive validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  securityContext?: SecurityContext;
  rateLimitInfo?: RateLimitInfo;
  locationCheck?: {
    allowed: boolean;
    riskLevel: string;
  };
}

/**
 * Enhanced DTO for login request validation with HIPAA compliance
 */
export class LoginRequestDTO {
  @IsEmail({}, { message: 'Invalid email format' })
  @MaxLength(EMAIL_VALIDATION.MAX_LENGTH)
  email: string;

  @IsString()
  @MinLength(USER_VALIDATION.PASSWORD_MIN_LENGTH)
  @Matches(USER_VALIDATION.PASSWORD_PATTERN, {
    message: 'Password must contain uppercase, lowercase, number and special character'
  })
  password: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9\-_]{32,64}$/, {
    message: 'Invalid device fingerprint format'
  })
  deviceFingerprint: string;

  @IsLatLong()
  loginLocation: GeoLocation;
}

/**
 * Enhanced DTO for MFA setup with advanced security
 */
export class MFASetupDTO {
  @IsEnum(MFAMethod)
  method: MFAMethod;

  @IsOptional()
  @IsString()
  @Matches(PHONE_VALIDATION.PHONE_PATTERN, {
    message: 'Phone number must be in E.164 format'
  })
  phoneNumber?: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9\-_]{32,64}$/)
  deviceFingerprint: string;

  @IsLatLong()
  setupLocation: GeoLocation;
}

/**
 * Enhanced DTO for MFA verification with security measures
 */
export class MFAVerificationDTO {
  @IsString()
  @Matches(/^[0-9]{6}$/, {
    message: 'Verification code must be 6 digits'
  })
  verificationCode: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9\-_]{32,64}$/)
  deviceFingerprint: string;

  @IsLatLong()
  verificationLocation: GeoLocation;

  @IsInt()
  @Min(0)
  @Max(5)
  attemptCount: number;
}

/**
 * Enhanced validation for login requests with HIPAA compliance
 */
export async function validateLoginRequest(
  loginData: LoginRequestDTO
): Promise<ValidationResult> {
  const errors = await validate(loginData);
  const securityContext: SecurityContext = {
    deviceVerified: false,
    locationVerified: false,
    riskScore: 0,
    securityFlags: []
  };

  // Perform enhanced security validations
  const deviceValid = validateDeviceFingerprint(loginData.deviceFingerprint);
  const locationValid = validateLoginLocation(loginData.loginLocation);
  const rateLimit = checkRateLimit(loginData.email);

  securityContext.deviceVerified = deviceValid;
  securityContext.locationVerified = locationValid;
  securityContext.riskScore = calculateRiskScore(loginData, deviceValid, locationValid);

  return {
    isValid: errors.length === 0 && deviceValid && locationValid,
    errors,
    securityContext,
    rateLimitInfo: rateLimit,
    locationCheck: {
      allowed: locationValid,
      riskLevel: calculateLocationRiskLevel(loginData.loginLocation)
    }
  };
}

/**
 * Enhanced validation for MFA setup with advanced security
 */
export async function validateMFASetup(
  setupData: MFASetupDTO
): Promise<ValidationResult> {
  const errors = await validate(setupData);
  const securityContext: SecurityContext = {
    deviceVerified: false,
    locationVerified: false,
    riskScore: 0,
    securityFlags: []
  };

  // Validate MFA method specific requirements
  if (setupData.method === MFAMethod.SMS && !setupData.phoneNumber) {
    errors.push({
      property: 'phoneNumber',
      constraints: {
        required: 'Phone number is required for SMS MFA'
      }
    } as ValidationError);
  }

  const deviceValid = validateDeviceFingerprint(setupData.deviceFingerprint);
  const locationValid = validateSetupLocation(setupData.setupLocation);

  securityContext.deviceVerified = deviceValid;
  securityContext.locationVerified = locationValid;
  securityContext.riskScore = calculateRiskScore(setupData, deviceValid, locationValid);

  return {
    isValid: errors.length === 0 && deviceValid && locationValid,
    errors,
    securityContext
  };
}

/**
 * Enhanced validation for MFA verification with security measures
 */
export async function validateMFAVerification(
  verificationData: MFAVerificationDTO
): Promise<ValidationResult> {
  const errors = await validate(verificationData);
  const securityContext: SecurityContext = {
    deviceVerified: false,
    locationVerified: false,
    riskScore: 0,
    securityFlags: []
  };

  // Verify attempt count and rate limiting
  if (verificationData.attemptCount >= 5) {
    errors.push({
      property: 'attemptCount',
      constraints: {
        maxAttempts: 'Maximum verification attempts exceeded'
      }
    } as ValidationError);
  }

  const deviceValid = validateDeviceFingerprint(verificationData.deviceFingerprint);
  const locationValid = validateVerificationLocation(
    verificationData.verificationLocation
  );

  securityContext.deviceVerified = deviceValid;
  securityContext.locationVerified = locationValid;
  securityContext.riskScore = calculateRiskScore(
    verificationData,
    deviceValid,
    locationValid
  );

  return {
    isValid: errors.length === 0 && deviceValid && locationValid,
    errors,
    securityContext,
    rateLimitInfo: {
      attempts: verificationData.attemptCount,
      windowStart: Date.now(),
      remainingAttempts: 5 - verificationData.attemptCount
    }
  };
}

// Private helper functions

function validateDeviceFingerprint(fingerprint: string): boolean {
  return /^[a-zA-Z0-9\-_]{32,64}$/.test(fingerprint);
}

function validateLoginLocation(location: GeoLocation): boolean {
  // Implement location-based validation logic
  return true; // Simplified for example
}

function validateSetupLocation(location: GeoLocation): boolean {
  // Implement setup location validation logic
  return true; // Simplified for example
}

function validateVerificationLocation(location: GeoLocation): boolean {
  // Implement verification location validation logic
  return true; // Simplified for example
}

function calculateRiskScore(
  data: any,
  deviceValid: boolean,
  locationValid: boolean
): number {
  // Implement risk scoring logic
  return 0; // Simplified for example
}

function calculateLocationRiskLevel(location: GeoLocation): string {
  // Implement location risk level calculation
  return 'LOW'; // Simplified for example
}

function checkRateLimit(email: string): RateLimitInfo {
  // Implement rate limiting logic
  return {
    attempts: 0,
    windowStart: Date.now(),
    remainingAttempts: 5
  };
}