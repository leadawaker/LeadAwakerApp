import { createContext, useContext, useEffect, useState } from "react";
import { API_BASE, apiFetch } from "@/lib/apiUtils";

/**
 * The Client's logo for this demo (GET /api/demo/:token/logo), or null for the
 * initials. Read live, so the Demos-table switch reaches links already sent.
 */
export function useDemoLogo(token: string): string | null {
  const [logo, setLogo] = useState<string | null>(null);
  useEffect(() => {
    if (!token) return;
    let alive = true;
    apiFetch(`/api/demo/${encodeURIComponent(token)}/logo`)
      .then((r) => (r.ok ? r.json() : { logoUrl: null }))
      .then((b: { logoUrl?: string | null }) => {
        if (alive) setLogo(b.logoUrl ? `${b.logoUrl.startsWith("/api/") ? API_BASE : ""}${b.logoUrl}` : null);
      })
      .catch(() => { /* initials */ });
    return () => { alive = false; };
  }, [token]);
  return logo;
}

/** Carries the logo to the phone headers without threading a prop through them. */
export const DemoLogoContext = createContext<string | null>(null);
export const useDemoLogoUrl = () => useContext(DemoLogoContext);
