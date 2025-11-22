const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Connection string provided by user
const connectionString = 'postgresql://postgres:nirjar1012@db.coltelqkiuklexqxfoqp.supabase.co:5432/postgres';

const client = new Client({
    connectionString: connectionString,
});

async function run() {
    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected.');

        const sqlPath = path.join(__dirname, '../fix_columns.sql');
        console.log(`Reading SQL from ${sqlPath}`);
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL...');
        await client.query(sql);
        console.log('Schema updated successfully!');
    } catch (err) {
        console.error('Error updating schema:', err);
    } finally {
        await client.end();
    }
}

run();
