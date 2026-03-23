/**
 * Onboarding tutorial step definitions for all 4 stages.
 * One continuous tour: Campaigns → Leads → Conversations → Top Bar
 *
 * Each step targets a `data-onboarding` attribute on a UI element.
 */
import type { Step } from "react-joyride";

export interface OnboardingStepDef extends Step {
  /** Route this step belongs to (relative, e.g. "/settings") */
  page: string;
  /** Stage number (1-4) */
  stage: number;
}

/** Stage 1: Explore Campaigns */
const STAGE_1: OnboardingStepDef[] = [
  {
    target: '[data-onboarding="nav-campaigns"]',
    title: "Your Campaigns",
    content: "Campaigns are outreach sequences that engage your leads. Let's take a look at what's been set up for you.",
    page: "",
    stage: 1,
    disableBeacon: true,
    spotlightClicks: true,
    placement: "right",
  },
  {
    target: '[data-onboarding="campaigns-sidebar"]',
    title: "Campaign List",
    content: "This panel shows all your campaigns. Each one has a status, channel (SMS/WhatsApp), and message count. Click any campaign to see its details.",
    page: "/campaigns",
    stage: 1,
    disableBeacon: true,
    placement: "right",
  },
  {
    target: '[data-onboarding="campaign-detail"]',
    title: "Campaign Dashboard",
    content: "This dashboard shows your campaign's performance: messages sent, responses, bookings, and conversion metrics.",
    page: "/campaigns",
    stage: 1,
    disableBeacon: true,
    placement: "left",
  },
];

/** Stage 2: Leads */
const STAGE_2: OnboardingStepDef[] = [
  {
    target: '[data-onboarding="nav-contacts"]',
    title: "Your Leads",
    content: "Leads are the contacts your campaigns reach out to. Let's see how to manage them.",
    page: "",
    stage: 2,
    disableBeacon: true,
    spotlightClicks: true,
    placement: "right",
  },
  {
    target: '[data-onboarding="leads-table"]',
    title: "Leads Overview",
    content: "This view shows all your leads with their status, campaign assignment, and engagement data. You can search, filter, and sort.",
    page: "/contacts",
    stage: 2,
    disableBeacon: true,
  },
  {
    target: '[data-onboarding="leads-view-tabs"]',
    title: "Pipeline View",
    content: "Switch between List, Table, and Pipeline views. The Pipeline view shows your leads as a kanban board grouped by status, so you can track their journey at a glance.",
    page: "/contacts",
    stage: 2,
    disableBeacon: true,
    spotlightClicks: true,
  },
  {
    target: '[data-onboarding="import-leads-btn"]',
    title: "Import Leads via CSV",
    content: "Click the CSV button to import leads from a spreadsheet. You'll map columns to fields and preview before importing.",
    page: "/contacts",
    stage: 2,
    disableBeacon: true,
    spotlightClicks: true,
  },
];

/** Stage 3: Conversations & Calendar */
const STAGE_3: OnboardingStepDef[] = [
  {
    target: '[data-onboarding="nav-chats"]',
    title: "Conversations",
    content: "This is where you'll monitor all lead interactions: incoming replies, AI responses, and manual takeovers.",
    page: "",
    stage: 3,
    disableBeacon: true,
    spotlightClicks: true,
    placement: "right",
  },
  {
    target: '[data-onboarding="conversations-inbox"]',
    title: "Your Inbox",
    content: "The inbox shows all active conversations sorted by recency. Unread messages appear at the top with a badge.",
    page: "/conversations",
    stage: 3,
    disableBeacon: true,
    placement: "right",
  },
  {
    target: '[data-onboarding="conversations-contact"]',
    title: "Contact Details",
    content: "When you select a conversation, this panel shows the lead's profile, tags, score, and history.",
    page: "/conversations",
    stage: 3,
    disableBeacon: true,
    placement: "left",
  },
  {
    target: '[data-onboarding="conversations-chat"]',
    title: "Chat View",
    content: "The main chat area shows the full message thread. You can reply manually or let the AI handle it.",
    page: "/conversations",
    stage: 3,
    disableBeacon: true,
  },
  {
    target: '[data-onboarding="nav-calendar"]',
    title: "Calendar",
    content: "When leads book calls, they show up here. Let's take a quick look.",
    page: "",
    stage: 3,
    disableBeacon: true,
    spotlightClicks: true,
    placement: "right",
  },
  {
    target: '[data-onboarding="calendar-view"]',
    title: "Your Schedule",
    content: "This calendar shows all booked appointments. You can view by day, week, or month.",
    page: "/calendar",
    stage: 3,
    disableBeacon: true,
  },
];

/** Stage 4: Top Bar */
const STAGE_4: OnboardingStepDef[] = [
  {
    target: '[data-onboarding="topbar-search"]',
    title: "Search",
    content: "Quickly find any lead, campaign, or contact by name. Search works across everything in your CRM.",
    page: "",
    stage: 4,
    disableBeacon: true,
    placement: "bottom",
  },
  {
    target: '[data-onboarding="topbar-notifications"]',
    title: "Notifications",
    content: "Stay on top of what matters: new bookings, lead responses, AI handoff requests, and campaign updates all appear here.",
    page: "",
    stage: 4,
    disableBeacon: true,
    placement: "bottom",
  },
  {
    target: '[data-onboarding="topbar-support"]',
    title: "Support",
    content: "Need help? Click here to chat with support. That's the end of the tour. You're all set!",
    page: "",
    stage: 4,
    disableBeacon: true,
    placement: "bottom",
  },
];

export const ONBOARDING_STAGES: Record<number, OnboardingStepDef[]> = {
  1: STAGE_1,
  2: STAGE_2,
  3: STAGE_3,
  4: STAGE_4,
};

/** All steps flattened into one continuous array */
export const ALL_STEPS: OnboardingStepDef[] = [
  ...STAGE_1,
  ...STAGE_2,
  ...STAGE_3,
  ...STAGE_4,
];

/** Index of the first step of each stage in ALL_STEPS */
export const STAGE_START_INDEX: Record<number, number> = {};
let _offset = 0;
for (let s = 1; s <= 4; s++) {
  STAGE_START_INDEX[s] = _offset;
  _offset += (ONBOARDING_STAGES[s] || []).length;
}

export const STAGE_LABELS: Record<number, string> = {
  1: "Campaigns",
  2: "Leads",
  3: "Conversations",
  4: "Top Bar",
};

export const TOTAL_STAGES = 4;
