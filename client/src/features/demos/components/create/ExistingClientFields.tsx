import { useTranslation } from "react-i18next";
import type { DemoDraft } from "../../createDraft";
import { ClientPicker } from "../form/ClientPicker";
import { FormField } from "../form/FormField";
import { LanguageSeg } from "../form/LanguageSeg";
import { MoreOptions } from "../form/MoreOptions";

/** "Existing client": pick a saved Client, the language, and (collapsed) the settings most demos leave alone. */
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
      <MoreOptions
        open={draft.moreOpen}
        onOpenChange={(moreOpen) => update({ moreOpen })}
        language={draft.language}
        aiDisclosure={draft.aiDisclosure}
        market={draft.market}
        onChange={update}
      />
    </div>
  );
}
