// Client recaps and instant alerts (specs/client-recaps): the per-account
// settings stored in Account_Communication_Profile.setup.alerts. Recap on/off
// and time stay in setup.handoff.recap / recapTime (the wizard's keys).
// The engine reads the same shape in
// automations/src/automations/client_alerts/settings.py: change both.

export const ALERT_TYPES = [
  "appointment_booked",
  "appointment_rescheduled",
  "appointment_cancelled",
  "callback_requested",
  "lead_needs_reply",
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_CHANNELS = ["crm", "email", "whatsapp"] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

export const ALERT_LANGUAGES = ["nl", "en", "pt"] as const;
export type AlertLanguage = (typeof ALERT_LANGUAGES)[number];

export const MAX_EMAIL_RECIPIENTS = 5;
export const MAX_WHATSAPP_RECIPIENTS = 3;

export interface AlertEmailRecipient { address: string; name: string }
export interface AlertWhatsappRecipient {
  number: string;            // E.164
  name: string;              // required: {{1}} in every template
  optedInAt: string | null;  // set server-side when consent is ticked
  optedOutAt: string | null; // set when the number sends STOP
}

export type ChannelMatrix = Record<AlertChannel, boolean>;

export interface AlertSettings {
  language: AlertLanguage | null; // null = from Accounts.language
  channels: { recap: ChannelMatrix; alerts: ChannelMatrix };
  instant: Record<AlertType, boolean>;
  quietHours: { enabled: boolean; from: string; to: string };
  includePhoneInWhatsApp: boolean;
  recipients: { emails: AlertEmailRecipient[]; whatsapp: AlertWhatsappRecipient[] };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isHHMM = (v: unknown): v is string => typeof v === "string" && TIME_RE.test(v);

const channelDefaults = (): ChannelMatrix => ({ crm: true, email: false, whatsapp: false });

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  language: null,
  channels: { recap: channelDefaults(), alerts: channelDefaults() },
  instant: Object.fromEntries(ALERT_TYPES.map((t) => [t, true])) as Record<AlertType, boolean>,
  quietHours: { enabled: true, from: "22:00", to: "07:00" },
  includePhoneInWhatsApp: true,
  recipients: { emails: [], whatsapp: [] },
};

const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {});

function matrix(raw: unknown): ChannelMatrix {
  const r = obj(raw);
  const d = channelDefaults();
  return { crm: r.crm ?? d.crm, email: r.email ?? d.email, whatsapp: r.whatsapp ?? d.whatsapp } as ChannelMatrix;
}

/** A stored (possibly partial or older) block over the defaults. Never throws. */
export function normalizeAlertSettings(raw: unknown): AlertSettings {
  const r = obj(raw);
  const channels = obj(r.channels);
  const instant = obj(r.instant);
  const quiet = obj(r.quietHours);
  const recipients = obj(r.recipients);
  return {
    language: (ALERT_LANGUAGES as readonly string[]).includes(r.language) ? r.language : null,
    channels: { recap: matrix(channels.recap), alerts: matrix(channels.alerts) },
    instant: Object.fromEntries(ALERT_TYPES.map((t) => [t, instant[t] !== false])) as Record<AlertType, boolean>,
    quietHours: {
      enabled: quiet.enabled !== false,
      from: isHHMM(quiet.from) ? quiet.from : "22:00",
      to: isHHMM(quiet.to) ? quiet.to : "07:00",
    },
    includePhoneInWhatsApp: r.includePhoneInWhatsApp !== false,
    recipients: {
      emails: (Array.isArray(recipients.emails) ? recipients.emails : [])
        .filter((e: any) => e && typeof e.address === "string")
        .map((e: any) => ({ address: String(e.address), name: String(e.name ?? "") }))
        .slice(0, MAX_EMAIL_RECIPIENTS),
      whatsapp: (Array.isArray(recipients.whatsapp) ? recipients.whatsapp : [])
        .filter((w: any) => w && typeof w.number === "string")
        .map((w: any) => ({
          number: String(w.number),
          name: String(w.name ?? ""),
          optedInAt: w.optedInAt ? String(w.optedInAt) : null,
          optedOutAt: w.optedOutAt ? String(w.optedOutAt) : null,
        }))
        .slice(0, MAX_WHATSAPP_RECIPIENTS),
    },
  };
}

/** What GET /api/accounts/:id/alert-settings returns. */
export interface AlertSettingsResponse {
  recap: { enabled: boolean; time: string };
  timezone: string;
  configured: boolean;
  alerts: AlertSettings;
  suggestedWhatsapp: { number: string; name: string } | null;
  canEdit: boolean;
}
