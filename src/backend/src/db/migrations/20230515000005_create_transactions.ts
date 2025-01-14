import { Knex } from 'knex'; // ^2.4.0

export async function up(knex: Knex): Promise<void> {
  // Create payment method enum type
  await knex.raw(`
    CREATE TYPE payment_method_enum AS ENUM (
      'CREDIT_CARD',
      'DEBIT_CARD',
      'BANK_TRANSFER'
    )
  `);

  // Create transaction status enum type
  await knex.raw(`
    CREATE TYPE transaction_status_enum AS ENUM (
      'INITIATED',
      'PROCESSING',
      'COMPLETED',
      'FAILED'
    )
  `);

  // Create transactions table
  await knex.schema.createTable('transactions', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));

    // Foreign key references
    table.uuid('request_id')
      .notNullable()
      .references('id')
      .inTable('data_requests')
      .onDelete('CASCADE');
    
    table.uuid('provider_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    
    table.uuid('company_id')
      .notNullable()
      .references('id')
      .inTable('companies')
      .onDelete('RESTRICT');

    // Resource tracking
    table.specificType('resource_ids', 'uuid[]').notNullable();

    // Payment details
    table.decimal('amount', 10, 2).notNullable();
    table.specificType('payment_method', 'payment_method_enum').notNullable();
    table.specificType('status', 'transaction_status_enum')
      .notNullable()
      .defaultTo('INITIATED');
    
    // External references
    table.string('payment_intent_id', 100).unique();
    table.string('blockchain_ref', 100).unique();

    // Audit timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('completed_at');

    // Indexes for performance optimization
    table.index('request_id', 'idx_transactions_request_id');
    table.index('provider_id', 'idx_transactions_provider_id');
    table.index('company_id', 'idx_transactions_company_id');
    table.index('status', 'idx_transactions_status');
    table.index('created_at', 'idx_transactions_created_at');
  });

  // Create partial index for active transactions
  await knex.raw(`
    CREATE INDEX idx_transactions_active 
    ON transactions (created_at) 
    WHERE status IN ('INITIATED', 'PROCESSING')
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop table and cleanup
  await knex.schema.dropTableIfExists('transactions');
  
  // Drop custom enum types
  await knex.raw('DROP TYPE IF EXISTS payment_method_enum');
  await knex.raw('DROP TYPE IF EXISTS transaction_status_enum');
}