import type { ContractRow } from "../../types";
import { ContractDetailView, ContractDetailViewEmpty } from "../ContractDetailView";

// Inline contract detail for the workspace. The underlying ContractDetailView is
// already wine/paper neu-raised + fully wired (SignWell, upload, signature
// timeline, deal structure, PDF embed); we render it full-height without the
// drawer/background chrome.
interface Props {
  contract: ContractRow;
  isAgencyUser: boolean;
  onMarkSigned: (id: number) => Promise<any>;
  onDelete: (id: number) => Promise<void>;
  onRefresh: () => void;
  onNew?: () => void;
  onUpdate?: (id: number, patch: Record<string, any>) => Promise<any>;
}

export function ContractDetailPanel(props: Props) {
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <ContractDetailView {...props} noBackground />
    </div>
  );
}

export function ContractDetailPanelEmpty() {
  return <ContractDetailViewEmpty />;
}
