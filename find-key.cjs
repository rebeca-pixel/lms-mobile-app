const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.ojqurkhomfjgtjctpdcl:Rebecasuji%4013@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    await client.connect();

    // Get JWT secret from vault or app settings
    const queries = [
      `SELECT current_setting('pgrst.jwt_secret', true) as val`,
      `SELECT current_setting('app.settings.jwt_secret', true) as val`,
      `SELECT current_setting('request.jwt.claim.role', true) as val`,
      `SELECT * FROM pg_catalog.pg_settings WHERE name LIKE '%jwt%'`,
    ];

    for (const q of queries) {
      try {
        const r = await client.query(q);
        console.log(`Query: ${q.substring(0, 60)}...`);
        console.log('Result:', JSON.stringify(r.rows, null, 2));
      } catch (e) {
        console.log(`Failed: ${q.substring(0, 60)}: ${e.message}`);
      }
    }

    // Try supabase_admin schema
    try {
      const r = await client.query(`SELECT * FROM supabase_functions.hooks LIMIT 1`);
      console.log('Hooks:', r.rows);
    } catch (e) {
      console.log('No supabase_functions.hooks:', e.message);
    }

    // Check vault
    try {
      const r = await client.query(`SELECT id, name, description FROM vault.secrets`);
      console.log('Vault secrets:', JSON.stringify(r.rows, null, 2));
    } catch (e) {
      console.log('No vault:', e.message);
    }

    // Check _supabase_internal
    try {
      const r = await client.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE '%supabase%'`);
      console.log('Supabase schemas:', r.rows);
    } catch (e) {
      console.log('Schema search failed:', e.message);
    }

    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
