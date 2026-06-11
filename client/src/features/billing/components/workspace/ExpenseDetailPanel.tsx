import type { ExpenseRow } from "../../types";
import { ExpenseDetailView, ExpenseDetailViewEmpty } from "../ExpenseDetailView";

// Inline expense detail for the workspace. ExpenseDetailView already renders the
// VAT breakdown + reclaimable-BTW callout + PDF, fully wired (edit/delete/download);
// we render it full-height without the drawer/background chrome.
interface Props {
  expense: ExpenseRow;
  onEdit: (expense: ExpenseRow) => void;
  onDeleted: () => void;
  onNew?: () => void;
}

export function ExpenseDetailPanel(props: Props) {
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <ExpenseDetailView {...props} noBackground />
    </div>
  );
}

export function ExpenseDetailPanelEmpty({ onNew }: { onNew?: () => void }) {
  return <ExpenseDetailViewEmpty onNew={onNew} />;
}
