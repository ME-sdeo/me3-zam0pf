/**
 * HIPAA/GDPR-compliant Hyperledger Fabric service for MyElixir healthcare data marketplace
 * @version 1.0.0
 */

import { Gateway, Network, Contract } from '@hyperledger/fabric-network'; // v2.2.0
import * as winston from 'winston'; // v3.8.0
import { fabricConfig, channelName, chaincodeName, mspId, connectionProfile } from '../config/fabric-config';
import { getWallet } from '../utils/wallet';
import CircuitBreaker from 'opossum'; // v6.0.0
import genericPool from 'generic-pool'; // v3.9.0

/**
 * Interface for consent transaction data
 */
interface IConsent {
  id: string;
  patientId: string;
  providerId: string;
  dataScope: string[];
  validFrom: Date;
  validTo: Date;
  status: 'ACTIVE' | 'REVOKED';
  metadata: {
    hipaaCompliant: boolean;
    gdprCompliant: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}

/**
 * HIPAA/GDPR-compliant service for managing Hyperledger Fabric blockchain operations
 */
export class FabricService {
  private gateway: Gateway | null = null;
  private network: Network | null = null;
  private consentContract: Contract | null = null;
  private transactionContract: Contract | null = null;
  private connectionPool: genericPool.Pool<Gateway>;
  private circuitBreaker: CircuitBreaker;
  private logger: winston.Logger;

  constructor() {
    // Initialize secure logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'fabric-service-audit.log' }),
        new winston.transports.Console()
      ]
    });

    // Initialize connection pool
    this.connectionPool = genericPool.createPool({
      create: async () => {
        const gateway = new Gateway();
        const wallet = await getWallet();
        const identity = await wallet.get(process.env.FABRIC_IDENTITY_LABEL || 'admin');
        
        if (!identity) {
          throw new Error('Identity not found in wallet');
        }

        await gateway.connect(connectionProfile, {
          wallet,
          identity: process.env.FABRIC_IDENTITY_LABEL || 'admin',
          discovery: { enabled: true, asLocalhost: process.env.NODE_ENV === 'development' },
          eventHandlerOptions: fabricConfig.eventHandlerOptions
        });

        return gateway;
      },
      destroy: async (gateway: Gateway) => {
        gateway.disconnect();
      }
    }, {
      max: 10,
      min: 2,
      acquireTimeoutMillis: fabricConfig.connectionTimeout,
      idleTimeoutMillis: 30000
    });

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker(async () => {
      return await this.connectionPool.acquire();
    }, {
      timeout: fabricConfig.connectionTimeout,
      resetTimeout: 30000,
      errorThresholdPercentage: 50
    });
  }

  /**
   * Establishes secure connection to Fabric network with compliance validation
   */
  public async connect(): Promise<void> {
    try {
      this.logger.info('Initiating Fabric network connection', {
        timestamp: new Date().toISOString(),
        channelName,
        mspId
      });

      // Get gateway instance through circuit breaker
      this.gateway = await this.circuitBreaker.fire();

      // Get network instance
      this.network = await this.gateway.getNetwork(channelName);

      // Get contract instances
      this.consentContract = this.network.getContract(chaincodeName, 'consent');
      this.transactionContract = this.network.getContract(chaincodeName, 'transaction');

      this.logger.info('Successfully connected to Fabric network', {
        timestamp: new Date().toISOString(),
        channelName,
        contracts: ['consent', 'transaction']
      });
    } catch (error) {
      this.logger.error('Failed to connect to Fabric network', {
        timestamp: new Date().toISOString(),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Securely disconnects from Fabric network
   */
  public async disconnect(): Promise<void> {
    try {
      this.logger.info('Initiating Fabric network disconnection', {
        timestamp: new Date().toISOString()
      });

      if (this.gateway) {
        await this.connectionPool.release(this.gateway);
        this.gateway = null;
        this.network = null;
        this.consentContract = null;
        this.transactionContract = null;
      }

      this.logger.info('Successfully disconnected from Fabric network', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to disconnect from Fabric network', {
        timestamp: new Date().toISOString(),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Submits a HIPAA-compliant consent record to the blockchain
   * @param consent - Consent data to be recorded
   * @returns Promise<IConsent> - Created consent record
   */
  public async submitConsent(consent: IConsent): Promise<IConsent> {
    try {
      if (!this.consentContract) {
        throw new Error('Fabric connection not established');
      }

      // Validate consent data
      this.validateConsent(consent);

      this.logger.info('Submitting consent record to blockchain', {
        timestamp: new Date().toISOString(),
        consentId: consent.id,
        patientId: consent.patientId
      });

      // Submit transaction with retry mechanism
      const result = await this.submitWithRetry(async () => {
        const response = await this.consentContract!.submitTransaction(
          'CreateConsent',
          JSON.stringify(consent)
        );
        return JSON.parse(response.toString());
      });

      this.logger.info('Successfully recorded consent on blockchain', {
        timestamp: new Date().toISOString(),
        consentId: result.id,
        transactionId: result.txId
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to submit consent to blockchain', {
        timestamp: new Date().toISOString(),
        consentId: consent.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validates consent data structure and compliance requirements
   * @param consent - Consent data to validate
   */
  private validateConsent(consent: IConsent): void {
    if (!consent.id || !consent.patientId || !consent.providerId) {
      throw new Error('Required consent fields missing');
    }

    if (!consent.metadata.hipaaCompliant || !consent.metadata.gdprCompliant) {
      throw new Error('Consent does not meet compliance requirements');
    }

    if (new Date(consent.validTo) <= new Date(consent.validFrom)) {
      throw new Error('Invalid consent validity period');
    }
  }

  /**
   * Implements retry mechanism for transaction submission
   * @param operation - Async operation to retry
   */
  private async submitWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= fabricConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        this.logger.warn(`Transaction attempt ${attempt} failed`, {
          timestamp: new Date().toISOString(),
          error: error.message
        });
        
        if (attempt < fabricConfig.maxRetries) {
          await new Promise(resolve => 
            setTimeout(resolve, fabricConfig.retryInterval)
          );
        }
      }
    }

    throw lastError || new Error('Transaction failed after maximum retries');
  }
}

export default FabricService;