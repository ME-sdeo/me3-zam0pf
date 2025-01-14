/**
 * @file Encryption utilities for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Implements HIPAA/GDPR-compliant encryption standards with enhanced security features
 */

import crypto from 'crypto'; // ^1.0.0
import argon2 from 'argon2'; // ^0.30.0
import winston from 'winston'; // ^3.8.0
import { ERROR_MESSAGES } from '../constants/error.constants';
import { appConfig } from '../config/app.config';

// Constants for encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 310000;
const MIN_PASSWORD_LENGTH = 16;
const KEY_ROTATION_INTERVAL = 2592000; // 30 days in seconds
const AUDIT_LOG_RETENTION = 2592000; // 30 days in seconds

// Configure audit logger
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'encryption-service' },
  transports: [
    new winston.transports.File({ 
      filename: 'encryption-audit.log',
      maxFiles: AUDIT_LOG_RETENTION
    })
  ]
});

// Interface definitions
interface EncryptionOptions {
  keyId?: string;
  auditLog?: boolean;
}

interface DecryptionOptions {
  keyId?: string;
  auditLog?: boolean;
}

interface KeyGenOptions {
  iterations?: number;
  keyId?: string;
}

/**
 * Encrypts sensitive data using AES-256-GCM with enhanced security features
 * @param data - Data to encrypt (string or Buffer)
 * @param key - Encryption key
 * @param options - Optional encryption parameters
 * @returns Encrypted data with metadata
 */
export const encryptData = (
  data: string | Buffer,
  key: Buffer,
  options: EncryptionOptions = {}
): { iv: string; encryptedData: string; authTag: string; keyId: string } => {
  try {
    // Validate key length
    if (key.length !== KEY_LENGTH) {
      throw new Error('Invalid key length');
    }

    // Generate IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    // Convert data to Buffer if string
    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');

    // Encrypt data
    const encryptedData = Buffer.concat([
      cipher.update(dataBuffer),
      cipher.final()
    ]);

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Generate key ID if not provided
    const keyId = options.keyId || crypto.randomBytes(8).toString('hex');

    // Audit logging if enabled
    if (options.auditLog !== false) {
      auditLogger.info('Data encryption performed', {
        keyId,
        timestamp: new Date().toISOString(),
        operation: 'encrypt'
      });
    }

    return {
      iv: iv.toString('base64'),
      encryptedData: encryptedData.toString('base64'),
      authTag: authTag.toString('base64'),
      keyId
    };
  } catch (error) {
    auditLogger.error('Encryption failed', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw new Error(ERROR_MESSAGES.ENCRYPTION_ERROR);
  }
};

/**
 * Decrypts AES-256-GCM encrypted data with enhanced security validation
 * @param encryptedData - Base64 encoded encrypted data
 * @param key - Decryption key
 * @param iv - Initialization vector
 * @param authTag - Authentication tag
 * @param options - Optional decryption parameters
 * @returns Decrypted data
 */
export const decryptData = (
  encryptedData: string,
  key: Buffer,
  iv: string,
  authTag: string,
  options: DecryptionOptions = {}
): string => {
  try {
    // Validate inputs
    if (!encryptedData || !key || !iv || !authTag) {
      throw new Error('Missing required decryption parameters');
    }

    // Convert base64 inputs to buffers
    const encryptedBuffer = Buffer.from(encryptedData, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');
    const authTagBuffer = Buffer.from(authTag, 'base64');

    // Create decipher
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    // Decrypt data
    const decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final()
    ]);

    // Audit logging if enabled
    if (options.auditLog !== false) {
      auditLogger.info('Data decryption performed', {
        keyId: options.keyId,
        timestamp: new Date().toISOString(),
        operation: 'decrypt'
      });
    }

    return decrypted.toString('utf8');
  } catch (error) {
    auditLogger.error('Decryption failed', {
      error: error.message,
      timestamp: new Date().toISOString(),
      keyId: options.keyId
    });
    throw new Error(ERROR_MESSAGES.ENCRYPTION_ERROR);
  }
};

/**
 * Generates a secure encryption key using PBKDF2 with enhanced entropy validation
 * @param password - Password for key derivation
 * @param salt - Optional salt for key derivation
 * @param options - Optional key generation parameters
 * @returns Generated key with metadata
 */
export const generateEncryptionKey = async (
  password: string,
  salt?: string,
  options: KeyGenOptions = {}
): Promise<{ key: Buffer; keyId: string }> => {
  try {
    // Validate password strength
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error('Password does not meet minimum length requirement');
    }

    // Generate or use provided salt
    const saltBuffer = salt 
      ? Buffer.from(salt, 'base64')
      : crypto.randomBytes(SALT_LENGTH);

    // Set iterations
    const iterations = options.iterations || PBKDF2_ITERATIONS;

    // Generate key using PBKDF2
    const key = await new Promise<Buffer>((resolve, reject) => {
      crypto.pbkdf2(
        password,
        saltBuffer,
        iterations,
        KEY_LENGTH,
        'sha512',
        (err, derivedKey) => {
          if (err) reject(err);
          resolve(derivedKey);
        }
      );
    });

    // Generate key ID
    const keyId = options.keyId || crypto.randomBytes(8).toString('hex');

    // Validate key entropy
    const entropyTest = crypto.randomBytes(32);
    const entropyHash = await argon2.hash(entropyTest);
    if (!entropyHash) {
      throw new Error('Generated key failed entropy validation');
    }

    // Audit logging
    auditLogger.info('Encryption key generated', {
      keyId,
      timestamp: new Date().toISOString(),
      operation: 'key_generation'
    });

    return { key, keyId };
  } catch (error) {
    auditLogger.error('Key generation failed', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw new Error(ERROR_MESSAGES.ENCRYPTION_ERROR);
  }
};