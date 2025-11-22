const { Client } = require('pg');

// Connection string from run_schema.js
const connectionString = 'postgresql://postgres:nirjar1012@db.coltelqkiuklexqxfoqp.supabase.co:5432/postgres';

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected.');

        const sql = `
            ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name text;
            ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name text;
            ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_at timestamp with time zone default now();
            
            -- Refresh schema cache (Supabase sometimes needs this, though usually automatic)
            NOTIFY pgrst, 'reload config';
        `;

        console.log('Executing migration SQL...');
        await client.query(sql);
        console.log('Migration completed successfully!');
    } catch (err) {
        console.error('Error running migration:', err);
    } finally {
        await client.end();
    }
}

run();
