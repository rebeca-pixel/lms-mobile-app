const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.ojqurkhomfjgtjctpdcl:Rebecasuji%4013@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    await client.connect();
    console.log('Connected!');

    // Check public tables
    const r1 = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
    console.log('Public tables:', r1.rows.map(r => r.table_name));

    // Check attendance_logs columns
    const r2 = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'attendance_logs' ORDER BY ordinal_position`);
    console.log('attendance_logs columns:', JSON.stringify(r2.rows, null, 2));

    // Get a few sample records
    const r3 = await client.query(`SELECT * FROM attendance_logs ORDER BY punch_time DESC LIMIT 5`);
    console.log('Sample records:', JSON.stringify(r3.rows, null, 2));

    // Check if there's an employees table
    const r4 = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%emp%'`);
    console.log('Employee-like tables:', r4.rows);

    // Check today's records
    const today = new Date().toISOString().split('T')[0];
    const r5 = await client.query(`SELECT COUNT(*) as cnt FROM attendance_logs WHERE DATE(punch_time) = $1`, [today]);
    console.log('Today records count:', r5.rows[0].cnt);

    // Check distinct dates available 
    const r6 = await client.query(`SELECT DISTINCT DATE(punch_time) as d FROM attendance_logs ORDER BY d DESC LIMIT 10`);
    console.log('Available dates:', r6.rows);

    // Check RLS policies on attendance_logs
    const r7 = await client.query(`SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = 'attendance_logs' AND table_schema = 'public'`);
    console.log('Grants on attendance_logs:', JSON.stringify(r7.rows, null, 2));

    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
