const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.ojqurkhomfjgtjctpdcl:Rebecasuji%4013@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    await client.connect();

    // Get employees columns
    const r1 = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'employees' ORDER BY ordinal_position`);
    console.log('employees columns:', JSON.stringify(r1.rows, null, 2));

    // Sample employees
    const r2 = await client.query(`SELECT * FROM employees LIMIT 5`);
    console.log('Sample employees:', JSON.stringify(r2.rows, null, 2));

    // Count employees
    const r3 = await client.query(`SELECT COUNT(*) as cnt FROM employees`);
    console.log('Total employees:', r3.rows[0].cnt);

    // Check grants on employees
    const r4 = await client.query(`SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = 'employees' AND table_schema = 'public' AND grantee = 'anon'`);
    console.log('Anon grants on employees:', JSON.stringify(r4.rows, null, 2));

    // Get JWT secret for Supabase key generation
    const r5 = await client.query(`SELECT current_setting('app.settings.jwt_secret', true) as jwt_secret`);
    console.log('JWT secret:', r5.rows[0].jwt_secret);

    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
