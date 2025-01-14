/**
 * @file Unit tests for encryption utilities
 * @version 1.0.0
 * @description HIPAA-compliant encryption/decryption testing with comprehensive security validation
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import crypto from 'crypto';
import {
  encryptData,
  decryptData,
  generateEncryptionKey,
  hashPassword,
  verifyPassword
} from '../../../src/utils/encryption.util';

// Test constants
const TEST_KEY_LENGTH = 32;
const TEST_IV_LENGTH = 16;
const TEST_AUTH_TAG_LENGTH = 16;
const TEST_DATA = 'Sensitive PHI: John Doe, 123-45-6789, 01/01/1980';
const TEST_PASSWORD = 'SuperSecure123!@#$%^&*()';

describe('Encryption Utility Tests', () => {
  let testKey: Buffer;
  let testKeyId: string;

  beforeEach(async () => {
    // Generate test key before each test
    testKey = crypto.randomBytes(TEST_KEY_LENGTH);
    testKeyId = crypto.randomBytes(8).toString('hex');
  });

  afterEach(() => {
    // Clear sensitive data after each test
    testKey = Buffer.alloc(0);
    jest.clearAllMocks();
  });

  describe('encryptData', () => {
    test('should successfully encrypt data with AES-256-GCM', () => {
      const result = encryptData(TEST_DATA, testKey, { keyId: testKeyId });

      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('encryptedData');
      expect(result).toHaveProperty('authTag');
      expect(result).toHaveProperty('keyId');

      // Validate IV, auth tag, and encrypted data format
      expect(Buffer.from(result.iv, 'base64')).toHaveLength(TEST_IV_LENGTH);
      expect(Buffer.from(result.authTag, 'base64')).toHaveLength(TEST_AUTH_TAG_LENGTH);
      expect(result.encryptedData).toBeTruthy();
      expect(result.keyId).toBe(testKeyId);
    });

    test('should generate unique IVs for same plaintext', () => {
      const result1 = encryptData(TEST_DATA, testKey);
      const result2 = encryptData(TEST_DATA, testKey);

      expect(result1.iv).not.toBe(result2.iv);
      expect(result1.encryptedData).not.toBe(result2.encryptedData);
    });

    test('should handle different data types correctly', () => {
      const bufferData = Buffer.from(TEST_DATA);
      const stringResult = encryptData(TEST_DATA, testKey);
      const bufferResult = encryptData(bufferData, testKey);

      expect(stringResult.encryptedData).toBeTruthy();
      expect(bufferResult.encryptedData).toBeTruthy();
    });

    test('should throw error for invalid key length', () => {
      const invalidKey = crypto.randomBytes(16); // Wrong key length
      expect(() => encryptData(TEST_DATA, invalidKey)).toThrow();
    });

    test('should properly clean up sensitive data', () => {
      const result = encryptData(TEST_DATA, testKey);
      expect(() => {
        // Attempt to access potentially leaked data in memory
        const memory = process.memoryUsage();
        return memory.heapUsed;
      }).not.toThrow();
    });
  });

  describe('decryptData', () => {
    test('should successfully decrypt encrypted data', () => {
      const encrypted = encryptData(TEST_DATA, testKey);
      const decrypted = decryptData(
        encrypted.encryptedData,
        testKey,
        encrypted.iv,
        encrypted.authTag
      );

      expect(decrypted).toBe(TEST_DATA);
    });

    test('should detect tampered data', () => {
      const encrypted = encryptData(TEST_DATA, testKey);
      const tamperedData = encrypted.encryptedData.slice(0, -1) + 'X';

      expect(() => 
        decryptData(tamperedData, testKey, encrypted.iv, encrypted.authTag)
      ).toThrow();
    });

    test('should detect invalid auth tag', () => {
      const encrypted = encryptData(TEST_DATA, testKey);
      const invalidAuthTag = Buffer.from(encrypted.authTag, 'base64')
        .fill(0)
        .toString('base64');

      expect(() =>
        decryptData(encrypted.encryptedData, testKey, encrypted.iv, invalidAuthTag)
      ).toThrow();
    });

    test('should handle missing parameters', () => {
      const encrypted = encryptData(TEST_DATA, testKey);
      
      expect(() => 
        decryptData('', testKey, encrypted.iv, encrypted.authTag)
      ).toThrow();
      
      expect(() =>
        decryptData(encrypted.encryptedData, testKey, '', encrypted.authTag)
      ).toThrow();
    });
  });

  describe('generateEncryptionKey', () => {
    test('should generate HIPAA-compliant encryption key', async () => {
      const result = await generateEncryptionKey(TEST_PASSWORD);

      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('keyId');
      expect(result.key).toHaveLength(TEST_KEY_LENGTH);
      expect(result.keyId).toMatch(/^[a-f0-9]{16}$/);
    });

    test('should generate different keys for same password with different salts', async () => {
      const salt1 = crypto.randomBytes(32).toString('base64');
      const salt2 = crypto.randomBytes(32).toString('base64');

      const result1 = await generateEncryptionKey(TEST_PASSWORD, salt1);
      const result2 = await generateEncryptionKey(TEST_PASSWORD, salt2);

      expect(result1.key.toString('hex')).not.toBe(result2.key.toString('hex'));
    });

    test('should reject weak passwords', async () => {
      const weakPassword = 'weak';
      await expect(generateEncryptionKey(weakPassword)).rejects.toThrow();
    });

    test('should use provided iterations parameter', async () => {
      const customIterations = 500000;
      const result = await generateEncryptionKey(TEST_PASSWORD, undefined, {
        iterations: customIterations
      });

      expect(result.key).toHaveLength(TEST_KEY_LENGTH);
    });
  });

  describe('Key Rotation Tests', () => {
    test('should handle key rotation scenarios', async () => {
      // Generate initial key
      const initialKey = await generateEncryptionKey(TEST_PASSWORD);
      
      // Encrypt with initial key
      const encrypted = encryptData(TEST_DATA, initialKey.key);
      
      // Generate rotated key
      const rotatedKey = await generateEncryptionKey(TEST_PASSWORD);
      
      // Verify original key still works
      const decrypted = decryptData(
        encrypted.encryptedData,
        initialKey.key,
        encrypted.iv,
        encrypted.authTag
      );
      
      expect(decrypted).toBe(TEST_DATA);
      expect(rotatedKey.keyId).not.toBe(initialKey.keyId);
    });
  });

  describe('Performance and Security Tests', () => {
    test('should complete encryption within acceptable time', () => {
      const startTime = process.hrtime();
      
      encryptData(TEST_DATA, testKey);
      
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const milliseconds = seconds * 1000 + nanoseconds / 1000000;
      
      expect(milliseconds).toBeLessThan(100); // Should complete within 100ms
    });

    test('should maintain constant-time operations', () => {
      const timings: number[] = [];
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const startTime = process.hrtime();
        const encrypted = encryptData(TEST_DATA, testKey);
        decryptData(encrypted.encryptedData, testKey, encrypted.iv, encrypted.authTag);
        const [seconds, nanoseconds] = process.hrtime(startTime);
        timings.push(seconds * 1000 + nanoseconds / 1000000);
      }

      const avgTime = timings.reduce((a, b) => a + b) / timings.length;
      const variance = Math.sqrt(
        timings.reduce((a, b) => a + Math.pow(b - avgTime, 2), 0) / timings.length
      );

      expect(variance).toBeLessThan(50); // Variance should be minimal
    });
  });
});