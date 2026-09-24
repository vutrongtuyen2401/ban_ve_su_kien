exports.up = async function (knex) {
  await knex.schema.alterTable('events', function (table) {
    table.string('venue', 255).nullable();
    table.string('status', 30).notNullable().defaultTo('draft');
    table.integer('owner_id').unsigned().nullable().references('id').inTable('users').onDelete('RESTRICT');
  });

  const [{ count }] = await knex('events').count('* as count');
  if (Number(count) > 0) {
    throw new Error('Không thể tự gán chủ sở hữu cho dữ liệu events cũ. Hãy dọn dữ liệu thử hoặc gán owner_id trước khi chạy lại migration.');
  }

  await knex.schema.alterTable('events', function (table) {
    table.text('description').notNullable().alter();
    table.string('venue', 255).notNullable().alter();
    table.integer('owner_id').unsigned().notNullable().alter();
    table.dropColumn('price');
    table.dropColumn('total_tickets');
    table.index(['owner_id', 'status']);
  });

  await knex.schema.createTable('showtimes', function (table) {
    table.increments('id').primary();
    table.integer('event_id').unsigned().notNullable().references('id').inTable('events').onDelete('CASCADE');
    table.timestamp('starts_at', { useTz: true }).notNullable();
    table.timestamp('ends_at', { useTz: true }).nullable();
    table.string('room_name', 150).nullable();
    table.timestamps(true, true);

    // Không tạo UNIQUE theo thời gian: cùng sự kiện có thể diễn song song ở hai phòng.
    table.index(['event_id', 'starts_at']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('showtimes');
  await knex.schema.alterTable('events', function (table) {
    table.decimal('price', 10, 2).notNullable().defaultTo(0);
    table.integer('total_tickets').notNullable().defaultTo(0);
    table.dropIndex(['owner_id', 'status']);
    table.dropColumn('owner_id');
    table.dropColumn('status');
    table.dropColumn('venue');
  });
  await knex.raw('ALTER TABLE events ALTER COLUMN price DROP DEFAULT, ALTER COLUMN total_tickets DROP DEFAULT');
};
