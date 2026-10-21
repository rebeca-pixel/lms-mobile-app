import { Plugin } from 'vite';
import pg from 'pg';

/**
 * Vite plugin that exposes a /api/payroll-attendance endpoint
 * during development. This queries the payroll PostgreSQL database
 * directly from the Vite dev server, avoiding CORS issues.
 *
 * For production builds (Capacitor), a similar endpoint must be
 * hosted on a backend server, or use a Supabase Edge Function.
 */
export function payrollApiPlugin(): Plugin {
  const PAYROLL_DB_URL =
    'postgresql://postgres.ojqurkhomfjgtjctpdcl:Rebecasuji%4013@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres';

  let pool: pg.Pool | null = null;

  function getPool(): pg.Pool {
    if (!pool) {
      pool = new pg.Pool({
        connectionString: PAYROLL_DB_URL,
        ssl: { rejectUnauthorized: false },
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    }
    return pool;
  }

  return {
    name: 'payroll-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Only handle /api/payroll-attendance
        if (!req.url?.startsWith('/api/payroll-attendance')) {
          return next();
        }

        const url = new URL(req.url, `http://${req.headers.host}`);
        const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

        res.setHeader('Content-Type', 'application/json');

        try {
          const db = getPool();

          // 1. Get active employees with employee_code
          const empResult = await db.query(
            `SELECT id, name, email, employee_code, department, designation, status
             FROM employees
             WHERE employee_code IS NOT NULL
             ORDER BY employee_code`
          );

          // 2. Get today's attendance punches grouped by employee
          // The punch_time is stored in UTC - we need IST (UTC+5:30)
          const punchResult = await db.query(
            `SELECT
               emp_code,
               MIN(punch_time) AS first_punch,
               MAX(punch_time) AS last_punch,
               COUNT(*) AS total_punches,
               MIN(punch_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS first_punch_ist,
               MAX(punch_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS last_punch_ist
             FROM attendance_logs
             WHERE DATE(punch_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') = $1
             GROUP BY emp_code
             ORDER BY emp_code`,
            [date]
          );

          // 3. Get 30-day history for repeat analysis
          const thirtyDaysAgo = new Date(new Date(date).getTime() - 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];

          const historyResult = await db.query(
            `SELECT
               emp_code,
               DATE(punch_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS punch_date,
               MIN(punch_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS first_punch_ist
             FROM attendance_logs
             WHERE DATE(punch_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') BETWEEN $1 AND $2
             GROUP BY emp_code, DATE(punch_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')
             ORDER BY emp_code, punch_date`,
            [thirtyDaysAgo, date]
          );

          // Format the results
          const employees = empResult.rows.map((e: any) => ({
            id: e.id,
            employee_code: e.employee_code,
            name: e.name,
            department: e.department || 'General',
            designation: e.designation || '',
            status: e.status,
          }));

          const punches = punchResult.rows.map((p: any) => {
            // Extract time in HH:mm:ss format from IST timestamp
            const firstIST = p.first_punch_ist ? formatTimeFromTimestamp(p.first_punch_ist) : null;
            const lastIST = p.last_punch_ist ? formatTimeFromTimestamp(p.last_punch_ist) : null;

            return {
              emp_code: p.emp_code,
              first_punch_time: firstIST,
              last_punch_time: lastIST,
              total_punches: Number(p.total_punches),
            };
          });

          const history = historyResult.rows.map((h: any) => ({
            emp_code: h.emp_code,
            punch_date: h.punch_date,
            first_punch_time: h.first_punch_ist ? formatTimeFromTimestamp(h.first_punch_ist) : null,
          }));

          const response = { employees, punches, history };

          res.statusCode = 200;
          res.end(JSON.stringify(response));
        } catch (err: any) {
          console.error('Payroll API error:', err.message);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

/**
 * Format a timestamp (Date or string) to HH:mm:ss time string
 */
function formatTimeFromTimestamp(ts: any): string {
  if (!ts) return '';
  const d = ts instanceof Date ? ts : new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}
