import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { PREFS_CHANGED_EVENT, readServicePageToggles, useServicePageToggles, type ServicePageKey, type ServicePageToggles } from "@/hooks/useServicePageToggles";
import { useVoiceCapabilities } from "@/features/voiceCalls/api/voiceCallsApi";

/**
 * Shared visibility rules for page links, so the nav bar (RightSidebar), the
 * mobile More page and the command palette all agree on which pages a user sees.
 */
export interface NavGate {
  ownerOnly?: boolean;
  adminOnly?: boolean;
  agencyOnly?: boolean;
  agencyViewOnly?: boolean;
  /** Owner pref "Outreach pages" (Prospect inbox, Prospects, Cadence). */
  outreachOnly?: boolean;
  /** Shown only when /api/voice-calls/capabilities says this user has Live or Demo. */
  voiceCallsOnly?: boolean;
  /** Owner-only service page that stays hidden until its toggle is on. */
  serviceKey?: ServicePageKey;
}

export interface NavGateContext {
  isOwner: boolean;
  isAgencyUser: boolean;
  isAgencyView: boolean;
  showOutreachPages: boolean;
  hasVoiceCalls: boolean;
  servicePageToggles: ServicePageToggles;
}

const OUTREACH_PREF_KEY = "leadawaker_show_outreach_pages";

function readOutreachPref(): boolean {
  try {
    return localStorage.getItem(OUTREACH_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

/** Owner pref: outreach pages are hidden until switched on in Settings. */
export function useOutreachPagesPref(): boolean {
  const [show, setShow] = useState(readOutreachPref);
  useEffect(() => {
    const handler = () => setShow(readOutreachPref());
    window.addEventListener(PREFS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(PREFS_CHANGED_EVENT, handler);
  }, []);
  return show;
}

export function isNavItemVisible(item: NavGate, ctx: NavGateContext): boolean {
  if (item.ownerOnly && !ctx.isOwner) return false;
  if (item.voiceCallsOnly && !ctx.hasVoiceCalls) return false;
  if (item.outreachOnly && !ctx.showOutreachPages) return false;
  if (item.adminOnly && !ctx.isAgencyUser) return false;
  if (item.agencyOnly && !ctx.isAgencyUser) return false;
  if (item.agencyViewOnly && !ctx.isAgencyView) return false;
  if (item.serviceKey && !(ctx.isOwner && ctx.servicePageToggles[item.serviceKey])) return false;
  return true;
}

/** Everything isNavItemVisible needs, read from the same sources the nav bar uses. */
export function useNavGateContext(): NavGateContext {
  const { isOwner, isAgencyUser, isAgencyView } = useWorkspace();
  const showOutreachPages = useOutreachPagesPref();
  const servicePageToggles = useServicePageToggles();
  const { data: voiceCaps } = useVoiceCapabilities();
  const hasVoiceCalls = !!(voiceCaps?.live || voiceCaps?.demo);
  return useMemo(() => ({
    isOwner: !!isOwner,
    isAgencyUser: !!isAgencyUser,
    isAgencyView: !!isAgencyView,
    showOutreachPages,
    hasVoiceCalls,
    servicePageToggles,
  }), [isOwner, isAgencyUser, isAgencyView, showOutreachPages, hasVoiceCalls, servicePageToggles]);
}

/**
 * Synchronous context from the localStorage mirrors, for code that cannot wait
 * for hooks (the `/platform` landing redirect). It knows neither impersonation
 * nor voice capabilities, so the route guards stay the final check.
 */
export function readNavGateContext(): NavGateContext {
  let role = "Viewer";
  try {
    role = localStorage.getItem("leadawaker_user_role") || "Viewer";
  } catch {
    /* storage unavailable: lowest access */
  }
  const isAgencyUser = role === "Owner" || role === "Admin";
  return {
    isOwner: role === "Owner",
    isAgencyUser,
    isAgencyView: isAgencyUser,
    showOutreachPages: readOutreachPref(),
    hasVoiceCalls: false,
    servicePageToggles: readServicePageToggles(),
  };
}
