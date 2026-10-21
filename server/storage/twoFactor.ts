/**
 * Two-factor authentication storage (specs/two-factor-auth): TOTP columns on Users,
 * passkeys, backup codes, trusted devices, the require-2FA policy and the audit log.
 *
 * Plain SQL through the pool: these tables are new and small, and several writes
 * need to be atomic single statements (replay guard, one-time codes).
 */
import { pool } from "../db";

const S = `"p2mxx34fvbf3ll6"`;

export type RequireMode = "off" | "admins" | "everyone";

export interface PasskeyRow {
  id: number;
  usersId: number;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string | null;
  deviceLabel: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface TrustedDeviceRow {
  id: number;
  usersId: number;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
}

export interface SecurityEventRow {
  id: number;
  usersId: number | null;
  actorUsersId: number | null;
  accountsId: number | null;
  event: string;
  ip: string | null;
  userAgent: string | null;
  meta: Record<string, unknown> | null;
  createdAt: Date;
}

const passkeyFrom = (r: any): PasskeyRow => ({
  id: r.id,
  usersId: r.users_id,
  credentialId: r.credential_id,
  publicKey: r.public_key,
  counter: Number(r.counter),
  transports: r.transports,
  deviceLabel: r.device_label,
  createdAt: r.created_at,
  lastUsedAt: r.last_used_at,
});

export const twoFactorStorage = {
  // ─── TOTP / email method flags on Users ────────────────────────────

  async setTotpSecret(userId: number, secretEnc: string, enabledAt: Date): Promise<void> {
    await pool.query(
      `UPDATE ${S}."Users" SET totp_secret_enc = $2, totp_enabled_at = $3, totp_last_step = NULL WHERE id = $1`,
      [userId, secretEnc, enabledAt],
    );
  },

  async clearTotp(userId: number): Promise<void> {
    await pool.query(
      `UPDATE ${S}."Users" SET totp_secret_enc = NULL, totp_enabled_at = NULL, totp_last_step = NULL WHERE id = $1`,
      [userId],
    );
  },

  /** Atomic replay guard: true only when `step` is newer than the last accepted one. */
  async claimTotpStep(userId: number, step: number): Promise<boolean> {
    const r = await pool.query(
      `UPDATE ${S}."Users" SET totp_last_step = $2 WHERE id = $1 AND (totp_last_step IS NULL OR totp_last_step < $2)`,
      [userId, step],
    );
    return (r.rowCount ?? 0) > 0;
  },

  async setEmail2fa(userId: number, enabledAt: Date | null): Promise<void> {
    await pool.query(`UPDATE ${S}."Users" SET email_2fa_enabled_at = $2 WHERE id = $1`, [userId, enabledAt]);
  },

  async setTwoFactorRequiredSince(userId: number, at: Date | null): Promise<void> {
    await pool.query(`UPDATE ${S}."Users" SET two_factor_required_since = $2 WHERE id = $1`, [userId, at]);
  },

  // ─── Passkeys ──────────────────────────────────────────────────────

  async countPasskeys(userId: number): Promise<number> {
    const r = await pool.query(`SELECT count(*)::int AS n FROM ${S}."User_Passkeys" WHERE users_id = $1`, [userId]);
    return r.rows[0].n;
  },

  async listPasskeys(userId: number): Promise<PasskeyRow[]> {
    const r = await pool.query(`SELECT * FROM ${S}."User_Passkeys" WHERE users_id = $1 ORDER BY created_at`, [userId]);
    return r.rows.map(passkeyFrom);
  },

  async getPasskeyByCredentialId(credentialId: string): Promise<PasskeyRow | undefined> {
    const r = await pool.query(`SELECT * FROM ${S}."User_Passkeys" WHERE credential_id = $1`, [credentialId]);
    return r.rows[0] ? passkeyFrom(r.rows[0]) : undefined;
  },

  async addPasskey(p: {
    userId: number;
    credentialId: string;
    publicKey: string;
    counter: number;
    transports: string[] | undefined;
    deviceLabel: string | null;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO ${S}."User_Passkeys" (users_id, credential_id, public_key, counter, transports, device_label)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [p.userId, p.credentialId, p.publicKey, p.counter, JSON.stringify(p.transports ?? []), p.deviceLabel],
    );
  },

  async touchPasskey(id: number, counter: number, usedAt: Date): Promise<void> {
    await pool.query(`UPDATE ${S}."User_Passkeys" SET counter = $2, last_used_at = $3 WHERE id = $1`, [id, counter, usedAt]);
  },

  async renamePasskey(userId: number, id: number, label: string): Promise<boolean> {
    const r = await pool.query(`UPDATE ${S}."User_Passkeys" SET device_label = $3 WHERE id = $1 AND users_id = $2`, [id, userId, label]);
    return (r.rowCount ?? 0) > 0;
  },

  async removePasskey(userId: number, id: number): Promise<boolean> {
    const r = await pool.query(`DELETE FROM ${S}."User_Passkeys" WHERE id = $1 AND users_id = $2`, [id, userId]);
    return (r.rowCount ?? 0) > 0;
  },

  // ─── Backup codes ──────────────────────────────────────────────────

  /** Replace the user's whole set in one transaction. */
  async replaceBackupCodes(userId: number, hashes: string[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM ${S}."User_Backup_Codes" WHERE users_id = $1`, [userId]);
      for (const h of hashes) {
        await client.query(`INSERT INTO ${S}."User_Backup_Codes" (users_id, code_hash) VALUES ($1, $2)`, [userId, h]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },

  async countUnusedBackupCodes(userId: number): Promise<number> {
    const r = await pool.query(
      `SELECT count(*)::int AS n FROM ${S}."User_Backup_Codes" WHERE users_id = $1 AND used_at IS NULL`,
      [userId],
    );
    return r.rows[0].n;
  },

  /** Marks one matching unused code as used. True when a code was consumed. */
  async consumeBackupCode(userId: number, hash: string, usedAt: Date): Promise<boolean> {
    const r = await pool.query(
      `UPDATE ${S}."User_Backup_Codes" SET used_at = $3
       WHERE id = (SELECT id FROM ${S}."User_Backup_Codes" WHERE users_id = $1 AND code_hash = $2 AND used_at IS NULL LIMIT 1)
         AND used_at IS NULL`,
      [userId, hash, usedAt],
    );
    return (r.rowCount ?? 0) > 0;
  },

  async deleteBackupCodes(userId: number): Promise<void> {
    await pool.query(`DELETE FROM ${S}."User_Backup_Codes" WHERE users_id = $1`, [userId]);
  },

  // ─── Trusted devices ───────────────────────────────────────────────

  async addTrustedDevice(d: { userId: number; tokenHash: string; userAgent: string | null; ip: string | null; expiresAt: Date }): Promise<void> {
    await pool.query(
      `INSERT INTO ${S}."User_Trusted_Devices" (users_id, token_hash, user_agent, ip, expires_at) VALUES ($1, $2, $3, $4, $5)`,
      [d.userId, d.tokenHash, d.userAgent, d.ip, d.expiresAt],
    );
  },

  /** The row's id when the token belongs to this user and has not expired. */
  async findTrustedDevice(userId: number, tokenHash: string, now: Date): Promise<number | null> {
    const r = await pool.query(
      `SELECT id FROM ${S}."User_Trusted_Devices" WHERE users_id = $1 AND token_hash = $2 AND expires_at > $3`,
      [userId, tokenHash, now],
    );
    return r.rows[0]?.id ?? null;
  },

  async touchTrustedDevice(id: number, usedAt: Date): Promise<void> {
    await pool.query(`UPDATE ${S}."User_Trusted_Devices" SET last_used_at = $2 WHERE id = $1`, [id, usedAt]);
  },

  async listTrustedDevices(userId: number, now: Date): Promise<(TrustedDeviceRow & { tokenHash: string })[]> {
    const r = await pool.query(
      `SELECT * FROM ${S}."User_Trusted_Devices" WHERE users_id = $1 AND expires_at > $2 ORDER BY created_at DESC`,
      [userId, now],
    );
    return r.rows.map((x: any) => ({
      id: x.id, usersId: x.users_id, tokenHash: x.token_hash, userAgent: x.user_agent, ip: x.ip,
      createdAt: x.created_at, lastUsedAt: x.last_used_at, expiresAt: x.expires_at,
    }));
  },

  async removeTrustedDevice(userId: number, id: number): Promise<boolean> {
    const r = await pool.query(`DELETE FROM ${S}."User_Trusted_Devices" WHERE id = $1 AND users_id = $2`, [id, userId]);
    return (r.rowCount ?? 0) > 0;
  },

  async revokeAllTrustedDevices(userId: number): Promise<number> {
    const r = await pool.query(`DELETE FROM ${S}."User_Trusted_Devices" WHERE users_id = $1`, [userId]);
    return r.rowCount ?? 0;
  },

  async pruneTrustedDevices(now: Date): Promise<void> {
    await pool.query(`DELETE FROM ${S}."User_Trusted_Devices" WHERE expires_at <= $1`, [now]);
  },

  // ─── Require-2FA policy ────────────────────────────────────────────

  async getSecurityPolicy(): Promise<{ requireTwoFactor: RequireMode; graceDays: number }> {
    const r = await pool.query(`SELECT require_2fa, grace_days FROM ${S}."Security_Policy" WHERE id = 1`);
    const row = r.rows[0];
    return { requireTwoFactor: (row?.require_2fa ?? "off") as RequireMode, graceDays: row?.grace_days ?? 7 };
  },

  async setSecurityPolicy(p: { requireTwoFactor: RequireMode; graceDays: number }, updatedBy: number, at: Date): Promise<void> {
    await pool.query(
      `INSERT INTO ${S}."Security_Policy" (id, require_2fa, grace_days, updated_at, updated_by) VALUES (1, $1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET require_2fa = EXCLUDED.require_2fa, grace_days = EXCLUDED.grace_days,
         updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`,
      [p.requireTwoFactor, p.graceDays, at, updatedBy],
    );
  },

  async getAccountRequire2fa(accountId: number): Promise<RequireMode | null> {
    const r = await pool.query(`SELECT require_2fa FROM ${S}."Accounts" WHERE id = $1`, [accountId]);
    return (r.rows[0]?.require_2fa ?? null) as RequireMode | null;
  },

  async setAccountRequire2fa(accountId: number, mode: RequireMode | null): Promise<boolean> {
    const r = await pool.query(`UPDATE ${S}."Accounts" SET require_2fa = $2 WHERE id = $1`, [accountId, mode]);
    return (r.rowCount ?? 0) > 0;
  },

  // ─── Reset + sessions ──────────────────────────────────────────────

  /** Removes every 2FA method, backup code and trusted device for the user. */
  async resetTwoFactor(userId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE ${S}."Users" SET totp_secret_enc = NULL, totp_enabled_at = NULL, totp_last_step = NULL,
           email_2fa_enabled_at = NULL, two_factor_required_since = NULL WHERE id = $1`,
        [userId],
      );
      await client.query(`DELETE FROM ${S}."User_Passkeys" WHERE users_id = $1`, [userId]);
      await client.query(`DELETE FROM ${S}."User_Backup_Codes" WHERE users_id = $1`, [userId]);
      await client.query(`DELETE FROM ${S}."User_Trusted_Devices" WHERE users_id = $1`, [userId]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },

  /** Ends every active login session of the user (connect-pg-simple `session` table). */
  async deleteUserSessions(userId: number): Promise<void> {
    await pool.query(`DELETE FROM public.session WHERE (sess::jsonb -> 'passport' ->> 'user') = $1`, [String(userId)]);
  },

  /** Users that have at least one 2FA method, as a set of ids (for the admin user list). */
  async userIdsWithTwoFactor(): Promise<Set<number>> {
    const r = await pool.query(
      `SELECT id FROM ${S}."Users" WHERE totp_enabled_at IS NOT NULL OR email_2fa_enabled_at IS NOT NULL
       UNION SELECT users_id FROM ${S}."User_Passkeys"`,
    );
    return new Set(r.rows.map((x: any) => Number(x.id)));
  },

  // ─── Audit log ─────────────────────────────────────────────────────

  async insertSecurityEvent(e: {
    usersId: number | null; actorUsersId: number | null; accountsId: number | null;
    event: string; ip: string | null; userAgent: string | null; meta: Record<string, unknown> | null;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO ${S}."Security_Events" (users_id, actor_users_id, accounts_id, event, ip, user_agent, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [e.usersId, e.actorUsersId, e.accountsId, e.event, e.ip, e.userAgent, e.meta ? JSON.stringify(e.meta) : null],
    );
  },

  async listSecurityEvents(f: {
    userId?: number; event?: string; from?: Date; to?: Date; before?: number; limit: number;
  }): Promise<SecurityEventRow[]> {
    const where: string[] = [];
    const args: unknown[] = [];
    const add = (sql: string, v: unknown) => { args.push(v); where.push(sql.replaceAll("?", `$${args.length}`)); };
    if (f.userId != null) add("(users_id = ? OR actor_users_id = ?)", f.userId);
    if (f.event) add("event = ?", f.event);
    if (f.from) add("created_at >= ?", f.from);
    if (f.to) add("created_at < ?", f.to);
    if (f.before != null) add("id < ?", f.before);
    args.push(f.limit);
    const r = await pool.query(
      `SELECT * FROM ${S}."Security_Events" ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT $${args.length}`,
      args,
    );
    return r.rows.map((x: any) => ({
      id: Number(x.id), usersId: x.users_id, actorUsersId: x.actor_users_id, accountsId: x.accounts_id,
      event: x.event, ip: x.ip, userAgent: x.user_agent, meta: x.meta, createdAt: x.created_at,
    }));
  },

  async pruneSecurityEvents(olderThan: Date): Promise<void> {
    await pool.query(`DELETE FROM ${S}."Security_Events" WHERE created_at < $1`, [olderThan]);
  },
};
