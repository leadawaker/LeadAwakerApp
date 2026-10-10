// Turns what a visit carries (the referring hostname and any utm tags) into a
// channel and a readable source name for the Traffic page. Done when the page
// is read, not when the visit is stored, so a new assistant or network added
// here also relabels the visits already in the table.
import type { TrafficChannel } from "@shared/trafficTypes";

export interface VisitOrigin {
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
}

export interface VisitSource {
  channel: TrafficChannel;
  /** Brand or hostname; null for "direct". */
  label: string | null;
}

type Rule = [test: RegExp, channel: TrafficChannel, label: string];

// Matched against the hostname (without "www.") or the utm_source, lowercase.
// Android apps report themselves as a package name (com.linkedin.android).
// The AI assistants come first: gemini.google.com must not fall through to Google.
const RULES: Rule[] = [
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$|^chatgpt$|^openai$/, "ai", "ChatGPT"],
  [/(^|\.)perplexity\.ai$|^perplexity$/, "ai", "Perplexity"],
  [/(^|\.)claude\.ai$|^claude$/, "ai", "Claude"],
  [/^gemini\.google\.com$|^bard\.google\.com$|^gemini$/, "ai", "Gemini"],
  [/^copilot\.microsoft\.com$|^copilot$/, "ai", "Copilot"],
  [/(^|\.)grok\.com$|(^|\.)x\.ai$/, "ai", "Grok"],
  [/(^|\.)mistral\.ai$/, "ai", "Mistral"],
  [/(^|\.)deepseek\.com$/, "ai", "DeepSeek"],
  [/(^|\.)meta\.ai$/, "ai", "Meta AI"],
  [/(^|\.)you\.com$/, "ai", "You.com"],
  [/(^|\.)phind\.com$/, "ai", "Phind"],

  [/^com\.google\.android\.gm$|^mail\.google\.com$|(^|\.)outlook\.(live|office)\.com$|^mail\.yahoo\.com$|(^|\.)proton\.me$/, "email", "Email"],

  [/(^|\.)google\.[a-z.]{2,6}$|^google$|^com\.google\.android\.googlequicksearchbox$/, "search", "Google"],
  [/(^|\.)bing\.com$|^bing$/, "search", "Bing"],
  [/(^|\.)duckduckgo\.com$/, "search", "DuckDuckGo"],
  [/(^|\.)ecosia\.org$/, "search", "Ecosia"],
  [/(^|\.)yahoo\.com$/, "search", "Yahoo"],
  [/^search\.brave\.com$/, "search", "Brave Search"],
  [/(^|\.)startpage\.com$/, "search", "Startpage"],
  [/(^|\.)yandex\.[a-z.]{2,6}$/, "search", "Yandex"],
  [/(^|\.)baidu\.com$/, "search", "Baidu"],

  [/(^|\.)linkedin\.com$|^lnkd\.in$|^com\.linkedin\.android$|^linkedin$/, "social", "LinkedIn"],
  [/(^|\.)facebook\.com$|^fb\.me$|^com\.facebook\.(katana|lite)$|^facebook$|^fb$/, "social", "Facebook"],
  [/(^|\.)instagram\.com$|^com\.instagram\.android$|^instagram$|^ig$/, "social", "Instagram"],
  [/^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$|^twitter$/, "social", "X"],
  [/(^|\.)youtube\.com$|^youtu\.be$|^youtube$/, "social", "YouTube"],
  [/(^|\.)tiktok\.com$|^tiktok$/, "social", "TikTok"],
  [/(^|\.)reddit\.com$|^reddit$/, "social", "Reddit"],
  [/(^|\.)whatsapp\.com$|^wa\.me$|^com\.whatsapp(\.w4b)?$|^whatsapp$/, "social", "WhatsApp"],
  [/^t\.me$|(^|\.)telegram\.org$|^org\.telegram\.messenger$|^telegram$/, "social", "Telegram"],
];

const EMAIL_MEDIUMS = new Set(["email", "e-mail", "newsletter", "mail"]);

export function classifyVisit(origin: VisitOrigin): VisitSource {
  const host = (origin.referrerHost || "").toLowerCase().replace(/^www\./, "");
  const utm = (origin.utmSource || "").toLowerCase().replace(/^www\./, "");
  const medium = (origin.utmMedium || "").toLowerCase();

  // A utm_source is something the link's author chose to say, so it wins over
  // the referrer (ChatGPT tags its links utm_source=chatgpt.com and its apps
  // often send no referrer at all).
  for (const key of [utm, host]) {
    if (!key) continue;
    const rule = RULES.find(([test]) => test.test(key));
    if (rule) return { channel: rule[1], label: rule[2] };
  }
  if (EMAIL_MEDIUMS.has(medium)) return { channel: "email", label: origin.utmSource || "Email" };
  if (utm) return { channel: "campaign", label: origin.utmSource };
  if (host) return { channel: "referral", label: host };
  return { channel: "direct", label: null };
}
