/**
 * Blockchain Configuration for MyElixir Healthcare Data Marketplace
 * @module blockchain.config
 * @version 1.0.0
 * @description HIPAA-compliant blockchain configuration with enhanced security controls
 */

import { Gateway, Wallets } from '@hyperledger/fabric-network'; // v2.2.0
import { 
  fabricConfig, 
  channelName, 
  chaincodeName, 
  mspId, 
  securityLevel, 
  complianceFlags 
} from '../blockchain/config/fabric-config';
import { 
  name as networkName, 
  version, 
  securitySettings 
} from '../blockchain/config/connection-profile.json';

/**
 * Interface for enhanced security options with HIPAA compliance
 */
interface SecurityOptions {
  hipaaCompliant: boolean;
  gdrpCompliant: boolean;
  auditLogging: boolean;
  encryptionLevel: string;
  certificateRotation: boolean;
}

/**
 * Interface for compliance tracking configuration
 */
interface ComplianceTracking {
  enabled: boolean;
  logLevel: string;
  retentionPeriod: string;
}

/**
 * Interface for event handler options with enhanced security
 */
interface EventHandlerOptions {
  commitTimeout: number;
  strategy: string;
  reconnectOptions: {
    maxRetries: number;
    retryInterval: number;
  };
}

/**
 * Comprehensive blockchain configuration with security enhancements
 */
export const blockchainConfig = {
  // Network identification
  networkName: 'myElixir-network',
  version: '2.2.0',
  
  // Channel and chaincode configuration
  channelName,
  chaincodeName,
  
  // Wallet configuration
  walletPath: '/tmp/wallet',
  identityLabel: 'admin',
  
  // Discovery settings
  discoveryEnabled: true,
  discoveryAsLocalhost: process.env.NODE_ENV === 'development',
  
  // Event handling configuration with enhanced security
  eventHandlerOptions: {
    commitTimeout: 300, // 5 minutes
    strategy: 'MSPID_SCOPE_ALLFORTX',
    reconnectOptions: {
      maxRetries: 5,
      retryInterval: 3000 // 3 seconds
    }
  } as EventHandlerOptions,
  
  // Enhanced security options for HIPAA compliance
  securityOptions: {
    hipaaCompliant: true,
    gdrpCompliant: true,
    auditLogging: true,
    encryptionLevel: 'AES256',
    certificateRotation: true
  } as SecurityOptions,
  
  // Compliance tracking configuration
  complianceTracking: {
    enabled: true,
    logLevel: 'detailed',
    retentionPeriod: '7years'
  } as ComplianceTracking,
  
  // Connection profile with security settings
  connectionProfile: {
    name: networkName,
    version,
    organizations: {
      [mspId]: {
        mspid: mspId,
        certificateAuthorities: ['ca.myelixir.com'],
        peers: ['peer0.myelixir.com']
      }
    },
    peers: {
      'peer0.myelixir.com': {
        url: 'grpcs://peer0.myelixir.com:7051',
        tlsCACerts: {
          path: '../crypto-config/peerOrganizations/myelixir.com/peers/peer0.myelixir.com/tls/ca.crt'
        },
        grpcOptions: {
          'ssl-target-name-override': 'peer0.myelixir.com',
          'hostnameOverride': 'peer0.myelixir.com',
          'request-timeout': 300000
        }
      }
    }
  }
};

/**
 * Retrieves the blockchain configuration with validated security settings
 * @returns {Object} Secure blockchain configuration with HIPAA compliance
 */
export function getBlockchainConfig(): typeof blockchainConfig {
  // Validate security level compliance
  if (securityLevel !== 'HIPAA_COMPLIANT') {
    throw new Error('Security level does not meet HIPAA requirements');
  }

  // Verify HIPAA compliance flags
  if (!blockchainConfig.securityOptions.hipaaCompliant) {
    throw new Error('HIPAA compliance is required for blockchain configuration');
  }

  // Validate encryption settings
  if (blockchainConfig.securityOptions.encryptionLevel !== 'AES256') {
    throw new Error('AES-256 encryption is required for HIPAA compliance');
  }

  // Ensure audit logging is enabled
  if (!blockchainConfig.complianceTracking.enabled) {
    throw new Error('Compliance tracking must be enabled for audit purposes');
  }

  return {
    ...blockchainConfig,
    // Apply any environment-specific overrides
    discoveryAsLocalhost: process.env.NODE_ENV === 'development',
    // Ensure security settings are immutable
    securityOptions: Object.freeze({ ...blockchainConfig.securityOptions }),
    // Ensure compliance tracking is immutable
    complianceTracking: Object.freeze({ ...blockchainConfig.complianceTracking })
  };
}

// Export the Gateway and Wallets types for type safety
export { Gateway, Wallets };