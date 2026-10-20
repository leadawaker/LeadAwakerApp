// /go/:code: the button in every client alert and recap (specs/client-recaps).
// Resolves the opaque code on the server (which checks the user may see that
// account), preselects the lead or call, then opens the CRM page. With
// ?to=settings (the email footer's link) it opens the account's Recaps &
// alerts tab instead, ?to=calls the Calls page and ?call=<id> that one call. Logged-out visitors go to the login page and come back
// here afterwards.
import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { goLinkQuery, parseGoLinkParams } from "@shared/goLinkParams";

const RETURN_KEY = "leadawaker_return_to";
// The account switcher's two keys (hooks/useWorkspace.ts).
const ACCOUNT_KEY = "leadawaker_current_account_id";
const ACCOUNT_PICKED_KEY = "leadawaker_account_explicitly_selected";

/** The only queries the server knows (shared/goLinkParams); anything else is dropped. */
function linkTarget(): string {
  try { return goLinkQuery(parseGoLinkParams(window.location.search)); } catch { return ""; }
}

function toLogin(code: string, expired = false) {
  try {
    sessionStorage.setItem(RETURN_KEY, `/go/${code}${linkTarget()}`);
    // The session is gone: drop the stale flag so the login page does not bounce straight back.
    if (expired) localStorage.removeItem("leadawaker_auth");
  } catch { /* private mode: plain login */ }
  window.location.href = "/login";
}

export default function GoLink() {
  const { t } = useTranslation("clientAlerts");
  const [, params] = useRoute("/go/:code");
  const code = params?.code ?? "";
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!/^[A-Za-z0-9]{8}$/.test(code)) { setFailed(true); return; }
    if (!localStorage.getItem("leadawaker_auth")) { toLogin(code); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/go/${code}${linkTarget()}`);
        if (res.status === 401) { toLogin(code, true); return; }
        if (!res.ok) { if (!cancelled) setFailed(true); return; }
        const target = await res.json() as { path: string; selectLeadId?: number; selectVoiceCallId?: string; selectAccountId?: number; accountId?: number };
        // An agency user looking at one picked account would open the page on
        // that account and never find the lead: move the picker to the link's
        // account. "All accounts" (nothing picked) already shows it.
        if (target.accountId && localStorage.getItem(ACCOUNT_PICKED_KEY)) {
          localStorage.setItem(ACCOUNT_KEY, String(target.accountId));
        }
        if (target.selectLeadId) localStorage.setItem("selected-lead-id", String(target.selectLeadId));
        if (target.selectVoiceCallId) localStorage.setItem("selected-voice-call-id", target.selectVoiceCallId);
        if (target.selectAccountId) localStorage.setItem("selected-account-id", String(target.selectAccountId));
        window.location.replace(target.path.startsWith("/platform") ? target.path : "/platform");
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <div className="neu-raised" style={{ borderRadius: "var(--r-card)", padding: 28, maxWidth: 420, width: "100%", textAlign: "center" }}>
        {failed ? (
          <>
            <p style={{ fontSize: 15, color: "var(--ink)", fontWeight: 600, margin: "0 0 8px" }}>{t("go.notFound")}</p>
            <p style={{ fontSize: 13, color: "var(--mute)", margin: "0 0 18px" }}>{t("go.notFoundHelp")}</p>
            <a href="/platform" className="la-btn la-btn--wine">{t("go.open")}</a>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--mute)", fontSize: 13.5 }}>
            <Loader2 className="h-4 w-4 animate-spin" /> {t("go.loading")}
          </div>
        )}
      </div>
    </div>
  );
}
