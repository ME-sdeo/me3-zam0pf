/**
 * @file Database configuration for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Manages secure connection settings and optimized pool configuration
 * for MongoDB metadata storage and PostgreSQL FHIR data storage
 */

import { config } from 'dotenv'; // ^16.0.0
import mongoose from 'mongoose'; // ^7.0.0
import knex from 'knex'; // ^2.4.0
import { ERROR_MESSAGES } from '../constants/error.constants';

// Load environment variables
config();

/**
 * Interface for MongoDB configuration options
 */
interface MongoDBConfig {
  uri: string;
  dbName: string;
  options: mongoose.ConnectOptions;
}

/**
 * Interface for PostgreSQL configuration options
 */
interface PostgreSQLConfig {
  client: string;
  connection: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: {
      rejectUnauthorized: boolean;
      ca?: string;
      key?: string;
      cert?: string;
    };
  };
  pool: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
    acquireTimeoutMillis: number;
    createTimeoutMillis: number;
    destroyTimeoutMillis: number;
    createRetryIntervalMillis: number;
  };
  migrations: {
    tableName: string;
    directory: string;
    extension: string;
    loadExtensions: string[];
    schemaName: string;
  };
  seeds: {
    directory: string;
    loadExtensions: string[];
  };
  acquireConnectionTimeout: number;
  debug: boolean;
}

/**
 * Validates all database configuration settings
 * @throws Error if validation fails
 */
const validateDatabaseConfig = (): void => {
  // Validate MongoDB configuration
  if (!process.env.MONGODB_URI) {
    throw new Error(ERROR_MESSAGES.DB_001);
  }

  // Validate MongoDB URI format
  const mongoUriRegex = /^mongodb(\+srv)?:\/\/.+/;
  if (!mongoUriRegex.test(process.env.MONGODB_URI)) {
    throw new Error('Invalid MongoDB URI format');
  }

  // Validate PostgreSQL configuration
  if (!process.env.PG_HOST || !process.env.PG_DATABASE || 
      !process.env.PG_USER || !process.env.PG_PASSWORD) {
    throw new Error('Missing required PostgreSQL configuration');
  }

  // Validate pool size configurations
  const maxPool = parseInt(process.env.DB_MAX_POOL_SIZE || '10', 10);
  const minPool = parseInt(process.env.DB_MIN_POOL_SIZE || '2', 10);
  
  if (minPool > maxPool) {
    throw new Error('Minimum pool size cannot be greater than maximum pool size');
  }
};

// Validate configuration before creating the config object
validateDatabaseConfig();

/**
 * Comprehensive database configuration object
 */
export const databaseConfig = {
  mongodb: {
    uri: process.env.MONGODB_URI,
    dbName: process.env.MONGODB_DB_NAME || 'myelixir',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      retryWrites: true,
      w: 'majority',
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '10', 10),
      minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE || '2', 10),
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 60000,
      heartbeatFrequencyMS: 10000,
      replicaSet: process.env.MONGODB_REPLICA_SET,
      ssl: process.env.DB_SSL_ENABLED === 'true',
      authSource: 'admin',
      retryReads: true,
      // Enhanced monitoring options
      monitoring: true,
      monitorCommands: true
    } as mongoose.ConnectOptions
  } as MongoDBConfig,

  postgresql: {
    client: 'pg',
    connection: {
      host: process.env.PG_HOST,
      port: parseInt(process.env.PG_PORT || '5432', 10),
      database: process.env.PG_DATABASE,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      ssl: {
        rejectUnauthorized: false,
        ca: process.env.PG_SSL_CA,
        key: process.env.PG_SSL_KEY,
        cert: process.env.PG_SSL_CERT
      }
    },
    pool: {
      min: parseInt(process.env.DB_MIN_POOL_SIZE || '2', 10),
      max: parseInt(process.env.DB_MAX_POOL_SIZE || '10', 10),
      idleTimeoutMillis: 30000,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      createRetryIntervalMillis: 200
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: '../db/migrations',
      extension: 'ts',
      loadExtensions: ['.ts'],
      schemaName: 'public'
    },
    seeds: {
      directory: '../db/seeds',
      loadExtensions: ['.ts']
    },
    acquireConnectionTimeout: 60000,
    debug: process.env.NODE_ENV === 'development',
    // Query logging for development
    log: {
      warn: (message: string) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn(message);
        }
      },
      error: (message: string) => {
        console.error(message);
      },
      deprecate: (message: string) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Deprecated: ${message}`);
        }
      },
      debug: (message: string) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug(message);
        }
      }
    }
  } as PostgreSQLConfig
};

// Export individual configurations for specific use cases
export const mongoConfig = databaseConfig.mongodb;
export const postgresConfig = databaseConfig.postgresql;

// Export type definitions for use in other modules
export type { MongoDBConfig, PostgreSQLConfig };