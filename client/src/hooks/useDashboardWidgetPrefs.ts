import { useState, useCallback } from "react";

export type AgencyWidgetId = "kpi-strip" | "campaign-performance";

export type SubaccountWidgetId =
  | "kpi-strip"
  | "campaign-performance"
  | "performance-chart"
  | "sales-funnel"
  | "hot-leads"
  | "score-distribution"
  | "sales-pipeline";

const AGENCY_DEFAULTS: Record<AgencyWidgetId, boolean> = {
  "kpi-strip": true,
  "campaign-performance": true,
};

const SUBACCOUNT_DEFAULTS: Record<SubaccountWidgetId, boolean> = {
  "kpi-strip": true,
  "campaign-performance": true,
  "performance-chart": true,
  "sales-funnel": true,
  "hot-leads": true,
  "score-distribution": true,
  "sales-pipeline": true,
};

const AGENCY_LABELS: Record<AgencyWidgetId, string> = {
  "kpi-strip": "KPI Overview",
  "campaign-performance": "Campaign Performance",
};

const SUBACCOUNT_LABELS: Record<SubaccountWidgetId, string> = {
  "kpi-strip": "KPI Overview",
  "campaign-performance": "Campaign Performance",
  "performance-chart": "Performance Over Time",
  "sales-funnel": "Sales Funnel",
  "hot-leads": "Hot Leads",
  "score-distribution": "Lead Score Distribution",
  "sales-pipeline": "Sales Pipeline",
};

function loadPrefs<T extends Record<string, boolean>>(key: string, defaults: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return { ...defaults };
}

function savePrefs(key: string, prefs: Record<string, boolean>) {
  try {
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch {}
}

export function useDashboardWidgetPrefs(view: "agency" | "subaccount") {
  const storageKey = `dashboard-widget-prefs-${view}`;
  const defaults = view === "agency" ? AGENCY_DEFAULTS : SUBACCOUNT_DEFAULTS;
  const labels = view === "agency" ? AGENCY_LABELS : SUBACCOUNT_LABELS;

  const [prefs, setPrefsState] = useState<Record<string, boolean>>(() =>
    loadPrefs(storageKey, defaults as Record<string, boolean>)
  );

  const toggleWidget = useCallback(
    (id: string) => {
      const next = { ...prefs, [id]: !prefs[id] };
      setPrefsState(next);
      savePrefs(storageKey, next);
    },
    [prefs, storageKey]
  );

  const isVisible = useCallback(
    (id: string) => prefs[id] !== false,
    [prefs]
  );

  const widgetList = Object.keys(defaults).map((id) => ({
    id,
    label: (labels as Record<string, string>)[id] || id,
    visible: prefs[id] !== false,
  }));

  return { prefs, toggleWidget, isVisible, widgetList };
}
