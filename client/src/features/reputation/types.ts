export type ReviewStatus = "needs" | "drafted" | "replied" | "ignored";
export type ReviewLang = "nl" | "en" | string;
export type ToneKey = "apologetic" | "grateful" | "professional" | "concise";
export type FeedbackStatus = "open" | "assigned" | "resolved";

export interface ReviewAnalysis {
  issues: string[];
  reco: string;
}

export interface TimelineStep {
  key: string;
  label: string;
  who: string | null;
  ago: string | null;
  done: boolean;
}

export interface PostedReply {
  text: string;
  by: string;
  ago: string;
}

export interface Review {
  id: string;
  name: string;
  ini: string;
  rating: 1 | 2 | 3 | 4 | 5;
  platform: "google" | string;
  lang: ReviewLang;
  ago: string;
  date: string;
  status: ReviewStatus;
  job: string;
  text: string;
  draft: string | null;
  tone: ToneKey | null;
  reply: PostedReply | null;
  timeline: TimelineStep[];
  confidence: number;
  analysis: ReviewAnalysis | null;
  draftReady: boolean;
}

export interface WAMessage {
  from: "biz" | "cust";
  ago: string;
  text: string;
}

export interface FeedbackNote {
  by: string;
  ago: string;
  text: string;
}

export interface FeedbackItem {
  id: string;
  name: string;
  ini: string;
  job: string;
  ago: string;
  sentiment: "negative";
  lang: ReviewLang;
  text: string;
  status: FeedbackStatus;
  assignee: string | null;
  wa: WAMessage[];
  notes: FeedbackNote[];
}

export interface OverviewMetric {
  value: string;
  delta: string;
  note: string;
  suffix?: string;
  spark?: number[];
}

export interface RatingSeries {
  rating: number[];
  volume: number[];
  axis: string[];
  negatives: number[];
  now: number;
  annotation: string;
}

export interface Overview {
  health: {
    score: number;
    of: number;
    label: string;
    delta: string;
    note: string;
    drivers: { label: string; score: number }[];
  };
  metrics: {
    avgRating: OverviewMetric;
    medianReply: OverviewMetric;
    replyRate: OverviewMetric;
    thisMonth: OverviewMetric;
  };
  ratingSeries: { week: RatingSeries; month: RatingSeries; quarter: RatingSeries };
  sentiment: { positive: number; neutral: number; negative: number };
  distribution: { stars: number; count: number }[];
  responseSLA: { band: string; pct: number; color: string }[];
}

export interface FunnelStep {
  key: string;
  label: string;
  value: number;
  pos?: number;
  neg?: number;
  combo?: boolean;
  note?: string;
}

export interface FeedbackData {
  funnel: FunnelStep[];
  referralAskRate: { pct: number; asked: number; of: number; note: string };
  intercepted: FeedbackItem[];
  routed: { id: string; name: string; ini: string; job: string; ago: string; sentiment: "positive"; clicked: boolean }[];
}

export interface AutoRule {
  threshold: "never" | 3 | 4 | 5;
  delay: "15m" | "1h" | "2h";
  confidenceHold: boolean;
  confidenceMin: number;
  holdNegative: boolean;
}

export interface RepSettingsData {
  auto: AutoRule;
  reply: {
    toneBySentiment: { negative: ToneKey; neutral: ToneKey; positive: ToneKey };
    language: "auto" | "nl" | "en";
    length: "short" | "standard" | "detailed";
    signOff: string;
    includeName: boolean;
    guardrails: {
      noLegalFault: boolean;
      noPublicComp: boolean;
      noSpecificsEscalate: boolean;
    };
  };
  request: {
    enabled: boolean;
    channel: "whatsapp" | "sms";
    triggerDays: number;
    followUp: boolean;
    followUpDays: number;
    frequencyCapDays: number;
    template: string;
  };
  escalation: {
    onOneStar: boolean;
    onLowConfidence: boolean;
    keywords: string[];
    notifyChannel: "email" | "whatsapp" | "slack";
    assignee: string;
    dailyDigest: boolean;
  };
  referral: {
    enabled: boolean;
    askMin: 4 | 5;
    framing: "neutral" | "reward" | "charity";
    reward: string;
    delayDays: number;
    channel: "whatsapp" | "sms";
    template: string;
  };
}

export interface RepSummary {
  avg: number;
  count: number;
  needsReply: number;
  negNeeds: number;
  neuNeeds: number;
  posNeeds: number;
  draftReady: number;
  replied: number;
  intercepted: number;
  oldestDays: number;
  aiCoverage: number;
}

export interface RepData {
  reviews: Review[];
  overview: Overview;
  feedback: FeedbackData;
  tones: { key: ToneKey; label: string }[];
  channels: { key: string; label: string; state: string }[];
  platform: { name: string; state: string; lastSync: string; future: string[] };
  settings: RepSettingsData;
  auditLog: { id: string; name: string; rating: number; ago: string; by: string }[];
  latestWaiting: { id: string; name: string; rating: number; ago: string; text: string }[];
  summary: RepSummary;
}

export type SelectionKind = "review" | "feedback";
export interface InboxSelection {
  kind: SelectionKind;
  id: string;
}
