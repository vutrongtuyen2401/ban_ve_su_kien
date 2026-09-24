exports.up = async function (knex) {
  await knex.schema.createTable('user_sessions', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('token_hash', 64).notNullable().unique();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['user_id', 'expires_at']);
  });
  await knex.schema.createTable('seats', (table) => {
    table.increments('id').primary();
    table.string('seat_code', 30).notNullable();
    table.string('row_label', 10).notNullable();
    table.integer('seat_number').unsigned().notNullable();
    table.string('area', 100).nullable();
    table.timestamps(true, true);
  });
  await knex.schema.createTable('showtime_seats', (table) => {
    table.increments('id').primary();
    table.integer('showtime_id').unsigned().notNullable().references('id').inTable('showtimes').onDelete('CASCADE');
    table.integer('seat_id').unsigned().notNullable().references('id').inTable('seats').onDelete('CASCADE');
    table.string('status', 20).notNullable().defaultTo('AVAILABLE');
    table.timestamps(true, true);
    table.unique(['showtime_id', 'seat_id']);
    table.index(['showtime_id', 'status']);
    table.index(['seat_id']);
  });
  await knex.schema.createTable('seat_holds', (table) => {
    table.increments('id').primary();
    table.integer('showtime_seat_id').unsigned().notNullable().references('id').inTable('showtime_seats').onDelete('CASCADE').unique();
    table.integer('showtime_id').unsigned().notNullable().references('id').inTable('showtimes').onDelete('CASCADE');
    table.integer('seat_id').unsigned().notNullable().references('id').inTable('seats').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('status', 20).notNullable().defaultTo('ACTIVE');
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['showtime_id', 'seat_id']);
    table.index(['expires_at', 'status']);
    table.index(['user_id', 'status']);
  });
  await knex.raw("ALTER TABLE showtime_seats ADD CONSTRAINT showtime_seats_status_check CHECK (status IN ('AVAILABLE','HELD','SOLD'))");
  await knex.raw("ALTER TABLE seat_holds ADD CONSTRAINT seat_holds_status_check CHECK (status IN ('ACTIVE','EXPIRED','RELEASED','CONVERTED'))");
};
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('seat_holds');
  await knex.schema.dropTableIfExists('showtime_seats');
  await knex.schema.dropTableIfExists('seats');
  await knex.schema.dropTableIfExists('user_sessions');
};
