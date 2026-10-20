/**
 * Who may write to a lead (reply in its chat, change its fields). Pure on
 * purpose, so the rule is tested without Express. Keyed on the effective role:
 * the Owner viewing as a client gets exactly what that client gets.
 *   agency    Owner/Admin (not viewing as a client), or the internal key.
 *   client    a Manager on the lead's own account: replies + the client UI fields.
 *   readonly  a Viewer on the lead's own account: reads, never writes.
 *   none      anyone else, including every other account.
 */
export type LeadWriteLevel = "agency" | "client" | "readonly" | "none";

export interface LeadWriter {
  role: string;
  accountsId: number | null;
  impersonatedRole?: string | null;
  impersonatedAccountId?: number | null;
}

export function leadWriteLevel(input: LeadWriter, leadAccountId: number | null): LeadWriteLevel {
  const impersonating = !!input.impersonatedRole;
  const role = input.impersonatedRole ?? input.role;
  if (role === "Owner" || role === "Admin") return "agency";
  if (!impersonating && input.accountsId === 1) return "agency";
  const own = impersonating ? input.impersonatedAccountId ?? null : input.accountsId;
  if (own == null || leadAccountId == null || own !== leadAccountId) return "none";
  return role === "Manager" ? "client" : "readonly";
}

/** The lead fields the client UI sends (Drizzle camelCase keys, after fromDbKeys). */
export const CLIENT_LEAD_FIELDS = [
  "firstName", "lastName", "phone", "email", "notes",
  "conversionStatus", "pipelineStage", "manualTakeover", "teamMembers",
] as const;

export function disallowedClientLeadFields(body: Record<string, unknown>): string[] {
  const allowed = new Set<string>(CLIENT_LEAD_FIELDS);
  return Object.keys(body).filter((k) => !allowed.has(k));
}

/** Request-level wrapper: no session user means the internal key was let in (agency). */
export function leadWriteLevelForRequest(
  req: { user?: { role?: string | null; accountsId?: number | null } | null; session?: { impersonation?: { role?: string; accountId?: number } | null } },
  leadAccountId: number | null,
): LeadWriteLevel {
  const u = req.user;
  if (!u) return "agency";
  const imp = req.session?.impersonation;
  return leadWriteLevel(
    { role: u.role ?? "", accountsId: u.accountsId ?? null, impersonatedRole: imp?.role ?? null, impersonatedAccountId: imp?.accountId ?? null },
    leadAccountId,
  );
}
