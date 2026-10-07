import { useTranslation } from "react-i18next";
import { ExternalLink, Loader2, RotateCcw, UploadCloud } from "lucide-react";
import { hubspotContactUrl, usePushToHubspot, type VoiceCaller } from "../api/voiceCallsApi";

/**
 * Owner only. States: Push to HubSpot, Pushing, In HubSpot (link + Update HubSpot),
 * Failed, retry. A re-push updates the stored contact, never a second one.
 */
export function HubspotPushButton({ caller }: { caller: VoiceCaller }) {
  const { t } = useTranslation("voiceCalls");
  const push = usePushToHubspot();
  const leadsId = caller.leadsId;
  if (leadsId == null) return null;

  const contactUrl = push.data?.url ?? (caller.hubspotContactId ? hubspotContactUrl(caller.hubspotContactId) : null);
  const failed = push.isError && !push.isPending;
  const label = push.isPending
    ? t("callers.hubspot.pushing")
    : failed
      ? t("callers.hubspot.failed")
      : contactUrl ? t("callers.hubspot.update") : t("callers.hubspot.push");
  const Icon = push.isPending ? Loader2 : failed ? RotateCcw : UploadCloud;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {contactUrl && (
        <a
          href={contactUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={t("callers.hubspot.open")}
          data-testid="voice-caller-hubspot-link"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--good)", textDecoration: "none" }}
        >
          {t("callers.hubspot.inHubspot")}
          <ExternalLink size={12} />
        </a>
      )}
      <button
        type="button"
        className={`la-btn la-btn--soft${failed ? " on" : ""}`}
        disabled={push.isPending}
        onClick={() => push.mutate({ leadsId })}
        title={failed ? push.error?.message : undefined}
        data-testid="voice-caller-hubspot"
        data-state={push.isPending ? "pushing" : failed ? "failed" : contactUrl ? "in-hubspot" : "idle"}
        style={{ height: 32, flexShrink: 0 }}
      >
        <Icon className={`h-4 w-4 shrink-0${push.isPending ? " animate-spin" : ""}`} />
        {label}
      </button>
    </div>
  );
}
