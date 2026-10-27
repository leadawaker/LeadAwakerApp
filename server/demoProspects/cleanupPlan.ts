/**
 * Which demo links the dead-link cleanup script may delete, as a pure function
 * over lead rows. No db import: script/demo-links-cleanup.ts loads the rows
 * (loadDemoLeadsLite plus an inbound count per lead) and the campaign ids.
 *
 * A token is deleted only when nobody ever answered it (no inbound message, no
 * voice call on either row) AND it is dead: past its
 * channel's lifetime (shared/demoTokenTtl.ts), pointing at a campaign that no
 * longer exists, or a browser row whose mint row is gone. Public website demos
 * and anything with a reply are always kept.
 */
import { PUBLIC_DEMO_SOURCE, isLinkExpired } from "@shared/demoTokenTtl";
import { parseDemoNiche } from "../demoNicheBlob";
import type { DemoLeadLite } from "../demoSessionsFold";

export interface CleanupLead extends DemoLeadLite {
  /** Inbound Interactions on this lead row. */
  inbound: number;
  /** Voice_Calls rows on this lead row: a call is an answer too. */
  voiceCalls: number;
}

export type CleanupReason = "expired" | "deleted_campaign" | "orphan_web";

export interface CleanupPlan {
  /** label = first name and company, never the token. */
  tokens: { token: string; reason: CleanupReason; leadIds: number[]; label: string }[];
  kept: { replied: number; public: number; live: number };
}

interface TokenRows {
  wa?: CleanupLead;
  web?: CleanupLead;
  all: CleanupLead[];
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

function groupByToken(leads: CleanupLead[]): Map<string, TokenRows> {
  const byToken = new Map<string, TokenRows>();
  for (const lead of leads) {
    const ident = lead.channelIdentifier ?? "";
    const isWeb = ident.startsWith("web-demo:");
    if (!isWeb && !ident.startsWith("wa-demo:")) continue;
    const token = ident.slice(ident.indexOf(":") + 1);
    if (!token) continue;
    const rows = byToken.get(token) ?? { all: [] };
    rows.all.push(lead);
    if (isWeb) rows.web = lead;
    else rows.wa = lead;
    byToken.set(token, rows);
  }
  return byToken;
}

function labelFor(rows: TokenRows): string {
  const first = rows.all.map((r) => (r.firstName ?? "").trim()).find(Boolean) ?? "";
  const company =
    [rows.wa, rows.web]
      .map((r) => str(parseDemoNiche(r?.demoNiche).company_name).trim())
      .find(Boolean) ?? "";
  if (first && company) return `${first} (${company})`;
  return first || company || "(unnamed)";
}

export function planDeadLinkCleanup(leads: CleanupLead[], campaignIds: Set<number>, now: number): CleanupPlan {
  const plan: CleanupPlan = { tokens: [], kept: { replied: 0, public: 0, live: 0 } };

  for (const [token, rows] of groupByToken(leads)) {
    if (rows.all.some((r) => r.source === PUBLIC_DEMO_SOURCE)) {
      plan.kept.public++;
      continue;
    }
    if (rows.all.some((r) => r.inbound > 0 || r.voiceCalls > 0)) {
      plan.kept.replied++;
      continue;
    }

    let reason: CleanupReason | null = null;
    if (rows.web && !rows.wa) {
      reason = "orphan_web";
    } else if (rows.all.some((r) => r.campaignsId !== null && !campaignIds.has(r.campaignsId))) {
      reason = "deleted_campaign";
    } else {
      // Same call the Demos page makes: the service and mint date come from the
      // wa-demo row, the first browser open from the web-demo row, and either
      // row's revoke marker ends the link.
      const expired = isLinkExpired(
        {
          service: str(parseDemoNiche(rows.wa?.demoNiche).service),
          mintedAt: rows.wa?.createdAt ?? null,
          openedAt: rows.web?.createdAt ?? null,
          revokedAt: rows.wa?.demoRevokedAt ?? rows.web?.demoRevokedAt ?? null,
        },
        now,
      );
      if (expired) reason = "expired";
    }

    if (!reason) {
      plan.kept.live++;
      continue;
    }
    plan.tokens.push({ token, reason, leadIds: rows.all.map((r) => r.id), label: labelFor(rows) });
  }

  return plan;
}

export interface CleanupArgs {
  execute: boolean;
  confirm: number | null;
  /** Set when the command line is unusable; the script prints it and exits 1. */
  error: string | null;
}

/** `[--execute --confirm=<N>]`. No flags is the dry run. */
export function parseCleanupArgs(argv: string[]): CleanupArgs {
  const args: CleanupArgs = { execute: false, confirm: null, error: null };
  for (const arg of argv) {
    const confirm = /^--confirm=(\d+)$/.exec(arg);
    if (arg === "--execute") args.execute = true;
    else if (confirm) args.confirm = Number(confirm[1]);
    else if (!args.error) args.error = `Unknown argument: ${arg}`;
  }
  if (!args.error && args.confirm !== null && !args.execute) args.error = "--confirm only goes with --execute";
  return args;
}

/** Deleting needs `--confirm` to equal the count the dry run printed. */
export function executeGate(args: CleanupArgs, tokenCount: number): { ok: true } | { ok: false; message: string } {
  if (args.confirm === tokenCount) return { ok: true };
  return {
    ok: false,
    message: `Refusing to delete: ${tokenCount} tokens are planned, so pass --execute --confirm=${tokenCount}.`,
  };
}

/** First 4 characters of a token and "...": enough to tell links apart, not enough to open one. */
export function tokenFingerprint(token: string): string {
  return `${token.slice(0, 4)}...`;
}
