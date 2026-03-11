import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import pg from 'pg';

const scryptAsync = promisify(scrypt);
const { Pool } = pg;

const password = 'admin123';
const salt = randomBytes(16).toString('hex');
const derived = await scryptAsync(password, salt, 64);
const hash = `scrypt:${salt}:${derived.toString('hex')}`;

const pool = new Pool({ connectionString: 'postgresql://leadawaker:1234Bananas@127.0.0.1:5432/nocodb' });
const r = await pool.query(`UPDATE "p2mxx34fvbf3ll6"."Users" SET password_hash = $1 WHERE email = 'admin@leadawaker.com' RETURNING id, email`, [hash]);
console.log('Updated:', JSON.stringify(r.rows));
await pool.end();
