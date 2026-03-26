// LeadsCardView — re-export facade
// All implementation has moved to ./cardView/

export type { ViewMode, VirtualListItem, GroupByOption, SortByOption } from "./cardView/types";
export { PIPELINE_HEX, LIST_RING_SIZE } from "./cardView/constants";
export { getLeadId, getFullName, getInitials, getScore, getStatus } from "./cardView/leadUtils";
export { ListScoreRing } from "./cardView/atoms";
export { LeadDetailView, KanbanDetailPanel } from "./cardView/LeadDetailView";
export { LeadsCardView } from "./cardView/LeadsCardViewMain";
export { getLeadStatusAvatarColor as getStatusAvatarColor } from "@/lib/avatarUtils";
