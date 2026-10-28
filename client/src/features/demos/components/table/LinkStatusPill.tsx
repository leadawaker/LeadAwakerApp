import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Globe, MessageCircle } from "lucide-react";
import { Pill } from "@/components/crm/primitives/Pill";
import type { DemoSession } from "../../api/demoSessionsApi";
import { lastActivity, linkChannel, linkStatus, type LinkStatus } from "../../prospectRows";
import { formatSent } from "../../tableColumns";

/** One colour per status, read by the pill and by the folder cards' service chips. */
export const STATUS_COLOR: Record<LinkStatus, string> = {
  never: "var(--mute-2)",
  opened: "var(--wine)",
  replied: "var(--good)",
  expired: "var(--mute)",
};

/** The status word for one link: "Never opened", "Opened", "2 replies", "Expired". */
export function linkStatusLabel(t: TFunction, session: DemoSession): string {
  const status = linkStatus(session);
  if (status === "never") return t("status.unopened");
  if (status === "replied") return t("status.replies", { count: session.browser.replies + session.whatsapp.replies });
  return t(`status.${status}`);
}

/** "27 Oct" of the link's last activity, or "" when it was never opened. */
export function useActivityDate(session: DemoSession): string {
  const { i18n } = useTranslation("demos");
  const at = lastActivity(session);
  return at ? formatSent(at, new Date(), i18n.language) : "";
}

/**
 * How far one link got: the channel it was last used on, and a status word.
 * The date sits under the pill in the cell (useActivityDate): the column is too
 * narrow for the pill, a date and the copy button on one line.
 */
export function LinkStatusPill({ session }: { session: DemoSession }) {
  const { t } = useTranslation("demos");
  const status = linkStatus(session);
  const Icon = linkChannel(session) === "whatsapp" ? MessageCircle : Globe;
  const label = linkStatusLabel(t, session);

  return (
    <Pill
      color={STATUS_COLOR[status]}
      className="max-w-full gap-1"
      // An expired link stays readable but steps back from the live ones.
      style={status === "expired" ? { opacity: 0.6 } : undefined}
    >
      <Icon size={12} className="shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </Pill>
  );
}
