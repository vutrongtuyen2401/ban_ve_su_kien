exports.up = function (knex) {
  return knex.schema.createTable('email_delivery_attempts', function (table) {
    table.increments('id').primary();
    table.string('recipient_hash', 64).notNullable();
    table.string('purpose', 50).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['recipient_hash', 'purpose', 'created_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('email_delivery_attempts');
};
