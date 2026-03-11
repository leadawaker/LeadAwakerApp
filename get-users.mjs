import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://leadawaker:1234Bananas@127.0.0.1:5432/nocodb' });
const r = await pool.query('SELECT email, role FROM "p2mxx34fvbf3ll6"."Users" LIMIT 5');
console.log(JSON.stringify(r.rows));
await pool.end();
