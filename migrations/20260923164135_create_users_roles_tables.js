const argon2 = require('argon2');

exports.up = async function(knex) {
  await knex.schema.createTable('roles', function(table) {
    table.increments('id').primary();
    table.string('name').notNullable().unique();
  });

  await knex.schema.createTable('users', function(table) {
    table.increments('id').primary();
    table.string('email').notNullable().unique();
    table.string('password_hash').notNullable();
    table.string('full_name').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('user_roles', function(table) {
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.integer('role_id').unsigned().references('id').inTable('roles').onDelete('CASCADE');
    table.primary(['user_id', 'role_id']);
  });

  // Seed data
  const roles = [
    { name: 'admin' },
    { name: 'organizer' },
    { name: 'ticket_checker' },
    { name: 'accountant' },
    { name: 'buyer' }
  ];
  await knex('roles').insert(roles);

  const defaultPassword = await argon2.hash('12345678');
  
  const [adminUser] = await knex('users').insert({
    email: 'admin@example.com',
    password_hash: defaultPassword,
    full_name: 'Admin Demo'
  }).returning('id');

  const [organizerUser] = await knex('users').insert({
    email: 'organizer@example.com',
    password_hash: defaultPassword,
    full_name: 'Organizer Demo'
  }).returning('id');

  const adminRole = await knex('roles').where('name', 'admin').first();
  const organizerRole = await knex('roles').where('name', 'organizer').first();

  await knex('user_roles').insert([
    { user_id: adminUser.id || adminUser, role_id: adminRole.id },
    { user_id: organizerUser.id || organizerUser, role_id: organizerRole.id }
  ]);
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('user_roles');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('roles');
};
