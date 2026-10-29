import type { Request } from "express";
import { resolveVoiceAccess, type VoiceAccess } from "./voiceCallsAccess";

/**
 * The Chats page's Live / Demo tab. Demo is the Owner's (as on the Calls page); everyone else,
 * clients and a view-as Owner included, gets Live whatever they ask for. Other pages ask for no
 * scope and keep every lead.
 */
export function chatsScope(access: VoiceAccess, chatsOnly: boolean, asked: unknown): "live" | "demo" | undefined {
  if (!chatsOnly) return undefined;
  return access.isOwner && asked === "demo" ? "demo" : "live";
}

export function requestChatsScope(req: Request, chatsOnly: boolean): "live" | "demo" | undefined {
  const user = req.user;
  if (!user) return chatsOnly ? "live" : undefined;
  return chatsScope(
    resolveVoiceAccess({
      role: user.role,
      accountsId: user.accountsId ?? null,
      impersonatedAccountId: req.session?.impersonation?.accountId ?? null,
      impersonatedRole: req.session?.impersonation?.role ?? null,
    }),
    chatsOnly,
    req.query.scope,
  );
}
