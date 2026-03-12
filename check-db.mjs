import pg from 'pg';
var pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  var r1 = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'p2mxx34fvbf3ll6' AND table_name LIKE 'AI%' ORDER BY table_name");
  console.log('AI tables:', JSON.stringify(r1.rows));
  var r2 = await pool.query('SELECT 1 as test');
  console.log('SELECT 1 test:', JSON.stringify(r2.rows[0]));
  var r3 = await pool.query('SELECT id, name, type, enabled FROM p2mxx34fvbf3ll6."AI_Agents" ORDER BY display_order');
  console.log('Agents:', JSON.stringify(r3.rows));
  var r4 = await pool.query('SELECT id, session_id, user_id, agent_id, status FROM p2mxx34fvbf3ll6."AI_Sessions" LIMIT 5');
  console.log('Sessions:', JSON.stringify(r4.rows));
  var r5 = await pool.query('SELECT id, session_id, role FROM p2mxx34fvbf3ll6."AI_Messages" LIMIT 5');
  console.log('Messages:', JSON.stringify(r5.rows));
} catch(e) {
  console.error('Error:', e.message);
} finally {
  await pool.end();
}
