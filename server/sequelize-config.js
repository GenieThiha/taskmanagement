module.exports = {
  development: {
    username: 'tma',
    password: 'tma',
    database: 'tma_dev',
    host: 'localhost',
    port: 5433,
    dialect: 'postgres',
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
  }
};
