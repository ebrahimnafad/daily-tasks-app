const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => client.end());
