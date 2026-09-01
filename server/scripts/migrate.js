require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');

pool
  .query(sql)
  .then(() => {
    console.log('Migration applied.');
    return pool.end();
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });