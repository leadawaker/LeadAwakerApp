// Fixture builders for the Demos page's pure-module tests. Not imported by the app.
import type { DemoSession, DemoSessionSurface } from "./api/demoSessionsApi";
import type { ProspectRow } from "./prospectRows";

export const surface: DemoSessionSurface = { opened: false, openedAt: null, replies: 0, lastAt: null, status: "" };

export function session(over: Partial<DemoSession> = {}): DemoSession {
  return {
    token: "tok00001",
    demoUrl: "https://leadawaker.com/demo/tok00001",
    whatsappUrl: "https://wa.me/31600000000?text=tok00001",
    firstName: "Sam",
    language: "en",
    companyName: "",
    clientNiche: "",
    scenario: "inquired",
    service: "",
    prospectGroup: "",
    aiDisclosure: "",
    market: "",
    invited: true,
    campaignId: 60,
    createdAt: "2026-10-20T09:00:00Z",
    revokedAt: null,
    expired: false,
    screenshot: "",
    websiteUrl: "",
    browser: { ...surface },
    whatsapp: { ...surface },
    ...over,
  };
}

export function row(over: Partial<ProspectRow> = {}): ProspectRow {
  return {
    key: "g1",
    firstName: "",
    companyName: "",
    clientNiche: "",
    language: "en",
    aiDisclosure: "",
    market: "",
    notes: "",
    hasRecord: true,
    screenshot: "",
    websiteUrl: "",
    publicDemo: false,
    createdAt: null,
    lastActivityAt: null,
    lastReplyAt: null,
    lastOpenAt: null,
    tokens: [],
    byService: {},
    extra: [],
    history: [],
    replies: 0,
    opened: false,
    hasLinks: false,
    expired: false,
    ...over,
  };
}
