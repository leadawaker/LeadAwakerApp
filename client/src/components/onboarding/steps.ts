/**
 * Onboarding tutorial step definitions for all 4 stages.
 * Tailored for subaccount users (clients) — covers profile setup,
 * exploring campaigns, importing leads, and monitoring conversations.
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

/** Stage 1: Profile & Settings */
const STAGE_1: OnboardingStepDef[] = [
  {
    target: '[data-onboarding="nav-settings"]',
    title: "Complete your profile",
    content: "Let's start by setting up your profile — your name, timezone, and notification preferences.",
    page: "",
    stage: 1,
    disableBeacon: true,
    spotlightClicks: true,
    placement: "right",
  },
  {
    target: '[data-onboarding="profile-name"]',
    title: "Your Name",
    content: "Enter your full name. This is how you'll appear across the platform.",
    page: "/settings",
    stage: 1,
    disableBeacon: true,
    spotlightClicks: true,
  },
  {
    target: '[data-onboarding="profile-timezone"]',
    title: "Timezone",
    content: "Select your timezone so notifications and scheduled messages align with your business hours.",
    page: "/settings",
    stage: 1,
    disableBeacon: true,
    spotlightClicks: true,
  },
  {
    target: '[data-onboarding="save-profile"]',
    title: "Save Your Profile",
    content: "Click Save to apply your changes. You can update these anytime.",
    page: "/settings",
    stage: 1,
    disableBeacon: true,
    spotlightClicks: true,
  },
];

/** Stage 2: Explore Campaigns */
const STAGE_2: OnboardingStepDef[] = [
  {
    target: '[data-onboarding="nav-campaigns"]',
    title: "Your Campaigns",
    content: "Campaigns are outreach sequences that engage your leads. Let's take a look at what's been set up for you.",
    page: "",
    stage: 2,
    disableBeacon: true,
    spotlightClicks: true,
    placement: "right",
  },
  {
    target: '[data-onboarding="campaigns-list"]',
    title: "Campaign Overview",
    content: "Here are your campaigns. Each one has a status, channel (SMS/WhatsApp), and message templates. Click on any campaign to see its details.",
    page: "/campaigns",
    stage: 2,
    disableBeacon: true,
  },
  {
    target: '[data-onboarding="campaign-detail"]',
    title: "Campaign Details",
    content: "This panel shows the campaign's configuration — message templates, bump schedule, AI settings, and performance metrics.",
    page: "/campaigns",
    stage: 2,
    disableBeacon: true,
  },
];

/** Stage 3: Import Leads */
const STAGE_3: OnboardingStepDef[] = [
  {
    target: '[data-onboarding="nav-contacts"]',
    title: "Your Leads",
    content: "Leads are the contacts your campaigns reach out to. Let's see how to add them.",
    page: "",
    stage: 3,
    disableBeacon: true,
    spotlightClicks: true,
    placement: "right",
  },
  {
    target: '[data-onboarding="leads-table"]',
    title: "Leads Table",
    content: "This table shows all your leads with their status, campaign assignment, and engagement data. You can search, filter, and sort.",
    page: "/contacts",
    stage: 3,
    disableBeacon: true,
  },
  {
    target: '[data-onboarding="import-leads-btn"]',
    title: "Import Leads via CSV",
    content: "Click the CSV button to import leads from a spreadsheet. You'll map columns to fields and preview before importing.",
    page: "/contacts",
    stage: 3,
    disableBeacon: true,
    spotlightClicks: true,
  },
];

/** Stage 4: Monitor Conversations */
const STAGE_4: OnboardingStepDef[] = [
  {
    target: '[data-onboarding="nav-chats"]',
    title: "Conversations",
    content: "This is where you'll monitor all lead interactions — incoming replies, AI responses, and manual takeovers.",
    page: "",
    stage: 4,
    disableBeacon: true,
    spotlightClicks: true,
    placement: "right",
  },
  {
    target: '[data-onboarding="conversations-inbox"]',
    title: "Your Inbox",
    content: "The inbox shows all active conversations sorted by recency. Unread messages appear at the top.",
    page: "/conversations",
    stage: 4,
    disableBeacon: true,
  },
  {
    target: '[data-onboarding="conversations-chat"]',
    title: "Chat View",
    content: "Click a conversation to see the full message thread. You can reply manually or let the AI handle it.",
    page: "/conversations",
    stage: 4,
    disableBeacon: true,
  },
  {
    target: '[data-onboarding="nav-calendar"]',
    title: "Calendar",
    content: "When leads book calls, they show up here. That's the end of the tour — you're all set!",
    page: "/conversations",
    stage: 4,
    disableBeacon: true,
    spotlightClicks: true,
    placement: "right",
  },
];

export const ONBOARDING_STAGES: Record<number, OnboardingStepDef[]> = {
  1: STAGE_1,
  2: STAGE_2,
  3: STAGE_3,
  4: STAGE_4,
};

export const STAGE_LABELS: Record<number, string> = {
  1: "Profile Setup",
  2: "Explore Campaigns",
  3: "Your Leads",
  4: "Conversations",
};

export const TOTAL_STAGES = 4;
