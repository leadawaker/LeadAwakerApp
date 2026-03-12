import pg from 'pg';
var pool = new pg.Pool({ connectionString: 'postgresql://leadawaker:1234Bananas@127.0.0.1:5432/nocodb' });
try {
  var r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'p2mxx34fvbf3ll6' AND table_name LIKE 'AI%'");
  console.log('AI tables:', r.rows.map(function(row) { return row.table_name; }));

  var r2 = await pool.query("SELECT count(*) as cnt FROM p2mxx34fvbf3ll6.\"AI_Agents\"");
  console.log('AI_Agents count:', r2.rows[0].cnt);

  var r3 = await pool.query("SELECT id, name, type FROM p2mxx34fvbf3ll6.\"AI_Agents\" LIMIT 5");
  console.log('AI_Agents rows:', r3.rows);
} catch(e) {
  console.error('Error:', e.message);
}
pool.end();
