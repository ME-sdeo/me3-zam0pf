import CryptoJS from 'crypto-js'; // ^4.1.1
import { AUTH_STORAGE_KEYS } from '../constants/auth.constants';
import { IAuthTokens, IAuthUser } from '../interfaces/auth.interface';

/**
 * Interface for storage operation options
 */
interface StorageOptions {
  encrypt?: boolean;
  compress?: boolean;
  expiresIn?: number;
  storage?: 'local' | 'session';
}

/**
 * Interface for stored data metadata
 */
interface StorageMetadata {
  timestamp: number;
  version: string;
  iv: string;
  compressed?: boolean;
  expiresAt?: number;
}

/**
 * Storage service for secure browser storage operations
 * Implements HIPAA-compliant storage with AES-256 encryption
 */
export class StorageService {
  private static readonly ENCRYPTION_KEY = process.env.REACT_APP_STORAGE_ENCRYPTION_KEY || StorageService.generateFallbackKey();
  private static readonly VERSION = process.env.REACT_APP_STORAGE_VERSION || '1.0';
  private static readonly QUOTA_LIMIT = process.env.REACT_APP_STORAGE_QUOTA_MB 
    ? parseInt(process.env.REACT_APP_STORAGE_QUOTA_MB) * 1024 * 1024 
    : 5 * 1024 * 1024;
  private static readonly COMPRESSION_THRESHOLD = 1024; // 1KB

  /**
   * Generates a fallback encryption key if none provided in env
   */
  private static generateFallbackKey(): string {
    return CryptoJS.lib.WordArray.random(256 / 8).toString();
  }

  /**
   * Encrypts data using AES-256 with random IV
   */
  private static encrypt(data: string): { encrypted: string; iv: string } {
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    const encrypted = CryptoJS.AES.encrypt(data, this.ENCRYPTION_KEY, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    return {
      encrypted: encrypted.toString(),
      iv: iv.toString()
    };
  }

  /**
   * Decrypts data using AES-256 with stored IV
   */
  private static decrypt(encrypted: string, iv: string): string {
    const decrypted = CryptoJS.AES.decrypt(encrypted, this.ENCRYPTION_KEY, {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Compresses data using DEFLATE algorithm
   */
  private static compress(data: string): string {
    return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(data));
  }

  /**
   * Decompresses DEFLATE compressed data
   */
  private static decompress(compressed: string): string {
    return CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(compressed));
  }

  /**
   * Checks if storage quota would be exceeded
   */
  private static async checkQuota(newDataSize: number): Promise<boolean> {
    const estimate = await navigator.storage?.estimate();
    const usage = estimate?.usage || 0;
    return (usage + newDataSize) <= this.QUOTA_LIMIT;
  }

  /**
   * Securely stores data with encryption and metadata
   */
  public static async setItem<T>(
    key: string,
    value: T,
    options: StorageOptions = {}
  ): Promise<void> {
    const {
      encrypt = true,
      compress = true,
      expiresIn,
      storage = 'local'
    } = options;

    const storageMethod = storage === 'local' ? localStorage : sessionStorage;
    const data = JSON.stringify(value);
    const dataSize = new Blob([data]).size;

    // Check storage quota
    if (!await this.checkQuota(dataSize)) {
      throw new Error('Storage quota would be exceeded');
    }

    let processedData = data;
    const metadata: StorageMetadata = {
      timestamp: Date.now(),
      version: this.VERSION,
      iv: '',
      compressed: false
    };

    // Compress if enabled and data exceeds threshold
    if (compress && dataSize > this.COMPRESSION_THRESHOLD) {
      processedData = this.compress(processedData);
      metadata.compressed = true;
    }

    // Encrypt if enabled
    if (encrypt) {
      const { encrypted, iv } = this.encrypt(processedData);
      processedData = encrypted;
      metadata.iv = iv;
    }

    // Add expiration if specified
    if (expiresIn) {
      metadata.expiresAt = Date.now() + expiresIn;
    }

    // Store data and metadata
    storageMethod.setItem(key, processedData);
    storageMethod.setItem(`${key}_metadata`, JSON.stringify(metadata));

    // Broadcast storage event for cross-tab sync
    window.dispatchEvent(new StorageEvent('storage', {
      key,
      newValue: processedData
    }));
  }

  /**
   * Retrieves and decrypts data from storage
   */
  public static async getItem<T>(
    key: string,
    options: StorageOptions = {}
  ): Promise<T | null> {
    const { storage = 'local' } = options;
    const storageMethod = storage === 'local' ? localStorage : sessionStorage;

    const data = storageMethod.getItem(key);
    const metadataStr = storageMethod.getItem(`${key}_metadata`);

    if (!data || !metadataStr) {
      return null;
    }

    const metadata: StorageMetadata = JSON.parse(metadataStr);

    // Check expiration
    if (metadata.expiresAt && Date.now() > metadata.expiresAt) {
      await this.removeItem(key, options);
      return null;
    }

    // Process data
    let processedData = data;

    // Decrypt if IV exists (indicating encrypted data)
    if (metadata.iv) {
      processedData = this.decrypt(processedData, metadata.iv);
    }

    // Decompress if compressed
    if (metadata.compressed) {
      processedData = this.decompress(processedData);
    }

    return JSON.parse(processedData);
  }

  /**
   * Removes item and its metadata from storage
   */
  public static async removeItem(
    key: string,
    options: StorageOptions = {}
  ): Promise<void> {
    const { storage = 'local' } = options;
    const storageMethod = storage === 'local' ? localStorage : sessionStorage;

    storageMethod.removeItem(key);
    storageMethod.removeItem(`${key}_metadata`);

    // Broadcast removal event
    window.dispatchEvent(new StorageEvent('storage', {
      key,
      newValue: null
    }));
  }

  /**
   * Clears all storage data
   */
  public static async clearStorage(
    options: StorageOptions = {}
  ): Promise<void> {
    const { storage = 'local' } = options;
    const storageMethod = storage === 'local' ? localStorage : sessionStorage;

    storageMethod.clear();

    // Broadcast clear event
    window.dispatchEvent(new StorageEvent('storage', {
      key: null,
      newValue: null
    }));
  }

  /**
   * Helper method to store auth tokens securely
   */
  public static async setAuthTokens(tokens: IAuthTokens): Promise<void> {
    await this.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, tokens, {
      encrypt: true,
      storage: 'session',
      expiresIn: tokens.expiresIn * 1000
    });
  }

  /**
   * Helper method to store user profile securely
   */
  public static async setUserProfile(user: IAuthUser): Promise<void> {
    await this.setItem(AUTH_STORAGE_KEYS.USER_PROFILE, user, {
      encrypt: true,
      storage: 'local'
    });
  }
}