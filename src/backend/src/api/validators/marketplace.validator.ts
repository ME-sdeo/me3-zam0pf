import { 
  IsUUID, 
  IsNumber, 
  Min, 
  Max, 
  IsObject, 
  IsEnum, 
  IsHash,
  IsString,
  MinLength,
  MaxLength,
  IsArray,
  IsDate,
  ValidateNested,
  IsOptional
} from 'class-validator';
import { Type } from 'class-transformer';
import { 
  DataRequest, 
  RequestStatus, 
  TransactionStatus, 
  MarketplaceTransaction,
  AuditEvent
} from '../../interfaces/marketplace.interface';
import { MARKETPLACE_VALIDATION } from '../../constants/validation.constants';
import { validateFHIRResource } from '../../utils/validation.util';
import { FHIRResource } from '../../interfaces/fhir.interface';

/**
 * Validator class for data request filter criteria with HIPAA compliance
 * @version 1.0.0
 */
export class FilterCriteriaValidator {
  @IsArray()
  @IsString({ each: true })
  resourceTypes!: string[];

  @IsObject()
  @ValidateNested()
  @Type(() => DemographicsValidator)
  demographics!: DemographicsValidator;

  @IsArray()
  @IsString({ each: true })
  conditions!: string[];

  @IsObject()
  @ValidateNested()
  @Type(() => DateRangeValidator)
  dateRange!: DateRangeValidator;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  excludedFields?: string[];

  @IsString()
  complianceLevel!: string;

  @IsNumber()
  @Min(1)
  @Max(365)
  dataRetentionPeriod!: number;
}

/**
 * Validator class for demographic criteria
 */
class DemographicsValidator {
  @IsObject()
  @ValidateNested()
  @Type(() => AgeRangeValidator)
  ageRange!: AgeRangeValidator;

  @IsArray()
  @IsString({ each: true })
  gender!: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ethnicity?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  location?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  populationGroup?: string[];
}

/**
 * Validator class for age range criteria
 */
class AgeRangeValidator {
  @IsNumber()
  @Min(0)
  @Max(120)
  min!: number;

  @IsNumber()
  @Min(0)
  @Max(120)
  max!: number;
}

/**
 * Validator class for date range criteria
 */
class DateRangeValidator {
  @IsDate()
  @Type(() => Date)
  startDate!: Date;

  @IsDate()
  @Type(() => Date)
  endDate!: Date;
}

/**
 * Validator class for audit events
 */
class AuditEventValidator {
  @IsDate()
  @Type(() => Date)
  timestamp!: Date;

  @IsString()
  action!: string;

  @IsUUID()
  performedBy!: string;

  @IsObject()
  details!: Record<string, any>;

  @IsString()
  ipAddress!: string;

  @IsString()
  userAgent!: string;
}

/**
 * Enhanced validator class for data requests with HIPAA compliance
 * @version 1.0.0
 */
export class DataRequestValidator implements Partial<DataRequest> {
  @IsUUID()
  companyId!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(100)
  title!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(1000)
  description!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => FilterCriteriaValidator)
  filterCriteria!: FilterCriteriaValidator;

  @IsNumber()
  @Min(MARKETPLACE_VALIDATION.MIN_PRICE)
  @Max(MARKETPLACE_VALIDATION.MAX_PRICE)
  pricePerRecord!: number;

  @IsNumber()
  @Min(MARKETPLACE_VALIDATION.MIN_QUANTITY)
  @Max(MARKETPLACE_VALIDATION.MAX_QUANTITY)
  recordsNeeded!: number;

  @IsEnum(RequestStatus)
  status!: RequestStatus;

  @IsString()
  complianceStatus!: string;

  @IsHash('sha256')
  blockchainRef!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuditEventValidator)
  auditTrail!: AuditEvent[];
}

/**
 * Enhanced validator class for marketplace transactions with blockchain verification
 * @version 1.0.0
 */
export class MarketplaceTransactionValidator implements Partial<MarketplaceTransaction> {
  @IsUUID()
  requestId!: string;

  @IsUUID()
  providerId!: string;

  @IsUUID()
  companyId!: string;

  @IsArray()
  @IsUUID('all', { each: true })
  resourceIds!: string[];

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsEnum(TransactionStatus)
  status!: TransactionStatus;

  @IsHash('sha256')
  blockchainRef!: string;

  @IsString()
  complianceStatus!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuditEventValidator)
  auditTrail!: AuditEvent[];
}

/**
 * Validates data request with enhanced HIPAA compliance checks
 * @param request Data request to validate
 * @returns Promise<boolean>
 */
export async function validateDataRequest(request: DataRequest): Promise<boolean> {
  const validator = new DataRequestValidator();
  Object.assign(validator, request);
  
  // Validate FHIR resources in filter criteria
  for (const resourceType of request.filterCriteria.resourceTypes) {
    const dummyResource: FHIRResource = {
      resourceType,
      id: 'validation-check',
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString()
      }
    };
    const fhirValidation = await validateFHIRResource(dummyResource, {
      validateHIPAA: true,
      validateReferences: false
    });
    if (!fhirValidation.valid) {
      return false;
    }
  }

  return true;
}

/**
 * Validates marketplace transaction with blockchain verification
 * @param transaction Transaction to validate
 * @returns Promise<boolean>
 */
export async function validateMarketplaceTransaction(
  transaction: MarketplaceTransaction
): Promise<boolean> {
  const validator = new MarketplaceTransactionValidator();
  Object.assign(validator, transaction);

  // Verify blockchain reference format
  const blockchainHashRegex = /^0x[a-fA-F0-9]{64}$/;
  if (!blockchainHashRegex.test(transaction.blockchainRef)) {
    return false;
  }

  // Verify transaction amount calculation
  const request = await getDataRequest(transaction.requestId);
  if (!request) return false;

  const expectedAmount = request.pricePerRecord * transaction.resourceIds.length;
  if (transaction.amount !== expectedAmount) {
    return false;
  }

  return true;
}

/**
 * Mock function to get data request - replace with actual implementation
 */
async function getDataRequest(requestId: string): Promise<DataRequest | null> {
  // Implementation would fetch from database
  return null;
}

export {
  FilterCriteriaValidator,
  DataRequestValidator,
  MarketplaceTransactionValidator,
  validateDataRequest,
  validateMarketplaceTransaction
};