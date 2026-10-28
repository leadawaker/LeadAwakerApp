import { GroupHeader } from "@/components/crm/primitives/GroupHeader";
import { ProspectCard } from "./ProspectCard";
import type { LabelledGroup } from "../sessions/useDateGroups";

/**
 * The cards view: one group per date (already ordered, newest first), a wrapping grid of compact
 * prospect blocks under each heading. Two to a row on a phone, as many as fit on a desktop.
 */
export function ProspectCards({ groups, onOpenRow, highlightKey }: {
  groups: LabelledGroup[];
  onOpenRow: (key: string) => void;
  highlightKey: string | null;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {groups.map((group) => (
        <section key={group.key}>
          <GroupHeader label={group.label} count={group.rows.length} />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-3 pb-5 pt-1 max-md:grid-cols-2 max-md:gap-2">
            {group.rows.map((row) => (
              <ProspectCard key={row.key} row={row} highlighted={row.key === highlightKey} onOpen={() => onOpenRow(row.key)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
