// Shared entity-list infrastructure — the filter/sort/group/search/selection
// orchestration (useEntityList) + the grouped card-list composition shell
// (EntityListView) that Leads/Prospects/Billing/Prompts/Tags each hand-rolled.
// Inline-table mode reuses components/DataTable. See useEntityList.ts header.
export { useEntityList } from "./useEntityList";
export type {
  UseEntityListOptions,
  UseEntityListResult,
  SortConfig,
  SortDirection,
  FilterState,
  GroupDescriptor,
  EntityListRow,
} from "./useEntityList";
export { EntityListView, type EntityListViewProps } from "./EntityListView";
