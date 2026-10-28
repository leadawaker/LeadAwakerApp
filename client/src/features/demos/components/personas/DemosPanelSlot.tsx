import type { ProspectRow } from "../../prospectRows";
import type { useDemoDraft } from "../../useDemoDraft";
import { CreateDemoPanel } from "../create/CreateDemoPanel";
import { ProspectDetailPanel } from "../detail/ProspectDetailPanel";
import type { DemosPanel } from "./useDemosPageState";

/**
 * The right-hand column (R10): one panel at a time, mounted beside the content so the
 * full-height chain stays intact. `create` renders CreateDemoPanel with the draft DemosPage
 * owns (R22); `detail` renders ProspectDetailPanel over every row, so a search never closes it.
 */
export function DemosPanelSlot({ panel, onClose, draft, rows, onAdded }: {
  panel: DemosPanel;
  onClose: () => void;
  /** The page's one useDemoDraft result (R22). */
  draft: ReturnType<typeof useDemoDraft>;
  /** Every prospect row: ProspectDetailPanel looks its row up here. */
  rows: ProspectRow[];
  onAdded: (prospectGroup: string, clientNiche: string) => void;
}) {
  if (panel?.kind === "create") {
    return (
      <CreateDemoPanel
        draft={draft.draft}
        update={draft.update}
        updateIf={draft.updateIf}
        isCurrent={draft.isCurrent}
        clear={draft.clear}
        markAdded={draft.markAdded}
        onClose={onClose}
        onAdded={onAdded}
      />
    );
  }
  if (panel?.kind === "detail") {
    // Keyed by prospect: the panel's forms hold edits that must not carry over to the next one.
    return <ProspectDetailPanel key={panel.key} rowKey={panel.key} rows={rows} onClose={onClose} />;
  }
  return null;
}
