exports.up = function (knex) {
  return knex.schema.createTable('users', function (table) {
    table.increments('id').primary();
    table.string('email', 320).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('full_name', 150).notNullable();
    table.string('role', 30).notNullable().defaultTo('buyer');
    table.boolean('is_active').notNullable().defaultTo(false);
    table.timestamp('email_verified_at', { useTz: true }).nullable();
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('users');
};
