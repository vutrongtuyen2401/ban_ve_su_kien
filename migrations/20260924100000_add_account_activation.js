exports.up = async function (knex) {
  await knex.schema.alterTable('users', function (table) {
    table.timestamp('email_verified_at', { useTz: true }).nullable();
  });
  await knex.raw('ALTER TABLE users ALTER COLUMN is_active SET DEFAULT false');

  await knex.schema.createTable('account_activation_tokens', function (table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('token_hash', 64).notNullable().unique();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('used_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['user_id']);
    table.index(['expires_at']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('account_activation_tokens');
  await knex.schema.alterTable('users', function (table) {
    table.dropColumn('email_verified_at');
  });
  await knex.raw('ALTER TABLE users ALTER COLUMN is_active SET DEFAULT true');
};
