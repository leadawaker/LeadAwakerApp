import { useTranslation } from "react-i18next";
import { Link } from "wouter";

interface ImpersonationBannerProps {
  role: string;
  onStop: () => void;
}

export function ImpersonationBanner({ role, onStop }: ImpersonationBannerProps) {
  const { t } = useTranslation("crm");

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-white flex items-center justify-center gap-3 px-4"
      style={{ height: "var(--banner-h, 28px)", fontSize: "13px", lineHeight: 1 }}
      data-testid="impersonation-banner"
    >
      <span className="font-medium">
        {t("topbar.impersonationBannerViewing", { role })}
      </span>
      {/* The client nav has no Automation logs; only the real Owner can view as someone, so the way in sits here (J1). */}
      <Link href="/platform/automation-logs" className="underline font-semibold hover:opacity-80 transition-opacity" data-testid="link-impersonation-automations">
        {t("topbar.impersonationBannerLogs")}
      </Link>
      <button
        onClick={onStop}
        className="underline font-semibold hover:opacity-80 transition-opacity"
        data-testid="button-exit-impersonation"
      >
        {t("topbar.impersonationBannerExit")}
      </button>
    </div>
  );
}
