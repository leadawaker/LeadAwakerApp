// What gets ordered for the client, and the order once it is out. Set before
// the client submits: an area code (matching their address), optionally one
// number from the stock list, and whether to order the moment they submit.
// After that: the order's state at Telnyx, and "Attach" once it is approved.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Phone, Search, ShoppingCart } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { Switch } from "@/components/ui/switch";
import { FieldLabel, helpStyle } from "./voiceAtoms";
import type { NumberRequest } from "./NumberDocsCard";

interface Available { phoneNumber: string; locality: string | null; upfront: string | null; monthly: string | null }

const field: React.CSSProperties = {
  fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--line-strong)",
  background: "var(--paper)", color: "var(--ink)", width: 90, fontFamily: "var(--mono)",
};

export function NumberOrderPlan({ accountId, request, onChange, onAttach }: {
  accountId: number;
  request: NumberRequest;
  onChange: (r: NumberRequest) => void;
  onAttach?: (phoneNumber: string) => Promise<boolean>;
}) {
  const { t } = useTranslation("voiceTab");
  const base = `/api/accounts/${accountId}/number-request`;
  const [areaCode, setAreaCode] = useState(request.areaCode ? `0${request.areaCode}` : "073");
  const [found, setFound] = useState<Available[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const order = request.numberOrder;

  const call = async (key: string, url: string, init?: RequestInit) => {
    setBusy(key); setError(null);
    try {
      const res = await apiFetch(url, init);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body?.message || t("common.saveFailed")); return null; }
      return body;
    } finally { setBusy(null); }
  };
  const savePlan = async (plan: Record<string, unknown>) => {
    const body = await call("plan", `${base}/plan`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan),
    });
    if (body?.request) onChange(body.request);
  };
  const find = async () => {
    const body = await call("find", `${base}/available?areaCode=${encodeURIComponent(areaCode)}`);
    if (body?.numbers) { setFound(body.numbers); void savePlan({ areaCode }); }
  };
  const orderNow = async () => {
    const body = await call("order", `${base}/order`, { method: "POST" });
    if (body?.request) onChange(body.request);
  };
  const attach = async () => {
    if (!onAttach || !order?.phoneNumber) return;
    setBusy("attach"); setError(null);
    if (!(await onAttach(order.phoneNumber))) setError(t("common.saveFailed"));
    setBusy(null);
  };

  // ── The order is out ─────────────────────────────────────────────────────
  if (order && order.status !== "failure") {
    return (
      <div className="neu-inset-crisp" style={{ borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <FieldLabel>{t("numberDocs.order.title")}</FieldLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Phone size={14} style={{ color: "var(--mute)" }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--ink)" }}>{order.phoneNumber}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: order.status === "success" ? "var(--good)" : "var(--warn)" }}>
            {t(`numberDocs.order.status.${order.status}`)}
          </span>
        </div>
        <p style={{ ...helpStyle, margin: 0 }}>{t(`numberDocs.order.help.${order.status}`)}</p>
        {order.status === "success" && onAttach && (
          <div>
            <button type="button" className="la-btn la-btn--wine" onClick={() => void attach()} disabled={!!busy}>
              {busy === "attach" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {t("numberDocs.order.attach")}
            </button>
          </div>
        )}
        {error && <span role="alert" style={{ fontSize: 12.5, color: "var(--stage-lost)" }}>{error}</span>}
      </div>
    );
  }

  // ── Planning, or ordering by hand after a failure ───────────────────────
  return (
    <div className="neu-inset-crisp" style={{ borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <FieldLabel>{t("numberDocs.plan.title")}</FieldLabel>
      {order?.status === "failure" && (
        <span role="alert" style={{ fontSize: 12.5, color: "var(--stage-lost)" }}>{t("numberDocs.order.failed", { error: order.error })}</span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{t("numberDocs.plan.areaCode")}</span>
        <input style={field} value={areaCode} onChange={(e) => setAreaCode(e.target.value.replace(/[^\d]/g, "").slice(0, 4))} inputMode="numeric" />
        <button type="button" className="la-btn la-btn--soft" onClick={() => void find()} disabled={!!busy || areaCode.length < 3}>
          {busy === "find" ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
          {t("numberDocs.plan.find")}
        </button>
      </div>
      <p style={{ ...helpStyle, margin: 0 }}>{t("numberDocs.plan.areaHelp")}</p>

      {found && (found.length === 0 ? (
        <p style={{ ...helpStyle, margin: 0 }}>{t("numberDocs.plan.none")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[{ phoneNumber: "", locality: null, upfront: null, monthly: null } as Available, ...found].map((n) => {
            const picked = (request.preferredNumber ?? "") === n.phoneNumber;
            return (
              <label key={n.phoneNumber || "any"} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--ink-soft)", cursor: "pointer" }}>
                <input type="radio" checked={picked} onChange={() => void savePlan({ preferredNumber: n.phoneNumber || null })} />
                {n.phoneNumber ? (
                  <>
                    <span style={{ fontFamily: "var(--mono)" }}>{n.phoneNumber}</span>
                    <span style={{ color: "var(--mute)", fontSize: 12 }}>
                      {[n.locality, n.upfront && n.monthly ? t("numberDocs.plan.price", { upfront: Number(n.upfront), monthly: Number(n.monthly) }) : null].filter(Boolean).join(" · ")}
                    </span>
                  </>
                ) : (
                  <span>{t("numberDocs.plan.anyNumber")}</span>
                )}
              </label>
            );
          })}
        </div>
      ))}
      {!found && request.preferredNumber && (
        <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
          {t("numberDocs.plan.picked")} <span style={{ fontFamily: "var(--mono)" }}>{request.preferredNumber}</span>
        </span>
      )}

      {request.status === "open" ? (
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--ink-soft)" }}>
          <Switch checked={request.autoOrder} disabled={!!busy || !request.areaCode} onCheckedChange={(v) => void savePlan({ autoOrder: v })} />
          {t("numberDocs.plan.auto")}
        </label>
      ) : (
        <div>
          <button type="button" className="la-btn la-btn--wine" onClick={() => void orderNow()} disabled={!!busy || !request.areaCode}>
            {busy === "order" ? <Loader2 size={13} className="animate-spin" /> : <ShoppingCart size={13} />}
            {t("numberDocs.plan.orderNow")}
          </button>
        </div>
      )}
      <p style={{ ...helpStyle, margin: 0 }}>{t("numberDocs.plan.autoHelp")}</p>
      {error && <span role="alert" style={{ fontSize: 12.5, color: "var(--stage-lost)" }}>{error}</span>}
    </div>
  );
}
