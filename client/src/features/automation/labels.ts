import type { TFunction } from "i18next";
import type { AutomationTrigger } from "@shared/automationCatalogue";
import type { SummaryToken } from "@shared/automationTypes";

export const automationName = (t: TFunction, id: string) => t(`names.${id}`, { defaultValue: id });
export const automationDescription = (t: TFunction, id: string) => t(`descriptions.${id}`, { defaultValue: "" });
export const actionLabel = (t: TFunction, action: string) => t(`actions.${action}`, { defaultValue: action.replace(/_/g, " ") });

export function triggerLabel(t: TFunction, trigger: AutomationTrigger): string {
  if (trigger.type === "event") return t(`trigger.event.${trigger.on}`, { defaultValue: trigger.on });
  if (trigger.type === "daily") return t("trigger.daily", { at: trigger.at });
  const s = trigger.everySeconds;
  if (s < 60) return t("trigger.everySeconds", { n: s });
  if (s < 3600) return t("trigger.everyMinutes", { n: Math.round(s / 60) });
  return t("trigger.everyHours", { n: Math.round(s / 3600) });
}

export function summaryText(t: TFunction, tokens: SummaryToken[]): string {
  return tokens.map((tok) => t(`summaryTokens.${tok.key}`, { ...(tok.values ?? {}), defaultValue: tok.key })).join(" · ");
}

export function timeAgo(t: TFunction, iso: string | null): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 1) return t("ago.justNow");
  if (mins < 60) return t("ago.minutes", { n: mins });
  const h = Math.round(mins / 60);
  if (h < 48) return t("ago.hours", { n: h });
  return t("ago.days", { n: Math.round(h / 24) });
}

/** Engine reasons are either a snake_case code (translated) or a raw error message (shown as is). */
export function reasonLabel(t: TFunction, reason: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(reason)) return reason;
  return t(`reasons.${reason}`, { defaultValue: reason.replace(/_/g, " ") });
}
