import crypto from "crypto";
import { promisify } from "util";
import { pool } from "../server/db";

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

async function seed() {
  const hash = await hashPassword("test123");

  // Check if admin user exists
  const existing = await pool.query(
    `SELECT id, email, role, "Accounts_id" FROM "p2mxx34fvbf3ll6"."Users" WHERE email = $1`,
    ["leadawaker@gmail.com"]
  );

  if (existing.rows.length > 0) {
    console.log("Admin user exists:", existing.rows[0]);
    // Update password
    await pool.query(
      `UPDATE "p2mxx34fvbf3ll6"."Users" SET password_hash = $1 WHERE email = $2`,
      [hash, "leadawaker@gmail.com"]
    );
    console.log("Updated admin password to test123");
  } else {
    await pool.query(
      `INSERT INTO "p2mxx34fvbf3ll6"."Users" (full_name_1, email, password_hash, role, status, "Accounts_id")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ["Gabriel Fronza", "leadawaker@gmail.com", hash, "Admin", "Active", 1]
    );
    console.log("Created admin user: leadawaker@gmail.com / test123");
  }

  // Check/create viewer user for testing route guards
  const existingViewer = await pool.query(
    `SELECT id, email, role, "Accounts_id" FROM "p2mxx34fvbf3ll6"."Users" WHERE email = $1`,
    ["viewer@test.com"]
  );

  if (existingViewer.rows.length > 0) {
    console.log("Viewer user exists:", existingViewer.rows[0]);
    await pool.query(
      `UPDATE "p2mxx34fvbf3ll6"."Users" SET password_hash = $1 WHERE email = $2`,
      [hash, "viewer@test.com"]
    );
    console.log("Updated viewer password to test123");
  } else {
    // First check if there's an account with id=2
    const acc = await pool.query(`SELECT id FROM "p2mxx34fvbf3ll6"."Accounts" WHERE id = 2`);
    const accountId = acc.rows.length > 0 ? 2 : 1;

    await pool.query(
      `INSERT INTO "p2mxx34fvbf3ll6"."Users" (full_name_1, email, password_hash, role, status, "Accounts_id")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ["Test Viewer", "viewer@test.com", hash, "Viewer", "Active", accountId]
    );
    console.log(`Created viewer user: viewer@test.com / test123 (account ${accountId})`);
  }

  // List all users
  const allUsers = await pool.query(
    `SELECT id, email, role, "Accounts_id" FROM "p2mxx34fvbf3ll6"."Users" ORDER BY id`
  );
  console.log("\nAll users:");
  allUsers.rows.forEach((u: any) => console.log(`  #${u.id} ${u.email} role=${u.role} account=${u.Accounts_id}`));

  await pool.end();
}

seed().catch(console.error);
