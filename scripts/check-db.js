// load pg from server dependencies
// eslint-disable-next-line global-require, import/no-dynamic-require
const { Client } = require('../server/node_modules/pg');

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'concert_app',
  });

  try {
    await client.connect();
    console.log('connected');
  } catch (error) {
    console.error('error connecting:', error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

void main();

