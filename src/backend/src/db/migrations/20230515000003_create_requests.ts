import { Knex } from 'knex'; // ^2.4.0
import { RequestStatus } from '../../types/marketplace.types';

export async function up(knex: Knex): Promise<void> {
  // Create custom functions for validation and triggers
  await knex.raw(`
    CREATE OR REPLACE FUNCTION validate_filter_criteria(criteria JSONB)
    RETURNS BOOLEAN AS $$
    BEGIN
      RETURN (
        criteria ? 'resourceTypes' AND
        criteria ? 'demographics' AND
        criteria ? 'conditions' AND
        criteria ? 'dateRange' AND
        criteria ? 'privacyLevel'
      );
    END;
    $$ LANGUAGE plpgsql IMMUTABLE;

    CREATE OR REPLACE FUNCTION update_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION check_request_expiry()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.expires_at < CURRENT_TIMESTAMP THEN
        NEW.status = '${RequestStatus.EXPIRED}';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION create_audit_log()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        user_id,
        timestamp
      ) VALUES (
        'requests',
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END,
        current_setting('app.current_user_id', TRUE),
        CURRENT_TIMESTAMP
      );
      RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Create requests table
  await knex.schema.createTable('requests', (table) => {
    // Primary key and relationships
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('company_id').notNullable()
      .references('id').inTable('companies')
      .onDelete('CASCADE')
      .index();

    // Request metadata
    table.string('title', 255).notNullable();
    table.text('description').notNullable();
    table.jsonb('filter_criteria').notNullable()
      .checkConstraint("validate_filter_criteria(filter_criteria) = true", 'valid_filter_criteria');

    // Pricing and quantity
    table.decimal('price_per_record', 10, 2).notNullable()
      .checkConstraint(`price_per_record >= 0.1`, 'min_price_check');
    table.integer('records_needed').notNullable()
      .checkConstraint('records_needed > 0', 'positive_records_needed');

    // Status and timestamps
    table.enum('status', Object.values(RequestStatus))
      .notNullable()
      .defaultTo(RequestStatus.DRAFT)
      .index();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable()
      .checkConstraint(
        `expires_at > created_at AND 
         expires_at <= created_at + interval '30 days'`,
        'valid_expiry_date'
      );

    // Compliance and security
    table.string('compliance_level').notNullable();
    table.jsonb('audit_trail').notNullable().defaultTo('[]');
  });

  // Create indexes for performance optimization
  await knex.raw(`
    CREATE INDEX idx_requests_status_expires ON requests (status, expires_at);
    CREATE INDEX idx_requests_filter_criteria ON requests USING gin (filter_criteria);
    CREATE INDEX idx_requests_company_status ON requests (company_id, status);
  `);

  // Add triggers
  await knex.raw(`
    CREATE TRIGGER update_requests_timestamp
    BEFORE UPDATE ON requests
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

    CREATE TRIGGER check_requests_expiry
    BEFORE INSERT OR UPDATE ON requests
    FOR EACH ROW
    EXECUTE FUNCTION check_request_expiry();

    CREATE TRIGGER audit_requests_changes
    AFTER INSERT OR UPDATE OR DELETE ON requests
    FOR EACH ROW
    EXECUTE FUNCTION create_audit_log();
  `);

  // Add row-level security policies
  await knex.raw(`
    ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

    CREATE POLICY requests_company_access ON requests
    FOR ALL
    TO authenticated_users
    USING (
      company_id IN (
        SELECT id FROM companies 
        WHERE id = current_setting('app.current_company_id', TRUE)::uuid
      )
    );

    CREATE POLICY requests_admin_access ON requests
    FOR ALL
    TO admin_users
    USING (TRUE);
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Remove triggers
  await knex.raw(`
    DROP TRIGGER IF EXISTS update_requests_timestamp ON requests;
    DROP TRIGGER IF EXISTS check_requests_expiry ON requests;
    DROP TRIGGER IF EXISTS audit_requests_changes ON requests;
  `);

  // Remove functions
  await knex.raw(`
    DROP FUNCTION IF EXISTS validate_filter_criteria(JSONB);
    DROP FUNCTION IF EXISTS update_timestamp();
    DROP FUNCTION IF EXISTS check_request_expiry();
    DROP FUNCTION IF EXISTS create_audit_log();
  `);

  // Remove policies
  await knex.raw(`
    DROP POLICY IF EXISTS requests_company_access ON requests;
    DROP POLICY IF EXISTS requests_admin_access ON requests;
  `);

  // Drop table
  await knex.schema.dropTableIfExists('requests');
}