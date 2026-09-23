require('dotenv').config();

const sharedConfiguration = {
  client: 'pg',
  connection: process.env.DB_CONNECTION_STRING,
  migrations: {
    directory: './migrations',
  },
};

module.exports = {
  development: sharedConfiguration,
  staging: sharedConfiguration,
  production: sharedConfiguration,
};
