import { Knex } from 'knex';
import { CompanyType } from '../../interfaces/company.interface';
import crypto from 'crypto';

// Encryption helper functions
const ENCRYPTION_KEY = process.env.COMPANY_ENCRYPTION_KEY || '';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

export async function up(knex: Knex): Promise<void> {
  // Enable UUID generation
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Create companies table
  await knex.schema.createTable('companies', (table) => {
    // Primary key and identification
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name').notNullable().unique();
    table.specificType('encrypted_email', 'bytea').notNullable();
    table.specificType('email_iv', 'bytea').notNullable();
    
    // Company classification
    table.enum('type', Object.values(CompanyType)).notNullable();
    table.enum('status', ['ACTIVE', 'INACTIVE', 'SUSPENDED']).notNullable().defaultTo('INACTIVE');
    table.string('status_reason');
    table.timestamp('status_updated_at');

    // Verification fields
    table.boolean('is_verified').notNullable().defaultTo(false);
    table.timestamp('verification_date');
    table.jsonb('verification_documents');
    table.enum('verification_status', ['PENDING', 'VERIFIED', 'REJECTED']).notNullable().defaultTo('PENDING');

    // Encrypted contact information
    table.specificType('encrypted_phone', 'bytea');
    table.specificType('phone_iv', 'bytea');
    table.specificType('encrypted_website', 'bytea');
    table.specificType('website_iv', 'bytea');

    // Address information
    table.string('street').notNullable();
    table.string('city').notNullable();
    table.string('state').notNullable();
    table.string('country').notNullable();
    table.string('postal_code').notNullable();

    // Compliance and certification data
    table.jsonb('certifications').notNullable().defaultTo('[]');
    table.string('compliance_officer').notNullable();
    table.specificType('encrypted_compliance_email', 'bytea').notNullable();
    table.specificType('compliance_email_iv', 'bytea').notNullable();

    // Encrypted billing information
    table.specificType('encrypted_billing_info', 'bytea');
    table.specificType('billing_info_iv', 'bytea');
    table.string('tax_id').notNullable();

    // Audit fields
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').notNullable();
    table.uuid('updated_by').notNullable();
    table.timestamp('last_verified_at');
  });

  // Create indexes
  await knex.schema.raw(`
    CREATE INDEX idx_companies_name ON companies (name);
    CREATE INDEX idx_companies_status ON companies (status);
    CREATE INDEX idx_companies_type ON companies (type);
    CREATE INDEX idx_companies_verification_status ON companies (verification_status);
    CREATE INDEX idx_companies_certifications ON companies USING gin (certifications);
  `);

  // Create audit trigger function
  await knex.schema.raw(`
    CREATE OR REPLACE FUNCTION company_audit_trigger_func()
    RETURNS trigger AS $body$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      
      INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        old_values,
        new_values,
        user_id,
        timestamp
      ) VALUES (
        'companies',
        NEW.id,
        TG_OP,
        row_to_json(OLD),
        row_to_json(NEW),
        NEW.updated_by,
        CURRENT_TIMESTAMP
      );
      
      RETURN NEW;
    END;
    $body$ LANGUAGE plpgsql;
  `);

  // Create audit trigger
  await knex.schema.raw(`
    CREATE TRIGGER company_audit_trigger
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION company_audit_trigger_func();
  `);

  // Create row-level security policies
  await knex.schema.raw(`
    ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY company_access_policy ON companies
    USING (
      (current_user = 'admin') OR
      (created_by = current_user_id()) OR
      (status = 'ACTIVE' AND is_verified = true)
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Remove triggers
  await knex.schema.raw('DROP TRIGGER IF EXISTS company_audit_trigger ON companies');
  await knex.schema.raw('DROP FUNCTION IF EXISTS company_audit_trigger_func()');

  // Remove policies
  await knex.schema.raw('DROP POLICY IF EXISTS company_access_policy ON companies');

  // Drop indexes
  await knex.schema.raw(`
    DROP INDEX IF EXISTS idx_companies_name;
    DROP INDEX IF EXISTS idx_companies_status;
    DROP INDEX IF EXISTS idx_companies_type;
    DROP INDEX IF EXISTS idx_companies_verification_status;
    DROP INDEX IF EXISTS idx_companies_certifications;
  `);

  // Drop table
  await knex.schema.dropTableIfExists('companies');
}