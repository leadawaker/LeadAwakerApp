// Shared types for the Accounts workspace (prototype migration).
import type { AccountRow } from "../AccountDetailsDialog";

export type { AccountRow };

export type WorkspaceTab = "overview" | "integrations" | "knowledge" | "communication";

// ── Identity-card metric chip ────────────────────────────────────────────────
export interface MetaChip {
  key: string;
  label: string;
  value: string | number;
  sub: string;
  accent: string; // CSS var string, e.g. 'var(--wine)'
}

// ── Integration field (Twilio / Instagram) ───────────────────────────────────
export interface IntegrationField {
  key: string;
  label: string;
  value: string;
  mono?: boolean;
  secret?: boolean;
  copy?: boolean;
  wrap?: boolean;
}

export interface IntegrationData {
  connected: boolean;
  fields: IntegrationField[];
}

// ── Voice clone language slot ─────────────────────────────────────────────────
export interface VoiceSlot {
  lang: "EN" | "PT" | "NL";
  langKey: "en" | "pt" | "nl";
  flag: string;
  ready: boolean;
  voiceId: string | null;
}

// ── Adapted account detail (presentation shape) ───────────────────────────────
export interface AccountDetail {
  id: number;
  name: string;
  mono: string;
  logoUrl: string | null;
  type: string;
  niche: string;
  status: string;
  contact: { email: string; phone: string; website: string; address: string };
  schedule: {
    timezone: string;
    language: string;
    hoursOpen: string;
    hoursClose: string;
    dailySends: string;
    optOut: string;
  };
  meta: { taxId: string; description: string; notes: string; serviceCategories: string[] };
  twilio: IntegrationData;
  instagram: IntegrationData;
  voices: VoiceSlot[];
}

// ── Related-entity rows ───────────────────────────────────────────────────────
export interface CampaignRowData {
  id: number;
  name: string;
  mono: string;
  channel: string;
  status: string;
  leads: number;
  resp: number;
  contractId: number | null;
}

export interface ContractRowData {
  id: number;
  name: string;
  status: string; // lowercased: active | pending | expired
  value: string;  // formatted, e.g. "$2,500"
  renewal: string;
}

export interface TeamMemberData {
  id: number;
  name: string;
  email: string;
  role: string;
  init: string;
}

// ── Knowledge base ────────────────────────────────────────────────────────────
export type KBScope = "all" | "hidden" | number[];
export type KBInject = "always" | number; // number = N inbound messages

export interface KBEntryData {
  id: number;
  category: string;
  title: string;
  content: string;
  scope: KBScope;
  inject: KBInject;
}

export interface KBCampaign {
  id: number;
  name: string;
}
