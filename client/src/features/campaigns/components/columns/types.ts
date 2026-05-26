import type { Campaign } from "@/types/models";

export interface ColumnBaseProps {
  campaign: Campaign;
  isEditing: boolean;
  draft: Record<string, unknown>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  focusField?: string | null;
  onStartEditField?: (field: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}
