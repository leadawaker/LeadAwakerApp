import { useMemo } from "react";
import { useLocation } from "wouter";

export interface PageContext {
  /** Current URL path */
  path: string;
  /** Human-readable page name (e.g. "Leads", "Campaign Detail") */
  pageName: string;
  /** Page type identifier (e.g. "leads", "lead_detail", "campaigns") */
  pageType: string;
  /** Dynamic route params (e.g. { id: "123" }) */
  params: Record<string, string>;
  /** Route prefix: "agency" or "subaccount" */
  prefix: string;
  /** Entity data visible on screen (from detail/record pages) */
  entityData?: {
    entityType: string;
    entityId?: number | string;
    entityName?: string;
    summary?: Record<string, unknown>;
    filters?: Record<string, unknown>;
  };
}

/**
 * Route definitions with human-readable names.
 * Order matters: more specific routes (with params) should come first.
 */
const ROUTE_MAP: Array<{
  pattern: RegExp;
  pageName: string;
  pageType: string;
  paramNames?: string[];
}> = [
  // Detail / param routes first
  { pattern: /^\/(?:agency|subaccount)\/contacts\/(\d+)$/, pageName: "Lead Detail", pageType: "lead_detail", paramNames: ["id"] },
  // List / static routes
  { pattern: /^\/(?:agency|subaccount)\/leads$/, pageName: "Leads", pageType: "leads" },
  { pattern: /^\/(?:agency|subaccount)\/contacts$/, pageName: "Leads", pageType: "leads" },
  { pattern: /^\/(?:agency|subaccount)\/campaigns$/, pageName: "Campaigns", pageType: "campaigns" },
  { pattern: /^\/(?:agency|subaccount)\/conversations$/, pageName: "Conversations", pageType: "conversations" },
  { pattern: /^\/(?:agency|subaccount)\/calendar$/, pageName: "Calendar", pageType: "calendar" },
  { pattern: /^\/(?:agency|subaccount)\/settings$/, pageName: "Settings", pageType: "settings" },
  { pattern: /^\/(?:agency|subaccount)\/accounts$/, pageName: "Accounts", pageType: "accounts" },
  { pattern: /^\/(?:agency|subaccount)\/tasks$/, pageName: "Tasks", pageType: "tasks" },
  { pattern: /^\/(?:agency|subaccount)\/automation-logs$/, pageName: "Automation Logs", pageType: "automation_logs" },
  { pattern: /^\/(?:agency|subaccount)\/prompt-library$/, pageName: "Prompt Library", pageType: "prompts" },
  { pattern: /^\/(?:agency|subaccount)\/invoices$/, pageName: "Invoices", pageType: "invoices" },
  { pattern: /^\/(?:agency|subaccount)\/expenses$/, pageName: "Expenses", pageType: "expenses" },
  { pattern: /^\/(?:agency|subaccount)\/contracts$/, pageName: "Contracts", pageType: "contracts" },
  { pattern: /^\/(?:agency|subaccount)\/billing$/, pageName: "Billing", pageType: "billing" },
  { pattern: /^\/(?:agency|subaccount)\/docs$/, pageName: "Documentation", pageType: "docs" },
  { pattern: /^\/(?:agency|subaccount)\/dashboard$/, pageName: "Dashboard", pageType: "dashboard" },
  { pattern: /^\/(?:agency|subaccount)\/prospects$/, pageName: "Prospects", pageType: "prospects" },
];

/**
 * Hook that detects the current page/route and returns structured page context.
 * Uses Wouter's useLocation() so it automatically updates on navigation.
 */
export function usePageContext(): PageContext {
  const [location] = useLocation();

  return useMemo(() => {
    // Extract prefix (agency or subaccount)
    const prefixMatch = location.match(/^\/(agency|subaccount)/);
    const prefix = prefixMatch ? prefixMatch[1] : "agency";

    // Try to match against known routes
    for (const route of ROUTE_MAP) {
      const match = location.match(route.pattern);
      if (match) {
        const params: Record<string, string> = {};
        if (route.paramNames) {
          route.paramNames.forEach((name, i) => {
            params[name] = match[i + 1];
          });
        }
        return {
          path: location,
          pageName: route.pageName,
          pageType: route.pageType,
          params,
          prefix,
        };
      }
    }

    // Fallback for unknown routes
    const segments = location.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] || "unknown";
    const fallbackName = lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1).replace(/-/g, " ");

    return {
      path: location,
      pageName: fallbackName,
      pageType: lastSegment.replace(/-/g, "_"),
      params: {},
      prefix,
    };
  }, [location]);
}
