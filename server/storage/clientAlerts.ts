/**
 * Client recaps and instant alerts (specs/client-recaps): per-account settings
 * in Account_Communication_Profile.setup and the /go/:code link lookup.
 *
 * Writes merge into `setup` under a row lock, never replace it, so the wizard
 * and the Recaps & alerts card cannot wipe each other's keys. `setup.alerts`
 * is written only here (storage/accounts.ts keeps it out of wizard saves).
 */
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { accountCommunicationProfile, accounts, clientAlertLog } from "@shared/schema";
import { toE164 } from "@shared/phoneE164";
import {
  normalizeAlertSettings,
  type AlertSettings,
  type AlertSettingsResponse,
  type AlertChannel,
  type AlertType,
  type AlertLanguage,
} from "@shared/clientAlerts";

const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {});

export interface AlertSettingsPatch {
  recap?: { enabled?: boolean; time?: string };
  alerts?: {
    language?: AlertLanguage | null;
    channels?: { recap?: Partial<Record<AlertChannel, boolean>>; alerts?: Partial<Record<AlertChannel, boolean>> };
    instant?: Partial<Record<AlertType, boolean>>;
    quietHours?: { enabled?: boolean; from?: string; to?: string };
    includePhoneInWhatsApp?: boolean;
    recipients?: {
      emails?: Array<{ address: string; name?: string }>;
      whatsapp?: Array<{ number: string; name: string; consent?: boolean; resubscribe?: boolean }>;
    };
  };
}

export class AlertSettingsError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** E.164 for a typed number: "+..." kept, a Dutch local number converted. */
export function normalizeRecipientNumber(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\+\d{8,15}$/.test(trimmed.replace(/[\s\-().]/g, ""))) return trimmed.replace(/[\s\-().]/g, "");
  return toE164(trimmed, "NL");
}

function toResponse(setup: Record<string, any>, timezone: string | null): Omit<AlertSettingsResponse, "canEdit"> {
  const handoff = obj(setup.handoff);
  const number = typeof handoff.number === "string" ? normalizeRecipientNumber(handoff.number) : null;
  return {
    recap: {
      enabled: handoff.recap !== false,
      time: typeof handoff.recapTime === "string" && /^\d{2}:\d{2}$/.test(handoff.recapTime) ? handoff.recapTime : "18:00",
    },
    timezone: timezone || "Europe/Amsterdam",
    configured: "alerts" in setup && !!setup.alerts && typeof setup.alerts === "object",
    alerts: normalizeAlertSettings(setup.alerts),
    suggestedWhatsapp: number ? { number, name: String(handoff.name ?? "") } : null,
  };
}

/** Apply a patch to the stored alerts block. Pure apart from the clock. */
export function mergeAlerts(current: AlertSettings, patch: NonNullable<AlertSettingsPatch["alerts"]>, now = new Date()): AlertSettings {
  const next: AlertSettings = structuredClone(current);
  if (patch.language !== undefined) next.language = patch.language;
  if (patch.channels?.recap) Object.assign(next.channels.recap, patch.channels.recap);
  if (patch.channels?.alerts) Object.assign(next.channels.alerts, patch.channels.alerts);
  if (patch.instant) Object.assign(next.instant, patch.instant);
  if (patch.quietHours) Object.assign(next.quietHours, patch.quietHours);
  if (patch.includePhoneInWhatsApp !== undefined) next.includePhoneInWhatsApp = patch.includePhoneInWhatsApp;

  const r = patch.recipients;
  if (r?.emails) {
    const hadNone = current.recipients.emails.length === 0;
    next.recipients.emails = r.emails.map((e) => ({ address: e.address.trim().toLowerCase(), name: (e.name ?? "").trim() }));
    // Email starts off until a recipient exists; the first address switches it on.
    if (hadNone && next.recipients.emails.length > 0 && !patch.channels) {
      next.channels.recap.email = true;
      next.channels.alerts.email = true;
    }
  }
  if (r?.whatsapp) {
    const before = new Map(current.recipients.whatsapp.map((w) => [w.number, w]));
    const hadConsented = current.recipients.whatsapp.some((w) => w.optedInAt && !w.optedOutAt);
    next.recipients.whatsapp = r.whatsapp.map((w) => {
      const number = normalizeRecipientNumber(w.number);
      if (!number) throw new AlertSettingsError(400, `Not a valid phone number: ${w.number}`);
      const old = before.get(number);
      let optedInAt = old?.optedInAt ?? null;
      let optedOutAt = old?.optedOutAt ?? null;
      if (w.consent === true && !optedInAt) optedInAt = now.toISOString();
      if (w.consent === false) optedInAt = null;
      if (w.resubscribe === true && w.consent === true) { optedOutAt = null; optedInAt = now.toISOString(); }
      return { number, name: w.name.trim(), optedInAt, optedOutAt };
    });
    const numbers = next.recipients.whatsapp.map((w) => w.number);
    if (new Set(numbers).size !== numbers.length) throw new AlertSettingsError(400, "The same WhatsApp number is listed twice");
    const nowConsented = next.recipients.whatsapp.some((w) => w.optedInAt && !w.optedOutAt);
    if (!hadConsented && nowConsented && !patch.channels) {
      next.channels.recap.whatsapp = true;
      next.channels.alerts.whatsapp = true;
    }
  }
  return next;
}

