// The account gate every /api/social/accounts/:id/... route starts with: accountIdFor (a client user
// only reaches their own account), the account must exist, and for client users Social must be on.
// Sends the error itself and returns null, so a route just does `const ctx = await gate(req, res); if (!ctx) return;`.
import type { Request, Response } from "express";
import { DEFAULT_TIMEZONE } from "@shared/socialPosts";
import { accountIdFor } from "../routes/_helpers";
import { isAgency } from "./access";

export type AccountCtx = { accountId: number; timeZone: string; language: string | null };

export type GetAccount = (accountId: number) => Promise<{ timezone: string | null; language: string | null; socialEnabled: boolean } | null>;

export function makeAccountGate(getAccount: GetAccount) {
  return async function accountGate(req: Request, res: Response): Promise<AccountCtx | null> {
    const accountId = accountIdFor(req, res);
    if (accountId === null) return null;
    const account = await getAccount(accountId);
    if (!account) {
      res.status(404).json({ message: "Account not found" });
      return null;
    }
    if (req.user && !isAgency(req.user) && !account.socialEnabled) {
      res.status(403).json({ message: "Social is not enabled for this account", reason: "not_enabled" });
      return null;
    }
    return { accountId, timeZone: account.timezone || DEFAULT_TIMEZONE, language: account.language };
  };
}

/** Users.id is nullable in the schema: a write that records who did it needs a real id. Sends 403 otherwise. */
export function actorIdOf(req: Request, res: Response): number | null {
  const id = req.user?.id;
  if (typeof id === "number") return id;
  res.status(403).json({ message: "Forbidden" });
  return null;
}

export function positiveIntParam(req: Request, res: Response, name: string): number | null {
  const id = Number(req.params[name]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: `Invalid ${name}` });
    return null;
  }
  return id;
}

export const refused = (res: Response, status: number, reason: string) => res.status(status).json({ message: reason, reason });
export const forbidden = (res: Response) => res.status(403).json({ message: "Forbidden" });
