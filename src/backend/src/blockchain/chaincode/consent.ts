/**
 * @fileoverview HIPAA/GDPR-compliant consent management smart contract for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @license MIT
 */

import { Context, Contract, Info, Transaction } from '@hyperledger/fabric-contract-api'; // ^2.2.0
import { 
  IConsent, 
  ConsentStatus, 
  IConsentValidation,
  CONSENT_STATUS_TRANSITIONS,
  VALID_FHIR_RESOURCE_TYPES,
  REQUIRED_PERMISSION_FIELDS
} from '../../interfaces/consent.interface';

/**
 * Validation rules for HIPAA and GDPR compliance
 */
const COMPLIANCE_RULES = {
  HIPAA: {
    REQUIRED_FIELDS: ['userId', 'companyId', 'permissions', 'validFrom', 'validTo'],
    AUDIT_FIELDS: ['createdAt', 'updatedAt', 'blockchainRef'],
    MIN_VALIDITY_PERIOD: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
  },
  GDPR: {
    EXPLICIT_CONSENT: ['purpose', 'dataElements'],
    RIGHT_TO_REVOKE: true,
    DATA_PORTABILITY: ['resourceTypes']
  }
};

/**
 * Smart contract for managing HIPAA/GDPR-compliant consent records
 */
@Info({ 
  title: 'ConsentContract',
  description: 'Smart contract for managing healthcare data consent records with regulatory compliance'
})
export class ConsentContract extends Contract {
  private readonly CONSENT_STATE_KEY = 'consent_state_v1';
  private readonly CONSENT_HISTORY_KEY = 'consent_history_v1';
  private readonly STATE_VERSION = 1;

  constructor() {
    super('ConsentContract');
  }

  /**
   * Creates a new HIPAA/GDPR-compliant consent record
   * @param ctx Transaction context
   * @param consent Consent record to create
   */
  @Transaction()
  public async createConsent(ctx: Context, consent: IConsent): Promise<IConsent> {
    // Validate consent structure and compliance
    const validationResult = await this.validateConsent(consent);
    if (!validationResult.isValid) {
      throw new Error(`Invalid consent: ${validationResult.errors.join(', ')}`);
    }

    // Generate composite key for state storage
    const consentKey = ctx.stub.createCompositeKey(this.CONSENT_STATE_KEY, [consent.id]);

    // Check for existing consent
    const existingConsent = await ctx.stub.getState(consentKey);
    if (existingConsent && existingConsent.length > 0) {
      throw new Error(`Consent with ID ${consent.id} already exists`);
    }

    // Prepare consent record with audit fields
    const consentRecord: IConsent = {
      ...consent,
      status: ConsentStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      blockchainRef: ctx.stub.getTxID()
    };

    // Store consent state
    await ctx.stub.putState(consentKey, Buffer.from(JSON.stringify(consentRecord)));

    // Record audit trail
    const historyKey = ctx.stub.createCompositeKey(this.CONSENT_HISTORY_KEY, [consent.id]);
    const historyEntry = {
      txId: ctx.stub.getTxID(),
      timestamp: consentRecord.createdAt,
      action: 'CREATE',
      details: consentRecord
    };
    await ctx.stub.putState(historyKey, Buffer.from(JSON.stringify([historyEntry])));

    // Emit event
    await ctx.stub.setEvent('ConsentCreated', Buffer.from(JSON.stringify(consentRecord)));

    return consentRecord;
  }