export const clientAlertsStorage = {
  async getAlertSettings(accountId: number): Promise<Omit<AlertSettingsResponse, "canEdit"> | null> {
    const [account] = await db.select({ id: accounts.id, timezone: accounts.timezone }).from(accounts).where(eq(accounts.id, accountId));
    if (!account) return null;
    const [profile] = await db.select({ setup: accountCommunicationProfile.setup }).from(accountCommunicationProfile)
      .where(eq(accountCommunicationProfile.accountsId, accountId));
    return toResponse(obj(profile?.setup), account.timezone ?? null);
  },

  async patchAlertSettings(accountId: number, patch: AlertSettingsPatch): Promise<Omit<AlertSettingsResponse, "canEdit">> {
    return db.transaction(async (tx) => {
      const [account] = await tx.select({ id: accounts.id, timezone: accounts.timezone }).from(accounts).where(eq(accounts.id, accountId));
      if (!account) throw new AlertSettingsError(404, "Account not found");
      const [profile] = await tx.select().from(accountCommunicationProfile)
        .where(eq(accountCommunicationProfile.accountsId, accountId)).for("update");
      const setup = { ...obj(profile?.setup) };
      const handoff = { ...obj(setup.handoff) };
      if (patch.recap?.enabled !== undefined) handoff.recap = patch.recap.enabled;
      if (patch.recap?.time !== undefined) handoff.recapTime = patch.recap.time;
      setup.handoff = handoff;
      // Any save creates the block, so the account starts getting recaps.
      setup.alerts = mergeAlerts(normalizeAlertSettings(setup.alerts), patch.alerts ?? {});
      const now = new Date();
      if (profile) {
        await tx.update(accountCommunicationProfile).set({ setup, updatedAt: now })
          .where(eq(accountCommunicationProfile.id, profile.id));
      } else {
        await tx.insert(accountCommunicationProfile).values({ accountsId: accountId, setup, status: "draft", createdAt: now, updatedAt: now });
      }
      return toResponse(setup, account.timezone ?? null);
    });
  },

  /** The ledger row a /go/{code} link points at. */
  async getAlertLinkTarget(code: string) {
    const [row] = await db.select({
      accountsId: clientAlertLog.accountsId,
      leadsId: clientAlertLog.leadsId,
      voiceCallId: clientAlertLog.voiceCallId,
      eventType: clientAlertLog.eventType,
      kind: clientAlertLog.kind,
      // Appointment alerts: "call" | "chat" | "calendar", set by the engine
      // (automations client_alerts/links.py). Null on other and older rows.
      open: sql<string | null>`${clientAlertLog.payload} ->> 'open'`,
    }).from(clientAlertLog).where(eq(clientAlertLog.linkCode, code));
    return row ?? null;
  },
};
