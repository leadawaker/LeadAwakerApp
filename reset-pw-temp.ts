import crypto from 'crypto';
import { promisify } from 'util';
import { Pool } from 'pg';

const scrypt = promisify(crypto.scrypt);

async function main() {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = (await scrypt('admin123', salt, 64)) as Buffer;
  const hash = `scrypt:${salt}:${derived.toString('hex')}`;

  const pool = new Pool({ connectionString: 'postgresql://leadawaker:1234Bananas@127.0.0.1:5432/nocodb' });
  const res = await pool.query('UPDATE "p2mxx34fvbf3ll6"."Users" SET password_hash = $1 WHERE email = $2 RETURNING id, email', [hash, 'admin@leadawaker.com']);
  console.log('Updated rows:', res.rowCount, JSON.stringify(res.rows[0]));
  await pool.end();
}

main().catch(console.error);
