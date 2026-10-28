import { useTranslation } from "react-i18next";
import { GroupHeader } from "@/components/crm/primitives/GroupHeader";
import type { ProspectRow } from "../../prospectRows";
import { ProspectCard } from "./ProspectCard";

/**
 * The folder view: one group per client (the no-client group last, already ordered by
 * folderGroups), a grid of prospect cards under each. One column on a phone.
 */
export function ProspectFolders({ groups, onOpenRow, highlightKey }: {
  groups: Map<string, ProspectRow[]>;
  onOpenRow: (key: string) => void;
  highlightKey: string | null;
}) {
  const { t } = useTranslation("demos");
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {Array.from(groups, ([client, rows]) => (
        <section key={client || "no-client"}>
          <GroupHeader label={client || t("folders.noClient")} count={rows.length} />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2 pb-3 pt-1 max-md:grid-cols-1">
            {rows.map((row) => (
              <ProspectCard key={row.key} row={row} highlighted={row.key === highlightKey} onOpen={() => onOpenRow(row.key)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
