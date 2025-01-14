import { Knex } from 'knex'; // version: ^2.4.0
import { UserRole, UserStatus } from '../../interfaces/user.interface';

// Table name constant for consistency
const TABLE_NAME = 'users';

// Schema validation constants
const EMAIL_REGEX = '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$';

// JSON schema for profile validation
const PROFILE_SCHEMA = {
  type: 'object',
  required: ['firstName', 'lastName', 'dateOfBirth', 'phone', 'address'],
  properties: {
    firstName: { type: 'string', minLength: 1 },
    lastName: { type: 'string', minLength: 1 },
    dateOfBirth: { type: 'string', format: 'date' },
    phone: { type: 'string', pattern: '^\\+?[1-9]\\d{1,14}$' },
    address: { type: 'string', minLength: 1 }
  }
};

// JSON schema for auth_info validation
const AUTH_INFO_SCHEMA = {
  type: 'object',
  required: ['userId', 'email', 'mfaEnabled', 'mfaMethod', 'lastLogin'],
  properties: {
    userId: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    mfaEnabled: { type: 'boolean' },
    mfaMethod: { type: 'string', enum: ['AUTHENTICATOR', 'SMS', 'EMAIL'] },
    lastLogin: { type: 'string', format: 'date-time' }
  }
};

// JSON schema for preferences validation
const PREFERENCES_SCHEMA = {
  type: 'object',
  required: ['notificationPreferences', 'dataVisibility', 'defaultConsentDuration'],
  properties: {
    notificationPreferences: { type: 'array', items: { type: 'string' } },
    dataVisibility: { type: 'array', items: { type: 'string' } },
    defaultConsentDuration: { type: 'integer', minimum: 1 }
  }
};

export async function up(knex: Knex): Promise<void> {
  // Create custom types first
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM (${Object.values(UserRole).map(role => `'${role}'`).join(', ')});
      CREATE TYPE user_status AS ENUM (${Object.values(UserStatus).map(status => `'${status}'`).join(', ')});
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create the users table
  await knex.schema.createTable(TABLE_NAME, (table) => {
    // Primary key and identification
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email').unique().notNullable().checkRegex(EMAIL_REGEX);
    
    // Role and status
    table.specificType('role', 'user_role').notNullable();
    table.specificType('status', 'user_status').notNullable().defaultTo('PENDING_VERIFICATION');
    
    // Encryption support
    table.uuid('encryption_key_id').references('id').inTable('encryption_keys');
    table.jsonb('encrypted_fields').notNullable().defaultTo('{}');
    
    // Profile and settings
    table.jsonb('profile').notNullable().checkJsonSchema(PROFILE_SCHEMA);
    table.jsonb('auth_info').notNullable().checkJsonSchema(AUTH_INFO_SCHEMA);
    table.jsonb('preferences').notNullable().checkJsonSchema(PREFERENCES_SCHEMA);
    
    // Audit columns
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').notNullable();
    table.uuid('updated_by').notNullable();
  });

  // Create indexes
  await knex.schema.raw(`
    -- Composite index for role-based queries
    CREATE INDEX idx_users_role_status ON ${TABLE_NAME} (role, status);
    
    -- Case-insensitive email index
    CREATE INDEX idx_users_email ON ${TABLE_NAME} (lower(email));
    
    -- Partial index for active users
    CREATE INDEX idx_users_active ON ${TABLE_NAME} (id) WHERE status = 'ACTIVE';
    
    -- Create updated_at trigger
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';
    
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON ${TABLE_NAME}
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
      
    -- Create audit trigger
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME}_audit (
      id uuid DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      action varchar(10) NOT NULL,
      old_data jsonb,
      new_data jsonb,
      changed_by uuid NOT NULL,
      changed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE OR REPLACE FUNCTION audit_users_changes()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO ${TABLE_NAME}_audit (
        user_id, action, old_data, new_data, changed_by
      ) VALUES (
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        to_jsonb(OLD),
        to_jsonb(NEW),
        COALESCE(NEW.updated_by, OLD.updated_by)
      );
      RETURN NULL;
    END;
    $$ language 'plpgsql';
    
    CREATE TRIGGER audit_users_trigger
      AFTER INSERT OR UPDATE OR DELETE ON ${TABLE_NAME}
      FOR EACH ROW EXECUTE FUNCTION audit_users_changes();
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop triggers first
  await knex.raw(`
    DROP TRIGGER IF EXISTS audit_users_trigger ON ${TABLE_NAME};
    DROP TRIGGER IF EXISTS update_users_updated_at ON ${TABLE_NAME};
    DROP FUNCTION IF EXISTS audit_users_changes();
    DROP FUNCTION IF EXISTS update_updated_at_column();
  `);

  // Drop audit table
  await knex.schema.dropTableIfExists(`${TABLE_NAME}_audit`);

  // Drop main table
  await knex.schema.dropTableIfExists(TABLE_NAME);

  // Drop custom types
  await knex.raw(`
    DROP TYPE IF EXISTS user_role;
    DROP TYPE IF EXISTS user_status;
  `);
}