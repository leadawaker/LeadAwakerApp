import { useTranslation } from "react-i18next";
import type { DemoDraft } from "../../createDraft";
import { ClientPicker } from "../form/ClientPicker";
import { FormField } from "../form/FormField";
import { LanguageSeg } from "../form/LanguageSeg";

/** "Existing client": the language, and the Client dropdown. The disclosure and market sit below, for both modes (CreateDemoPanel). */
export function ExistingClientFields({ draft, update }: {
  draft: DemoDraft;
  update: (patch: Partial<DemoDraft>) => void;
}) {
  const { t } = useTranslation("demos");
  return (
    <div className="space-y-4">
      <FormField label={t("create.language")}>
        <LanguageSeg value={draft.language} onChange={(language) => update({ language })} ariaLabel={t("create.language")} />
      </FormField>
      <FormField label={t("create.client")}>
        <ClientPicker value={draft.clientNiche} onChange={(clientNiche) => update({ clientNiche })} language={draft.language} />
      </FormField>
    </div>
  );
}
