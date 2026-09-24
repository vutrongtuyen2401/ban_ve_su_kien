exports.up = async function (knex) {
  // Không làm mất dữ liệu của schema sự kiện đời đầu. Bảng này có thể được đối soát/chuyển đổi riêng.
  if (await knex.schema.hasTable('events')) await knex.schema.renameTable('events', 'legacy_events');
  await knex.schema.createTable('events', (table) => {
    table.increments('id').primary();
    table.integer('owner_id').unsigned().notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.string('title', 255).notNullable();
    table.text('description').nullable();
    table.string('venue', 255).notNullable();
    table.string('status', 30).notNullable().defaultTo('draft');
    table.timestamps(true, true);
    table.index(['owner_id', 'status']);
  });
  await knex.schema.createTable('showtimes', (table) => {
    table.increments('id').primary();
    table.integer('event_id').unsigned().notNullable().references('id').inTable('events').onDelete('CASCADE');
    table.timestamp('starts_at', { useTz: true }).notNullable();
    table.string('room_name', 150).nullable();
    table.timestamps(true, true);
    table.index(['event_id', 'starts_at']);
  });
};
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('showtimes');
  await knex.schema.dropTableIfExists('events');
  if (await knex.schema.hasTable('legacy_events')) await knex.schema.renameTable('legacy_events', 'events');
};
