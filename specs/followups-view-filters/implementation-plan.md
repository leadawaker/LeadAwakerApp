# Implementation Plan: Follow-ups View Filters (#244)

## Overview

Add filter, sort, search, and group-by controls to the Follow-ups view in ProspectsPage.tsx, matching the toolbar pattern used by table and pipeline views.

## Phase 1: State & Filtering Logic

### Tasks
- [x] Add followUpSearch, followUpSortBy, followUpFilterPriority, followUpFilterContactMethod state + toggles
- [x] Add FollowUpSortBy type and CONTACT_METHOD_OPTIONS constant
- [x] Update followUpRows useMemo to apply search, all filters, and configurable sort
- [x] Update isFollowUpFilterActive and add followUpActiveFilterCount
- [x] Update clearFollowUpFilters to clear all filter arrays

## Phase 2: Toolbar UI

### Tasks
- [x] Add search input to follow-ups toolbar (matching table search pill)
- [x] Add sort dropdown with date_asc/date_desc/priority/name_asc options
- [x] Add priority filter section in filter dropdown (using FilterAccordionSection)
- [x] Add contact method filter section in filter dropdown
- [x] Fix group-by dropdown to use filter.contactMethod key

## Phase 3: i18n

### Tasks
- [x] Add sort.dateSoonest, sort.dateLatest to en/nl/pt prospects.json
- [x] Add filter.contactMethod to en/nl/pt prospects.json
- [x] Add followups.searchPlaceholder to en/nl/pt prospects.json
