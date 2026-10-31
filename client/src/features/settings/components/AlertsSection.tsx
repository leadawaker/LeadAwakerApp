import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Smartphone } from "lucide-react";
import { useWorkspace, type Account } from "@/hooks/useWorkspace";
import { usePersistedSelection } from "@/hooks/usePersistedSelection";
import { AlertsTab } from "@/features/accounts/components/workspace/alerts/AlertsTab";
import { SocialAccountPicker } from "@/features/social/components/SocialAccountPicker";
import { NotificationsSection } from "./NotificationsSection";

/**
 * Settings > Alerts: the account's recap and alerts, plus how notifications reach you
 * yourself (the last tile). The agency picks the account here, the last pick is kept in
 * this browser; a client always sees their own.
 */
export function AlertsSection() {
  const { t } = useTranslation("settings");
  const { isAgencyUser, accounts, currentAccountId } = useWorkspace();
  const [picked, setPicked] = useState<number | undefined>(undefined);
  const [remembered, setRemembered] = usePersistedSelection<Account>("settings-alerts-account", (a) => a.id, accounts);
  const workspaceId = currentAccountId > 0 ? currentAccountId : undefined;
  const options = [...accounts]
    .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")))
    .map((a) => ({ id: a.id, name: String(a.name ?? ""), timeZone: "", language: null }));
  const accountId = isAgencyUser ? picked ?? remembered?.id ?? workspaceId ?? options[0]?.id : workspaceId;

  const choose = (id: number) => {
    setPicked(id);
    const chosen = accounts.find((a) => a.id === id);
    if (chosen) setRemembered(chosen);
  };

  return (
    <div className="space-y-4" data-testid="section-alerts">
      {isAgencyUser && <SocialAccountPicker options={options} selectedId={accountId ?? null} onSelect={choose} />}
      {accountId != null && (
        <AlertsTab
          key={accountId}
          accountId={accountId}
          stacked
          extra={{
            icon: <Smartphone size={16} />,
            label: t("notifications.mine.label"),
            detail: isAgencyUser ? t("rail.notificationsAgency") : t("rail.notificationsClient"),
            help: t("notifications.mine.help"),
            content: <NotificationsSection channelsOnly />,
          }}
        />
      )}
    </div>
  );
}
