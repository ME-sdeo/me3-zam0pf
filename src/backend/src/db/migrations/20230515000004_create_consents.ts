/**
 * @file Database migration for consents table in MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Creates the consents table for managing data sharing permissions between users and companies
 */

import { Knex } from 'knex'; // ^2.4.0
import { databaseConfig } from '../../config/database.config';

/**
 * Creates the consents table and related database objects
 * @param knex - Knex instance for database operations
 */
export async function up(knex: Knex): Promise<void> {
  // Ensure the database connection is properly configured
  if (!databaseConfig.postgresql) {
    throw new Error('PostgreSQL configuration is missing');
  }

  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Create enum type for consent status
  await knex.raw(`
    CREATE TYPE consent_status AS ENUM (
      'PENDING',
      'ACTIVE',
      'REVOKED',
      'EXPIRED'
    )
  `);

  // Create consents table
  await knex.schema.createTable('consents', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));

    // Foreign keys
    table.uuid('user_id').notNullable().references('id').inTable('users')
      .onDelete('CASCADE').onUpdate('CASCADE');
    table.uuid('company_id').notNullable().references('id').inTable('companies')
      .onDelete('CASCADE').onUpdate('CASCADE');
    table.uuid('request_id').notNullable().references('id').inTable('requests')
      .onDelete('CASCADE').onUpdate('CASCADE');

    // Permissions and blockchain data
    table.jsonb('permissions').notNullable().comment(
      'JSON structure containing resource types, access levels, and data elements'
    );
    table.string('blockchain_ref', 255).notNullable().comment(
      'Reference to consent record in Hyperledger Fabric'
    );

    // Validity period
    table.timestamp('valid_from', { useTz: true }).notNullable();
    table.timestamp('valid_to', { useTz: true }).notNullable();

    // Status and timestamps
    table.specificType('status', 'consent_status').notNullable().defaultTo('PENDING');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Check constraint for validity period
    table.check('?? > ??', ['valid_to', 'valid_from'], 'chk_consents_valid_dates');
  });

  // Create indexes for performance optimization
  await knex.schema.alterTable('consents', (table) => {
    // Single column indexes
    table.index('user_id', 'idx_consents_user_id');
    table.index('company_id', 'idx_consents_company_id');
    table.index('request_id', 'idx_consents_request_id');
    table.index('status', 'idx_consents_status');
    table.index('blockchain_ref', 'idx_consents_blockchain_ref');

    // Composite indexes
    table.index(['user_id', 'status'], 'idx_consents_user_status');
    table.index(['valid_from', 'valid_to'], 'idx_consents_valid_dates');
  });

  // Create GIN index for JSONB permissions column
  await knex.raw(`
    CREATE INDEX idx_consents_permissions ON consents 
    USING GIN (permissions jsonb_path_ops)
  `);

  // Create trigger for updating updated_at timestamp
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_consents_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    CREATE TRIGGER trigger_consents_updated_at
      BEFORE UPDATE ON consents
      FOR EACH ROW
      EXECUTE FUNCTION update_consents_updated_at();
  `);
}

/**
 * Removes the consents table and related database objects
 * @param knex - Knex instance for database operations
 */
export async function down(knex: Knex): Promise<void> {
  // Drop triggers first
  await knex.raw('DROP TRIGGER IF EXISTS trigger_consents_updated_at ON consents');
  await knex.raw('DROP FUNCTION IF EXISTS update_consents_updated_at');

  // Drop indexes
  await knex.schema.alterTable('consents', (table) => {
    table.dropIndex([], 'idx_consents_user_id');
    table.dropIndex([], 'idx_consents_company_id');
    table.dropIndex([], 'idx_consents_request_id');
    table.dropIndex([], 'idx_consents_status');
    table.dropIndex([], 'idx_consents_blockchain_ref');
    table.dropIndex([], 'idx_consents_user_status');
    table.dropIndex([], 'idx_consents_valid_dates');
    table.dropIndex([], 'idx_consents_permissions');
  });

  // Drop table
  await knex.schema.dropTableIfExists('consents');

  // Drop enum type
  await knex.raw('DROP TYPE IF EXISTS consent_status');
}