# Implementation Plan: Documentation Page Redesign

## Overview

Restructure the Documentation page from a full-width single-column layout to a sidebar + content split-pane layout matching the Settings page pattern. Add agency/subaccount tab switching, fix title conventions, and expand documentation content.

## Phase 1: Layout Restructure (Sidebar + Content Split)

Replace the horizontal TOC bar with a vertical left sidebar and content area.

### Tasks
- [x] Refactor `DocsPage` layout from single-column to split-pane (`sidebar + content`) following the Settings page pattern
- [x] Create left sidebar nav (`w-[340px] bg-muted rounded-lg`) with section items as vertical card buttons
- [x] Style active sidebar item with `bg-highlight-selected text-foreground font-semibold` and inactive with `bg-card hover:bg-card-hover text-muted-foreground`
- [x] Each sidebar item shows the section icon + label (reuse existing icon assignments from `OPERATOR_TOC` / `CLIENT_TOC`)
- [x] Clicking a sidebar item scrolls the right content pane to the corresponding `DocSection` (keep `scrollIntoView({ behavior: "smooth" })`)
- [x] Move search input into the sidebar header area (below the title, above the nav items)
- [x] Add mobile responsive fallback: sidebar collapses to horizontal scrollable pill bar (same pattern as Settings mobile using `useIsMobile()`)
- [x] Remove the old `TocBar` horizontal component

---

## Phase 2: Title Convention + Tab Switcher

### Tasks
- [x] Update page title from `text-lg font-bold tracking-tight` to `text-2xl font-semibold font-heading text-foreground leading-tight`
- [x] Place page title in sidebar header area: `px-3.5 pt-5 pb-1` (matching Settings)
- [x] Rename tabs: "Operator Manual" -> "Agency Docs", "Client Guide" -> "User Docs"
- [x] Move the tab switcher (agency/user docs toggle) into the sidebar, positioned between the title and the search input
- [x] Tab switcher uses existing pill button pattern: `h-9 px-4 rounded-full` with active state `bg-card border border-black/[0.125]`
- [x] Hide tab switcher entirely in subaccount view (when `!isOperatorRole()`), show only User Documentation sections
- [x] Keep "What's New" expand-on-hover button in the sidebar header area (operator-only)

---

## Phase 3: Content Expansion & Improvement [complex]

### Tasks
- [x] Expand Operator Manual (Agency Documentation) with new sections
  - [x] Add "7 - User Management & Roles" section with permissions table
  - [x] Add "8 - Prompt Library & AI Personas" section
  - [x] Add "9 - Billing & Invoicing" section
  - [x] Expand "Account Setup" with Twilio number types and A2P 10DLC note
  - [x] Expand "Creating a Campaign" with SMS vs WhatsApp guidance and template approval
  - [x] Expand "Troubleshoot" with 3 new entries (spam, template approval, score updates)
- [x] Expand Client Guide (User Documentation) with new sections
  - [x] Add "Getting Started" section
  - [x] Add "Managing Your Account" section
  - [x] Add "Reports & Insights" section
  - [x] Expand "Reading Conversations" with message status icons and manual takeover tips
  - [x] Expand FAQ with 4 new questions
- [x] Update the "What's New" changelog to include v1.5 entry

---

## Phase 4: Final Polish

### Tasks
- [x] Ensure dark mode works correctly on all new/modified elements (tip boxes, badges, sidebar items)
- [ ] Verify `npx tsc --noEmit` passes with no errors (skipped: OOM on Pi — tsc hook will catch on next edit)
- [x] Verify mobile responsiveness (sidebar collapses to pills, content scrolls properly)
