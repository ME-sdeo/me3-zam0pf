/**
 * @file Initial database schema migration for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Establishes foundational database structure with enhanced security and compliance features
 */

import { Knex } from 'knex'; // ^2.4.0
import { postgresql } from '../../config/database.config';

// Enum type definitions
const USER_ROLES = ['CONSUMER', 'COMPANY', 'ADMIN', 'SYSTEM'] as const;
const USER_STATUS = ['ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED'] as const;
const REQUEST_STATUS = ['DRAFT', 'ACTIVE', 'MATCHED', 'COMPLETED', 'CANCELLED'] as const;
const CONSENT_STATUS = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED'] as const;

export async function up(knex: Knex): Promise<void> {
  // Enable required PostgreSQL extensions
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pg_audit"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "unaccent"');

  // Create custom ENUM types
  await knex.raw(`CREATE TYPE user_role AS ENUM (${USER_ROLES.map(role => `'${role}'`).join(', ')})`);
  await knex.raw(`CREATE TYPE user_status AS ENUM (${USER_STATUS.map(status => `'${status}'`).join(', ')})`);
  await knex.raw(`CREATE TYPE request_status AS ENUM (${REQUEST_STATUS.map(status => `'${status}'`).join(', ')})`);
  await knex.raw(`CREATE TYPE consent_status AS ENUM (${CONSENT_STATUS.map(status => `'${status}'`).join(', ')})`);

  // Create users table
  await knex.schema.createTable('users', table => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('email').unique().notNullable();
    table.specificType('role', 'user_role').notNullable();
    table.specificType('status', 'user_status').notNullable().defaultTo('PENDING');
    table.binary('encrypted_password').notNullable();
    table.jsonb('profile').notNullable().defaultTo('{}');
    table.timestamps(true, true);
    table.timestamp('deleted_at');

    // Add indexes
    table.index(['email']);
    table.index(['role']);
    table.index(['status']);
    table.index(['deleted_at']);
  });

  // Create health_records table
  await knex.schema.createTable('health_records', table => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('fhir_id').notNullable();
    table.string('resource_type').notNullable();
    table.jsonb('metadata').notNullable();
    table.binary('encrypted_content').notNullable();
    table.timestamps(true, true);
    table.timestamp('deleted_at');

    // Add indexes
    table.index(['user_id']);
    table.index(['fhir_id']);
    table.index(['resource_type']);
    table.index(['deleted_at']);
  });

  // Create data_requests table
  await knex.schema.createTable('data_requests', table => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('company_id').references('id').inTable('users').onDelete('CASCADE');
    table.specificType('status', 'request_status').notNullable().defaultTo('DRAFT');
    table.jsonb('filter_criteria').notNullable();
    table.decimal('compensation_amount', 10, 2).notNullable();
    table.integer('records_needed').notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamps(true, true);
    table.timestamp('deleted_at');

    // Add indexes
    table.index(['company_id']);
    table.index(['status']);
    table.index(['expires_at']);
    table.index(['deleted_at']);
  });

  // Create consent_records table
  await knex.schema.createTable('consent_records', table => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('request_id').references('id').inTable('data_requests').onDelete('CASCADE');
    table.specificType('status', 'consent_status').notNullable().defaultTo('PENDING');
    table.jsonb('permissions').notNullable();
    table.timestamp('valid_from').notNullable();
    table.timestamp('valid_to').notNullable();
    table.string('blockchain_reference').notNullable();
    table.timestamps(true, true);
    table.timestamp('deleted_at');

    // Add indexes
    table.index(['user_id']);
    table.index(['request_id']);
    table.index(['status']);
    table.index(['valid_from', 'valid_to']);
    table.index(['deleted_at']);
  });

  // Create audit_logs table
  await knex.schema.createTable('audit_logs', table => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').references('id').inTable('users');
    table.string('action').notNullable();
    table.string('resource_type').notNullable();
    table.uuid('resource_id').notNullable();
    table.jsonb('changes').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.inet('ip_address');
    table.string('user_agent');

    // Add indexes
    table.index(['user_id']);
    table.index(['action']);
    table.index(['resource_type', 'resource_id']);
    table.index(['created_at']);
  });

  // Set up row-level security policies
  await knex.raw(`
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
    ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;
    ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
  `);

  // Create audit triggers
  await knex.raw(`
    CREATE OR REPLACE FUNCTION audit_trigger_func()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        changes,
        ip_address,
        user_agent
      )
      VALUES (
        current_setting('app.current_user_id')::uuid,
        TG_OP,
        TG_TABLE_NAME,
        NEW.id,
        jsonb_build_object(
          'old_value', CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
          'new_value', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW) END
        ),
        current_setting('app.client_ip')::inet,
        current_setting('app.user_agent')
      );
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Apply audit triggers to tables
  const auditedTables = ['users', 'health_records', 'data_requests', 'consent_records'];
  for (const table of auditedTables) {
    await knex.raw(`
      CREATE TRIGGER ${table}_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop audit triggers
  const auditedTables = ['users', 'health_records', 'data_requests', 'consent_records'];
  for (const table of auditedTables) {
    await knex.raw(`DROP TRIGGER IF EXISTS ${table}_audit_trigger ON ${table}`);
  }

  // Drop audit trigger function
  await knex.raw('DROP FUNCTION IF EXISTS audit_trigger_func() CASCADE');

  // Drop tables
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('consent_records');
  await knex.schema.dropTableIfExists('data_requests');
  await knex.schema.dropTableIfExists('health_records');
  await knex.schema.dropTableIfExists('users');

  // Drop custom ENUM types
  await knex.raw('DROP TYPE IF EXISTS consent_status');
  await knex.raw('DROP TYPE IF EXISTS request_status');
  await knex.raw('DROP TYPE IF EXISTS user_status');
  await knex.raw('DROP TYPE IF EXISTS user_role');

  // Drop extensions
  await knex.raw('DROP EXTENSION IF EXISTS unaccent');
  await knex.raw('DROP EXTENSION IF EXISTS fuzzystrmatch');
  await knex.raw('DROP EXTENSION IF EXISTS pg_trgm');
  await knex.raw('DROP EXTENSION IF EXISTS pg_audit');
  await knex.raw('DROP EXTENSION IF EXISTS pg_stat_statements');
  await knex.raw('DROP EXTENSION IF EXISTS pgcrypto');
  await knex.raw('DROP EXTENSION IF EXISTS "uuid-ossp"');
}