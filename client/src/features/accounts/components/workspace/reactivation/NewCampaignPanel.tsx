// New reactivation campaign for this account: the right-hand create panel.
// It runs the Campaigns page's create flow with the account preset: a draft
// with the same defaults, a real (not demo) campaign, then the default tags.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { RightPanel } from "@/components/crm/primitives";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createCampaign } from "@/features/campaigns/api/campaignsApi";
import { cloneDefaultTags } from "@/features/campaigns/lib/campaignWrites";

export function NewCampaignPanel({ accountId, accountName, onCreated, onClose, className }: {
  accountId: number;
  accountName: string;
  /** The new campaign's row, as POST /api/campaigns returns it. */
  onCreated: (row: Record<string, any>) => void;
  onClose: () => void;
  className?: string;
}) {
  const { t } = useTranslation("accounts");
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();

  const submit = async () => {
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const row = await createCampaign({
        name: trimmed,
        status: "Draft",
        type: "Re-engagement",
        campaign_type: "reactivation",
        description: "",
        start_date: new Date().toISOString().slice(0, 10),
        is_demo: false, // a client's own campaign: demo campaigns are left out of Home and the Services list
        agent_name: "Sofia",
        ai_model: "gpt-4.1",
        Accounts_id: accountId,
      });
      const id = Number(row?.id ?? row?.Id);
      if (id) await cloneDefaultTags(id, row?.name || trimmed);
      onCreated(row);
    } catch {
      toast({ title: t("reactivationTab.create.failed"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RightPanel
      title={t("reactivationTab.create.title")}
      subtitle={t("reactivationTab.create.subtitle", { account: accountName })}
      onClose={onClose}
      submitLabel={t("reactivationTab.create.submit")}
      submitIcon={<Plus className="h-3.5 w-3.5" />}
      onSubmit={submit}
      submitting={saving}
      submitDisabled={!trimmed}
      className={className}
      data-testid="reactivation-create-panel"
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-2">
        <Label htmlFor="reactivation-new-name">{t("reactivationTab.create.name")}</Label>
        <Input
          id="reactivation-new-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("reactivationTab.create.namePlaceholder")}
          autoFocus
          data-testid="reactivation-create-name"
        />
      </form>
      <p className="text-xs text-muted-foreground" style={{ lineHeight: 1.5 }}>{t("reactivationTab.create.help")}</p>
    </RightPanel>
  );
}
