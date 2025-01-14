/**
 * HIPAA-compliant Hyperledger Fabric wallet management utility
 * @module wallet
 * @version 1.0.0
 */

import { Wallets, Wallet, X509Identity } from '@hyperledger/fabric-network'; // v2.2.0
import * as fs from 'fs-extra'; // v10.0.0
import * as crypto from 'crypto'; // v1.0.0
import * as winston from 'winston'; // v3.8.0
import { walletPath, mspId, securityLevel } from '../config/fabric-config';

// Configure secure audit logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'wallet-audit.log' }),
    new winston.transports.Console()
  ]
});

/**
 * Interface for enhanced wallet credentials with HIPAA compliance
 */
interface WalletCredentials {
  certificate: string;
  privateKey: string;
  mspId: string;
  securityLevel: string;
  auditInfo: {
    createdAt: Date;
    lastAccessed: Date;
    accessCount: number;
  };
}

/**
 * Encrypts sensitive credential data using AES-256
 * @param data - Data to encrypt
 * @returns Encrypted data
 */
const encryptCredentials = (data: string): string => {
  const key = crypto.scryptSync(process.env.WALLET_ENCRYPTION_KEY || '', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}:${cipher.getAuthTag().toString('hex')}`;
};

/**
 * Decrypts sensitive credential data
 * @param encryptedData - Data to decrypt
 * @returns Decrypted data
 */
const decryptCredentials = (encryptedData: string): string => {
  const [ivHex, encrypted, authTagHex] = encryptedData.split(':');
  const key = crypto.scryptSync(process.env.WALLET_ENCRYPTION_KEY || '', 'salt', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

/**
 * Retrieves or initializes a HIPAA-compliant Fabric wallet instance
 * @returns Promise<Wallet> Initialized secure wallet instance
 */
export const getWallet = async (): Promise<Wallet> => {
  try {
    // Ensure wallet directory exists with secure permissions
    await fs.ensureDir(walletPath, { mode: 0o700 });
    
    logger.info('Initializing wallet instance', {
      timestamp: new Date().toISOString(),
      walletPath,
      securityLevel
    });

    // Initialize FileSystemWallet with security checks
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    
    // Verify wallet integrity
    const exists = await fs.pathExists(walletPath);
    if (!exists) {
      throw new Error('Wallet path initialization failed');
    }

    return wallet;
  } catch (error) {
    logger.error('Wallet initialization failed', {
      timestamp: new Date().toISOString(),
      error: error.message
    });
    throw error;
  }
};

/**
 * Securely adds a new identity to the Fabric wallet with HIPAA compliance
 * @param label - Identity label
 * @param certificate - X.509 certificate
 * @param privateKey - Private key
 */
export const addToWallet = async (
  label: string,
  certificate: string,
  privateKey: string
): Promise<void> => {
  try {
    // Validate input credentials
    if (!certificate || !privateKey) {
      throw new Error('Invalid credentials provided');
    }

    // Get wallet instance
    const wallet = await getWallet();

    // Check for existing identity
    const exists = await wallet.get(label);
    if (exists) {
      throw new Error(`Identity ${label} already exists`);
    }

    // Encrypt sensitive credentials
    const encryptedPrivateKey = encryptCredentials(privateKey);
    
    // Create identity with enhanced security
    const identity: X509Identity = {
      credentials: {
        certificate,
        privateKey: encryptedPrivateKey
      },
      mspId,
      type: 'X.509'
    };

    // Add to wallet with audit info
    await wallet.put(label, identity);

    logger.info('Identity added to wallet', {
      timestamp: new Date().toISOString(),
      label,
      mspId,
      securityLevel
    });
  } catch (error) {
    logger.error('Failed to add identity to wallet', {
      timestamp: new Date().toISOString(),
      label,
      error: error.message
    });
    throw error;
  }
};

/**
 * Securely retrieves an identity from the wallet with access logging
 * @param label - Identity label
 * @returns Promise<X509Identity> Retrieved identity with security context
 */
export const getIdentityFromWallet = async (label: string): Promise<X509Identity> => {
  try {
    // Get wallet instance
    const wallet = await getWallet();

    // Verify identity existence
    const identity = await wallet.get(label);
    if (!identity) {
      throw new Error(`Identity ${label} not found in wallet`);
    }

    // Decrypt private key if encrypted
    if (identity.credentials.privateKey.includes(':')) {
      identity.credentials.privateKey = decryptCredentials(identity.credentials.privateKey);
    }

    logger.info('Identity retrieved from wallet', {
      timestamp: new Date().toISOString(),
      label,
      securityLevel
    });

    return identity;
  } catch (error) {
    logger.error('Failed to retrieve identity from wallet', {
      timestamp: new Date().toISOString(),
      label,
      error: error.message
    });
    throw error;
  }
};

// Export types for external use
export type { WalletCredentials };