import crypto from "crypto";
import { promisify } from "util";
import { pool } from "../server/db";

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

/** Upsert a user: insert if not exists, update password + account if exists. */
async function upsertUser(params: {
  fullName: string;
  email: string;
  hash: string;
  role: string;
  status: string;
  accountId: number | null;
}): Promise<void> {
  const { fullName, email, hash, role, status, accountId } = params;

  const existing = await pool.query(
    `SELECT id, email, role, "Accounts_id" FROM "p2mxx34fvbf3ll6"."Users" WHERE email = $1`,
    [email]
  );

  if (existing.rows.length > 0) {
    console.log(`  exists: ${email} (role=${role}, account=${accountId})`);
    await pool.query(
      `UPDATE "p2mxx34fvbf3ll6"."Users"
       SET password_hash = $1, role = $2, "Accounts_id" = $3, status = $4
       WHERE email = $5`,
      [hash, role, accountId, status, email]
    );
    console.log(`  updated password + account → ${accountId}`);
  } else {
    await pool.query(
      `INSERT INTO "p2mxx34fvbf3ll6"."Users"
         (full_name_1, email, password_hash, role, status, "Accounts_id")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [fullName, email, hash, role, status, accountId]
    );
    console.log(`  created: ${email} / test123 (role=${role}, account=${accountId})`);
  }
}

async function seed() {
  const hash = await hashPassword("test123");

  // ── Discover available account IDs ──────────────────────────────────────────
  const accountRows = await pool.query<{ id: number }>(
    `SELECT id FROM "p2mxx34fvbf3ll6"."Accounts" ORDER BY id LIMIT 10`
  );
  const accountIds: number[] = accountRows.rows.map((r) => r.id);
  console.log("Available account IDs:", accountIds);

  // Helper: pick the Nth account (0-based) or fall back to the first
  const pick = (n: number): number | null =>
    accountIds.length > 0 ? accountIds[Math.min(n, accountIds.length - 1)] : null;

  // ── Seed users ───────────────────────────────────────────────────────────────
  //
  // Agency users (Admin/Operator) have accountsId = NULL — they see all data.
  // Subaccount users (Manager/Viewer) are scoped to a specific account.

  console.log("\n── Agency Admin (no account scope) ──");
  await upsertUser({
    fullName: "Gabriel Fronza",
    email: "leadawaker@gmail.com",
    hash,
    role: "Admin",
    status: "Active",
    accountId: null, // Agency-level: sees all accounts
  });

  console.log("\n── Agency Operator (no account scope) ──");
  await upsertUser({
    fullName: "Agency Operator",
    email: "operator@leadawaker.com",
    hash,
    role: "Operator",
    status: "Active",
    accountId: null, // Agency-level operator
  });

  console.log("\n── Manager — Account 1 ──");
  await upsertUser({
    fullName: "Account Manager One",
    email: "manager@account1.com",
    hash,
    role: "Manager",
    status: "Active",
    accountId: pick(0),
  });

  console.log("\n── Viewer — Account 1 ──");
  await upsertUser({
    fullName: "Test Viewer",
    email: "viewer@test.com",
    hash,
    role: "Viewer",
    status: "Active",
    accountId: pick(0),
  });

  console.log("\n── Manager — Account 2 ──");
  await upsertUser({
    fullName: "Account Manager Two",
    email: "manager@account2.com",
    hash,
    role: "Manager",
    status: "Active",
    accountId: pick(1),
  });

  console.log("\n── Viewer — Account 2 ──");
  await upsertUser({
    fullName: "Viewer Account Two",
    email: "viewer@account2.com",
    hash,
    role: "Viewer",
    status: "Active",
    accountId: pick(1),
  });

  console.log("\n── Manager — Account 3 ──");
  await upsertUser({
    fullName: "Account Manager Three",
    email: "manager@account3.com",
    hash,
    role: "Manager",
    status: "Active",
    accountId: pick(2),
  });

  // ── Summary ──────────────────────────────────────────────────────────────────
  const allUsers = await pool.query<{ id: number; email: string; role: string; Accounts_id: number | null }>(
    `SELECT id, email, role, "Accounts_id" FROM "p2mxx34fvbf3ll6"."Users" ORDER BY id`
  );
  console.log("\n── All users after seed ──");
  allUsers.rows.forEach((u) =>
    console.log(`  #${u.id}  ${u.email.padEnd(35)}  role=${String(u.role).padEnd(10)}  account=${u.Accounts_id ?? "null (agency)"}`)
  );

  await pool.end();
}

seed().catch(console.error);
