require('dotenv').config();

const config = {
  client: 'pg',
  connection: process.env.DB_CONNECTION_STRING,
  migrations: {
    directory: './migrations',
  },
};

module.exports = {
  development: config,
  test: config,
  staging: config,
  production: config,
};