  /**
   * Updates consent status with compliance validation
   * @param ctx Transaction context
   * @param consentId Consent ID to update
   * @param newStatus New consent status
   */
  @Transaction()
  public async updateConsentStatus(
    ctx: Context,
    consentId: string,
    newStatus: ConsentStatus
  ): Promise<IConsent> {
    // Retrieve existing consent
    const consentKey = ctx.stub.createCompositeKey(this.CONSENT_STATE_KEY, [consentId]);
    const consentBuffer = await ctx.stub.getState(consentKey);
    
    if (!consentBuffer || consentBuffer.length === 0) {
      throw new Error(`Consent with ID ${consentId} not found`);
    }

    const consent: IConsent = JSON.parse(consentBuffer.toString());

    // Validate status transition
    const allowedTransitions = CONSENT_STATUS_TRANSITIONS[consent.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${consent.status} to ${newStatus}`);
    }

    // Update consent record
    const updatedConsent: IConsent = {
      ...consent,
      status: newStatus,
      updatedAt: new Date(),
      blockchainRef: ctx.stub.getTxID()
    };

    // Store updated state
    await ctx.stub.putState(consentKey, Buffer.from(JSON.stringify(updatedConsent)));

    // Update audit trail
    const historyKey = ctx.stub.createCompositeKey(this.CONSENT_HISTORY_KEY, [consentId]);
    const historyBuffer = await ctx.stub.getState(historyKey);
    const history = historyBuffer ? JSON.parse(historyBuffer.toString()) : [];
    
    history.push({
      txId: ctx.stub.getTxID(),
      timestamp: updatedConsent.updatedAt,
      action: 'UPDATE_STATUS',
      details: { oldStatus: consent.status, newStatus }
    });

    await ctx.stub.putState(historyKey, Buffer.from(JSON.stringify(history)));

    // Emit event
    await ctx.stub.setEvent('ConsentStatusUpdated', Buffer.from(JSON.stringify(updatedConsent)));

    return updatedConsent;
  }

  /**
   * Retrieves consent record with access validation
   * @param ctx Transaction context
   * @param consentId Consent ID to retrieve
   */
  @Transaction(false)
  public async getConsent(ctx: Context, consentId: string): Promise<IConsent> {
    const consentKey = ctx.stub.createCompositeKey(this.CONSENT_STATE_KEY, [consentId]);
    const consentBuffer = await ctx.stub.getState(consentKey);

    if (!consentBuffer || consentBuffer.length === 0) {
      throw new Error(`Consent with ID ${consentId} not found`);
    }

    const consent: IConsent = JSON.parse(consentBuffer.toString());

    // Validate temporal access
    const now = new Date();
    if (now < consent.validFrom || now > consent.validTo) {
      throw new Error('Consent access outside valid time period');
    }

    // Log access in audit trail
    const historyKey = ctx.stub.createCompositeKey(this.CONSENT_HISTORY_KEY, [consentId]);
    const historyBuffer = await ctx.stub.getState(historyKey);
    const history = historyBuffer ? JSON.parse(historyBuffer.toString()) : [];
    
    history.push({
      txId: ctx.stub.getTxID(),
      timestamp: new Date(),
      action: 'ACCESS',
      details: { accessor: ctx.clientIdentity.getID() }
    });

    await ctx.stub.putState(historyKey, Buffer.from(JSON.stringify(history)));

    return consent;
  }

  /**
   * Validates consent against HIPAA/GDPR requirements
   * @param consent Consent record to validate
   */
  private async validateConsent(consent: IConsent): Promise<IConsentValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate HIPAA required fields
    for (const field of COMPLIANCE_RULES.HIPAA.REQUIRED_FIELDS) {
      if (!consent[field]) {
        errors.push(`Missing required HIPAA field: ${field}`);
      }
    }

    // Validate GDPR explicit consent requirements
    for (const field of COMPLIANCE_RULES.GDPR.EXPLICIT_CONSENT) {
      if (!consent.permissions[field]) {
        errors.push(`Missing required GDPR consent field: ${field}`);
      }
    }

    // Validate permission structure
    for (const field of REQUIRED_PERMISSION_FIELDS) {
      if (!consent.permissions[field]) {
        errors.push(`Missing required permission field: ${field}`);
      }
    }

    // Validate FHIR resource types
    for (const resourceType of consent.permissions.resourceTypes) {
      if (!VALID_FHIR_RESOURCE_TYPES.includes(resourceType)) {
        errors.push(`Invalid FHIR resource type: ${resourceType}`);
      }
    }

    // Validate temporal constraints
    if (consent.validFrom >= consent.validTo) {
      errors.push('Invalid temporal constraints: validFrom must be before validTo');
    }

    const validityPeriod = consent.validTo.getTime() - consent.validFrom.getTime();
    if (validityPeriod < COMPLIANCE_RULES.HIPAA.MIN_VALIDITY_PERIOD) {
      errors.push('Consent validity period too short');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validationTimestamp: new Date()
    };
  }
}

export default ConsentContract;