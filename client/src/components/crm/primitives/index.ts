// CRM surface primitives — compose these instead of hand-rolling list/card/panel
// classes. Each bakes in tokens from styles/variables.css; per-instance overrides
// flow through `className` (tailwind-merge). See UI_STANDARDS.md.
export { ListCard, type ListCardProps } from "./ListCard";
export { GroupHeader, type GroupHeaderProps } from "./GroupHeader";
export { SectionCard, type SectionCardProps } from "./SectionCard";
export { Pill, type PillProps } from "./Pill";
export { ToolbarButton, type ToolbarButtonProps } from "./ToolbarButton";
export * from "./toolbarButtonClasses";
export { PillSwitch, type PillSwitchItem } from "./PillSwitch";
export { ListSection, type ListSectionProps } from "./ListSection";
export { SplitListSkeleton, ListHeadSkeleton } from "./SplitListSkeleton";
// Page topbar (Style A): build every page header from these.
export { PageTopbar, type PageTopbarProps } from "./PageTopbar";
export { TopbarTabs, type TopbarTab } from "./TopbarTabs";
export { TopbarIconButton, type TopbarIconButtonProps } from "./TopbarIconButton";
export { ExpandingSearch, type ExpandingSearchProps } from "./ExpandingSearch";
// Create / edit forms: the right-hand panel shell (no backdrop; full screen on phones).
export { RightPanel, type RightPanelProps } from "./RightPanel";
