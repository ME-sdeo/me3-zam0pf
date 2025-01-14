/**
 * Hyperledger Fabric Configuration for MyElixir Healthcare Data Marketplace
 * @version 1.0.0
 * @description Configuration settings for Hyperledger Fabric blockchain network with HIPAA-compliant security measures
 */

import { ConnectionProfileType } from '@hyperledger/fabric-network'; // v2.2.0
import connectionProfile from './connection-profile.json';

/**
 * Interface defining the structure of Fabric configuration with enhanced security and compliance options
 */
interface IFabricConfig {
  /** Name of the channel for consent management */
  channelName: string;
  /** Name of the chaincode for consent contract */
  chaincodeName: string;
  /** Member Service Provider ID for the organization */
  mspId: string;
  /** Path to store the wallet credentials */
  walletPath: string;
  /** Connection profile configuration */
  connectionProfile: ConnectionProfileType;
  /** Connection timeout in milliseconds */
  connectionTimeout: number;
  /** Enable service discovery */
  discoveryEnabled: boolean;
  /** Event handler configuration options */
  eventHandlerOptions: {
    /** Timeout for commit in seconds */
    commitTimeout: number;
    /** Transaction commitment strategy */
    strategy: string;
  };
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Interval between retries in milliseconds */
  retryInterval: number;
  /** Query timeout in milliseconds */
  queryTimeout: number;
  /** Enable TLS for secure communication */
  tlsEnabled: boolean;
  /** Security compliance level */
  securityLevel: string;
}

/**
 * Comprehensive Fabric network configuration with enhanced security measures
 * Implements HIPAA-compliant settings for healthcare data management
 */
export const fabricConfig: IFabricConfig = {
  // Channel configuration for consent management
  channelName: 'consentchannel',
  chaincodeName: 'consentcontract',
  
  // Organization configuration
  mspId: 'MyElixirOrgMSP',
  walletPath: '/tmp/wallet',
  
  // Network connection configuration
  connectionProfile: connectionProfile as ConnectionProfileType,
  connectionTimeout: 300000, // 5 minutes
  discoveryEnabled: true,
  
  // Event handling configuration
  eventHandlerOptions: {
    commitTimeout: 300, // 5 minutes
    strategy: 'MSPID_SCOPE_ALLFORTX'
  },
  
  // Retry and timeout configuration
  maxRetries: 5,
  retryInterval: 3000, // 3 seconds
  queryTimeout: 60000, // 1 minute
  
  // Security configuration
  tlsEnabled: true,
  securityLevel: 'HIPAA_COMPLIANT'
};

// Export individual configuration elements for granular access
export const {
  channelName,
  chaincodeName,
  mspId,
  walletPath,
  connectionTimeout,
  discoveryEnabled,
  eventHandlerOptions
} = fabricConfig;

// Export connection profile elements
export const {
  organizations,
  channels
} = connectionProfile;

// Export type for type safety
export type { IFabricConfig };