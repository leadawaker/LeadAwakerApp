import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import type { DemoProspectSettings } from "@shared/demoProspects";
import { useUpdateProspect } from "../../api/demoProspectsApi";
import { changedSettings, failedMessages, settingsOf } from "../../prospectDetail";
import type { ProspectRow } from "../../prospectRows";
import { TOUCH_ROW } from "../../touchTargets";
import { ClientPicker } from "../form/ClientPicker";
import { FormField } from "../form/FormField";
import { LanguageSeg } from "../form/LanguageSeg";
import { MoreOptions } from "../form/MoreOptions";

/**
 * Edit a prospect after its links were sent: name, company, Client, language, and the AI
 * disclosure and market. The server rewrites every link the prospect holds, so Save sends only
 * what changed. When some links fail the server keeps the old settings, so the edit stays in
 * the form (it is never reset from the row) and pressing Save again retries it.
 */
export function ProspectSettingsForm({ row }: { row: ProspectRow }) {
  const { t } = useTranslation("demos");
  const ids = useId();
  const update = useUpdateProspect();
  const [draft, setDraft] = useState(() => settingsOf(row));
  const [moreOpen, setMoreOpen] = useState(() => row.aiDisclosure !== "" || row.market !== "");
  const [failures, setFailures] = useState<string[]>([]);

  const set = (p: Partial<DemoProspectSettings>) => setDraft((d) => ({ ...d, ...p }));
  const patch = changedSettings(row, draft);
  const canSave = Object.keys(patch).length > 0 && draft.firstName.trim() !== "" && !update.isPending;

  const save = async () => {
    if (!canSave) return;
    setFailures([]);
    try {
      const result = await update.mutateAsync({ group: row.key, patch });
      const messages = failedMessages(result.failedTokens ?? []);
      if (messages.length === 0) {
        // A prospect with no links (or none that changed) has nothing to count.
        const count = result.updatedTokens.length;
        toast({ variant: "success", title: count === 0 ? t("detail.settingsSavedPlain") : t("detail.settingsSaved", { count }) });
        return;
      }
      setFailures(messages);
      toast({ variant: "destructive", title: t("detail.settingsFailed"), description: messages.join(" ") });
    } catch (e) {
      toast({ variant: "destructive", title: t("detail.saveFailed"), description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <div className="space-y-4">
      <FormField label={t("create.firstName")} htmlFor={`${ids}-first`} required>
        <Input
          id={`${ids}-first`}
          value={draft.firstName}
          maxLength={80}
          required
          aria-invalid={draft.firstName.trim() === ""}
          className={TOUCH_ROW}
          onChange={(e) => set({ firstName: e.target.value })}
        />
      </FormField>
      <FormField label={t("create.company")} htmlFor={`${ids}-company`}>
        <Input
          id={`${ids}-company`}
          value={draft.companyName}
          maxLength={120}
          className={TOUCH_ROW}
          onChange={(e) => set({ companyName: e.target.value })}
        />
      </FormField>
      <FormField label={t("create.language")}>
        <LanguageSeg value={draft.language} onChange={(language) => set({ language })} ariaLabel={t("create.language")} />
      </FormField>
      <FormField label={t("create.client")}>
        {/* The server refuses to clear a prospect's Client, so picking the selected one again is ignored rather than sent. */}
        <ClientPicker
          value={draft.clientNiche}
          onChange={(clientNiche) => {
            if (clientNiche) set({ clientNiche });
          }}
          language={draft.language}
        />
      </FormField>
      <MoreOptions
        open={moreOpen}
        onOpenChange={setMoreOpen}
        language={draft.language}
        aiDisclosure={draft.aiDisclosure}
        market={draft.market}
        onChange={set}
      />

      {failures.length > 0 && (
        <div role="alert" className="space-y-1" style={{ fontSize: 12.5, color: "hsl(var(--destructive))" }}>
          <p style={{ fontWeight: 600 }}>{t("detail.settingsFailed")}</p>
          <ul className="list-disc pl-4">
            {failures.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={!canSave}
        className={`la-btn la-btn--wine h-9 gap-1.5 px-5 text-sm disabled:opacity-50 ${TOUCH_ROW}`}
      >
        {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {t("detail.save")}
      </button>
    </div>
  );
}
