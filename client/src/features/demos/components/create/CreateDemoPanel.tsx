import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Loader2, Plus, Users } from "lucide-react";
import { PillSwitch, RightPanel, type PillSwitchItem } from "@/components/crm/primitives";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import type { CreateMode, DemoDraft } from "../../createDraft";
import { DemoApiError, useCreateProspect } from "../../api/demoProspectsApi";
import { TOUCH_ROW } from "../../touchTargets";
import { FormField } from "../form/FormField";
import { ExistingClientFields } from "./ExistingClientFields";
import { WebsiteScanFields } from "./WebsiteScanFields";
import "../panelTouch.css";

/**
 * The "+ New demo" side panel: who the demo is for, and which Client it wears. It adds a
 * prospect row to the table and never mints a link (links are minted from the table). The
 * fields live in `draft` (owned by DemosPage), so closing the panel or switching tabs keeps them.
 */
export function CreateDemoPanel({ draft, update, updateIf, isCurrent, clear, markAdded, onClose, onAdded }: {
  draft: DemoDraft;
  update: (patch: Partial<DemoDraft>) => void;
  /** For results of requests that can outlive Clear (see useDemoDraft): written only while the prospect group matches. */
  updateIf: (group: string, patch: Partial<DemoDraft>) => boolean;
  isCurrent: (group: string) => boolean;
  clear: () => void;
  markAdded: () => void;
  onClose: () => void;
  /** The new row's group key, so the table can flash it. */
  onAdded: (prospectGroup: string) => void;
}) {
  const { t } = useTranslation("demos");
  const createProspect = useCreateProspect();
  const [nameTouched, setNameTouched] = useState(false);
  const pending = createProspect.isPending;
  const nameOk = draft.firstName.trim() !== "";

  const modes: PillSwitchItem<CreateMode>[] = [
    { id: "existing", label: t("create.modeExisting"), icon: Users, color: "var(--wine)" },
    { id: "website", label: t("create.modeWebsite"), icon: Globe, color: "var(--wine)" },
  ];

  // Only the first name is needed: a row without a Client is allowed (its cells then mint the campaign's own persona).
  const submit = async () => {
    if (!nameOk || pending) return;
    const group = draft.prospectGroup;
    const added = () => {
      toast({ variant: "success", title: t("create.added") });
      onAdded(group);
      markAdded();
      onClose();
    };
    try {
      await createProspect.mutateAsync({
        prospectGroup: group,
        firstName: draft.firstName.trim(),
        companyName: draft.companyName.trim(),
        clientNiche: draft.clientNiche,
        language: draft.language,
        aiDisclosure: draft.aiDisclosure,
        market: draft.market,
        websiteUrl: draft.websiteUrl.trim(),
      });
      added();
    } catch (e) {
      // `exists` for this draft's own group: an earlier add landed but its response was lost, so the row is there.
      if (e instanceof DemoApiError && e.code === "exists") {
        added();
        return;
      }
      toast({ variant: "destructive", title: t("create.addFailed"), description: e instanceof Error ? e.message : undefined });
    }
  };

  // The footer is built here (not RightPanel's default) so every button is 44px on a phone.
  const footer = (
    <>
      <button type="button" onClick={onClose} disabled={pending} className="la-btn la-btn--soft h-9 px-4 text-sm disabled:opacity-50 max-md:h-11">
        {t("common.cancel")}
      </button>
      <div className="flex items-center gap-2">
        <button type="button" onClick={clear} disabled={pending} className="la-btn la-btn--soft h-9 px-4 text-sm disabled:opacity-50 max-md:h-11">
          {t("create.clear")}
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={pending || !nameOk}
          className="la-btn la-btn--wine h-9 gap-1.5 px-5 text-sm disabled:opacity-50 max-md:h-11"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {t("create.addToTable")}
        </button>
      </div>
    </>
  );

  return (
    <RightPanel
      title={t("create.title")}
      subtitle={
        <div className="mt-2 max-md:[&_[role=tab]]:!h-11">
          <PillSwitch items={modes} value={draft.mode} onChange={(mode) => update({ mode })} ariaLabel={t("create.title")} />
        </div>
      }
      onClose={onClose}
      footer={footer}
      submitting={pending}
      data-testid="create-demo-panel"
    >
      <FormField label={t("create.firstName")} htmlFor="demo-first-name" required hint={nameTouched && !nameOk ? t("create.firstNameRequired") : undefined}>
        <Input
          id="demo-first-name"
          value={draft.firstName}
          maxLength={80}
          required
          aria-invalid={nameTouched && !nameOk}
          className={TOUCH_ROW}
          onChange={(e) => update({ firstName: e.target.value })}
          onBlur={() => setNameTouched(true)}
        />
      </FormField>
      <FormField label={t("create.company")} htmlFor="demo-company" hint={t("create.companyHint")}>
        <Input
          id="demo-company"
          value={draft.companyName}
          maxLength={120}
          className={TOUCH_ROW}
          onChange={(e) => update({ companyName: e.target.value })}
        />
      </FormField>

      {draft.mode === "existing" ? (
        <ExistingClientFields draft={draft} update={update} />
      ) : (
        <WebsiteScanFields
          draft={draft}
          update={update}
          updateIf={updateIf}
          isCurrent={isCurrent}
          onBuilt={(client) => update({ mode: "existing", clientNiche: client, review: null })}
        />
      )}
    </RightPanel>
  );
}
