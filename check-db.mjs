import pg from 'pg';
import fs from 'fs';

let pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let mode = process.argv[2] || 'check';

try {
  if (mode === 'migrate') {
    let sql = fs.readFileSync('migrations/add_ai_agent_schema_v2.sql', 'utf-8');
    await pool.query(sql);
    console.log('Migration applied successfully!');
  }

  // Verify all 4 tables with correct columns
  let tables = ['AI_Agents', 'AI_Sessions', 'AI_Messages', 'AI_Files'];
  for (let t of tables) {
    let r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'p2mxx34fvbf3ll6' AND table_name = $1 ORDER BY ordinal_position", [t]);
    console.log(t + ' columns:', JSON.stringify(r.rows.map(function(r){return r.column_name})));
  }

  // Verify existing data survived migration
  let agents = await pool.query('SELECT id, name, model, thinking_level, page_awareness_enabled FROM p2mxx34fvbf3ll6."AI_Agents"');
  console.log('Agents with new columns:', JSON.stringify(agents.rows));

  // Verify indexes
  let indexes = await pool.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'p2mxx34fvbf3ll6' AND tablename LIKE 'AI%' ORDER BY indexname");
  console.log('Indexes:', JSON.stringify(indexes.rows.map(function(r){return r.indexname})));
} catch(e) {
  console.error('Error:', e.message);
} finally {
  await pool.end();
}
