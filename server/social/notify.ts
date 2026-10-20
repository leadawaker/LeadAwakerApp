// Notifications for Instagram publishing. Agency copy is English and written by the caller;
// client copy (to the account's Managers) comes from the small en/nl/pt map below, keyed by the account's language.
// A failed notification is logged and never breaks the caller.
import { storage } from "../storage";
import { createAndDispatchNotification } from "../notification-dispatcher";

export type SocialNotifType =
  | "social_post_needs_approval"
  | "social_post_held"
  | "social_post_failed"
  | "social_post_published"
  | "social_post_rejected"
  | "social_token_problem";

type Lang = "en" | "nl" | "pt";
type ClientKey = "needs_approval" | "published";

const AGENCY_ACCOUNT_ID = 1;
const CAPTION_PREVIEW_MAX = 80;

/** Client-facing copy. pt is Brazilian Portuguese. Placeholders: {caption}, {when}. */
const CLIENT_COPY: Record<ClientKey, Record<Lang, { title: string; body: string }>> = {
  needs_approval: {
    en: { title: "New video to approve", body: "\"{caption}\" is scheduled for {when}. Tap to view and approve." },
    nl: { title: "Nieuwe video om goed te keuren", body: "\"{caption}\" staat gepland voor {when}. Tik om te bekijken en goed te keuren." },
    pt: { title: "Novo vídeo para aprovar", body: "\"{caption}\" está agendado para {when}. Toque para ver e aprovar." },
  },
  published: {
    en: { title: "Your video is live on Instagram", body: "\"{caption}\" was published on Instagram. Tap to view." },
    nl: { title: "Je video staat op Instagram", body: "\"{caption}\" is op Instagram geplaatst. Tik om te bekijken." },
    pt: { title: "Seu vídeo está no Instagram", body: "\"{caption}\" foi publicado no Instagram. Toque para ver." },
  },
};

const NO_CAPTION: Record<Lang, string> = { en: "(no caption)", nl: "(geen bijschrift)", pt: "(sem legenda)" };

/** Accounts store "English" / "Dutch" / "Portuguese" (or a code); anything else is English. */
function langOf(language: string | null | undefined): Lang {
  const l = (language ?? "").trim().toLowerCase();
  if (l.startsWith("pt") || l.startsWith("portug")) return "pt";
  if (l.startsWith("nl") || l.startsWith("dutch") || l.startsWith("neder")) return "nl";
  return "en";
}

function captionPreview(caption: string | undefined, lang: Lang): string {
  const firstLine = (caption ?? "").split(/\r?\n/).map((s) => s.trim()).find(Boolean) ?? "";
  if (!firstLine) return NO_CAPTION[lang];
  return firstLine.length > CAPTION_PREVIEW_MAX ? `${firstLine.slice(0, CAPTION_PREVIEW_MAX - 1).trimEnd()}…` : firstLine;
}

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k: string) => vars[k] ?? "");
}

async function send(
  recipients: { id: number | null }[],
  n: { type: SocialNotifType; title: string; body: string; accountId: number; link: string },
): Promise<void> {
  await Promise.all(recipients.map((u) =>
    createAndDispatchNotification({
      type: n.type,
      title: n.title,
      body: n.body,
      userId: u.id!,
      accountId: n.accountId,
      read: false,
      link: n.link,
    }).catch((err: any) => console.error(`[social-notify] ${n.type} to user ${u.id} failed:`, err?.message ?? err)),
  ));
}

/** To every user on the agency account. */
export async function notifyAgency(n: { type: SocialNotifType; title: string; body: string; accountId: number; link: string }): Promise<void> {
  try {
    const users = (await storage.getAppUsers()).filter((u) => u.accountsId === AGENCY_ACCOUNT_ID && u.id != null);
    await send(users, n);
  } catch (err: any) {
    console.error(`[social-notify] ${n.type} for account ${n.accountId} failed:`, err?.message ?? err);
  }
}

/** To the account's Managers, in the account's language. vars: caption, when (needs_approval). */
export async function notifyAccountManagers(
  accountId: number,
  n: { type: SocialNotifType; key: ClientKey; vars: Record<string, string>; link: string },
): Promise<void> {
  try {
    const [users, account] = await Promise.all([storage.getAppUsers(), storage.getAccountById(accountId)]);
    const managers = users.filter((u) => u.accountsId === accountId && u.role === "Manager" && u.id != null);
    if (managers.length === 0) return;
    const lang = langOf(account?.language);
    const vars = { ...n.vars, caption: captionPreview(n.vars.caption, lang) };
    const copy = CLIENT_COPY[n.key][lang];
    await send(managers, { type: n.type, title: render(copy.title, vars), body: render(copy.body, vars), accountId, link: n.link });
  } catch (err: any) {
    console.error(`[social-notify] ${n.type} to managers of account ${accountId} failed:`, err?.message ?? err);
  }
}
