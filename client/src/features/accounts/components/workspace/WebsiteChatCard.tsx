// Website chat widget setup (Accounts → Integrations). Spec: specs/website-widget.
//
// Deliberately a CARD beside the messaging cards rather than a page of its own:
// a widget is a channel on an account, exactly like the WhatsApp number above
// it. What the assistant SAYS lives on the campaign; only the installation and
// the surface belong here.
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Copy, Check, Loader2, ChevronDown, Trash2, MessageSquarePlus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ConnectedPill } from "./atoms";
import {
  fetchWidgetConfigs, createWidgetConfig, updateWidgetConfig, deleteWidgetConfig,
  widgetSnippet, type WidgetConfigRow,
} from "../../api/widgetApi";

const MONO = {
  fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em",
  textTransform: "uppercase", color: "var(--mute-2)",
} as const;

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ width: 36, height: 36, borderRadius: "var(--r-button)", flexShrink: 0, background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)" }}>
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={MONO}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", borderRadius: "var(--r-button)", border: "1px solid var(--line)",
  background: "var(--card)", padding: "8px 10px", fontSize: 13, color: "var(--ink)",
};

export function WebsiteChatCard({ accountId }: { accountId: number }) {
  const { t } = useTranslation("accounts");
  const [cfg, setCfg] = useState<WidgetConfigRow | null>(null);
  const [campaigns, setCampaigns] = useState<Array<{ id: number; name: string | null }>>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [domainText, setDomainText] = useState("");

  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      const res = await fetchWidgetConfigs(accountId);
      const first = res.configs[0] || null;
      setCfg(first);
      setCampaigns(res.campaigns);
      setDomainText((first?.allowedDomains || []).join(", "));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoaded(true);
    }
  }, [accountId]);

  useEffect(() => { void load(); }, [load]);

  const patch = async (body: Partial<WidgetConfigRow>) => {
    if (!cfg) return;
    setBusy(true); setError(null);
    try {
      setCfg(await updateWidgetConfig(cfg.id, body));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true); setError(null);
    try {
      const row = await createWidgetConfig({
        accountsId: accountId,
        // Empty allowlist on purpose: the widget refuses to run anywhere until
        // the domains are filled in, so a key can never be live by accident.
        allowedDomains: [],
        greeting: t("websiteChat.defaultGreeting"),
      });
      setCfg(row);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!cfg) return;
    setBusy(true);
    try {
      await deleteWidgetConfig(cfg.id);
      setCfg(null);
      setDomainText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const apiOrigin = typeof window === "undefined" ? "" : window.location.origin;
  const snippet = cfg ? widgetSnippet(cfg.publicKey, apiOrigin) : "";
  const copy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const domains = cfg?.allowedDomains || [];
  const live = !!cfg?.enabled && domains.length > 0 && !!cfg?.campaignsId;

  return (
    <div className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--bone)", padding: "18px 22px" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", border: 0, cursor: "pointer", padding: 0 }}
      >
        <IconTile><Globe size={16} /></IconTile>
        <span style={{ flex: 1, textAlign: "left" }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
            {t("websiteChat.title")}
          </span>
          <span style={{ display: "block", fontSize: 12, color: "var(--mute)" }}>
            {t("websiteChat.subtitle")}
          </span>
        </span>
        {live && <ConnectedPill />}
        <ChevronDown size={15} style={{ color: "var(--mute-2)", transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
      </button>

      {open && (
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          {!loaded && <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute-2)" }} />}

          {loaded && !cfg && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, color: "var(--mute)" }}>{t("websiteChat.none")}</span>
              <button className="la-btn" onClick={create} disabled={busy}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : t("websiteChat.create")}
              </button>
            </div>
          )}

          {loaded && cfg && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Switch checked={!!cfg.enabled} onCheckedChange={(v) => patch({ enabled: v })} disabled={busy} />
                <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("websiteChat.enabled")}</span>
                {busy && <Loader2 size={13} className="animate-spin" style={{ color: "var(--mute-2)" }} />}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label={t("websiteChat.campaign")}>
                  <select
                    style={inputStyle}
                    value={cfg.campaignsId ?? ""}
                    onChange={(e) => patch({ campaignsId: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">{t("websiteChat.campaignNone")}</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name || `#${c.id}`}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t("websiteChat.agentName")}>
                  <input
                    style={inputStyle}
                    defaultValue={cfg.agentName || ""}
                    onBlur={(e) => e.target.value !== (cfg.agentName || "") && patch({ agentName: e.target.value })}
                  />
                </Field>
              </div>

              <Field label={t("websiteChat.domains")}>
                <input
                  style={inputStyle}
                  placeholder="example.com, www.example.com"
                  value={domainText}
                  onChange={(e) => setDomainText(e.target.value)}
                  onBlur={() => patch({ allowedDomains: domainText.split(",").map((d) => d.trim()).filter(Boolean) })}
                />
                <span style={{ fontSize: 11, color: "var(--mute-2)" }}>{t("websiteChat.domainsHint")}</span>
              </Field>

              <Field label={t("websiteChat.greeting")}>
                <input
                  style={inputStyle}
                  defaultValue={cfg.greeting || ""}
                  onBlur={(e) => e.target.value !== (cfg.greeting || "") && patch({ greeting: e.target.value })}
                />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label={t("websiteChat.position")}>
                  <select style={inputStyle} value={cfg.launcherPosition || "right"} onChange={(e) => patch({ launcherPosition: e.target.value })}>
                    <option value="right">{t("websiteChat.positionRight")}</option>
                    <option value="left">{t("websiteChat.positionLeft")}</option>
                  </select>
                </Field>
                <Field label={t("websiteChat.language")}>
                  <select style={inputStyle} value={cfg.language || "en"} onChange={(e) => patch({ language: e.target.value })}>
                    <option value="en">EN</option>
                    <option value="nl">NL</option>
                    <option value="pt">PT</option>
                  </select>
                </Field>
              </div>

              <div>
                <span style={MONO}>{t("websiteChat.snippet")}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <code style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-soft)", background: "var(--card)", borderRadius: "var(--r-button)", padding: "8px 10px" }}>
                    {snippet}
                  </code>
                  <button className="la-btn la-btn--icon" onClick={copy} style={{ background: "transparent", boxShadow: "none", color: "var(--mute-2)" }}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
                <span style={{ fontSize: 11, color: "var(--mute-2)" }}>{t("websiteChat.snippetHint")}</span>
              </div>

              {/* Preview: the real widget, on the real key, in an iframe. It is
                  the same document a visitor gets, so a broken config shows up
                  here rather than on the client's homepage. */}
              <div>
                <span style={MONO}>{t("websiteChat.preview")}</span>
                <iframe
                  title={t("websiteChat.preview")}
                  src={`/widget/frame?key=${encodeURIComponent(cfg.publicKey)}#v=preview0000preview00`}
                  allow="microphone"
                  style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 390, height: 520, border: "1px solid var(--line)", borderRadius: 20, background: "var(--card)" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 11, color: "var(--mute-2)" }}>
                  {t("websiteChat.usage", { used: cfg.messagesToday ?? 0, cap: cfg.maxMessagesPerDay ?? 0 })}
                </span>
                <button className="la-btn la-btn--icon" onClick={remove} disabled={busy} title={t("websiteChat.delete")} style={{ background: "transparent", boxShadow: "none", color: "var(--mute-2)" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </>
          )}

          {error && <span style={{ fontSize: 12, color: "var(--danger, #B3261E)" }}>{error}</span>}
        </div>
      )}
    </div>
  );
}


/**
 * Which campaign answers a WhatsApp message from someone who is not a lead yet.
 *
 * Lives beside the widget because it is the same product decision on a
 * different channel: "a stranger contacts this client, who replies?". Until it
 * is set, a first-time sender is still dropped — deliberately, because guessing
 * the account would have the wrong client's assistant answering a stranger
 * (specs/website-widget phase 6).
 */
export function InboundWhatsAppCard({
  accountId,
  account,
  onSave,
}: {
  accountId: number;
  account: Record<string, unknown>;
  onSave: (field: string, value: string) => Promise<void>;
}) {
  const { t } = useTranslation("accounts");
  const [campaigns, setCampaigns] = useState<Array<{ id: number; name: string | null }>>([]);
  const [value, setValue] = useState<number | "">(
    typeof account.inbound_campaign_id === "number" ? (account.inbound_campaign_id as number) : ""
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    fetchWidgetConfigs(accountId).then((r) => setCampaigns(r.campaigns)).catch(() => {});
  }, [accountId]);

  const change = async (next: string) => {
    const id = next ? Number(next) : null;
    setValue(id ?? "");
    setBusy(true);
    try {
      // The generic account PATCH takes db-style keys and a real number: the
      // integer column's zod schema rejects the string an <input> would send.
      await onSave("inbound_campaign_id", id as unknown as string);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--bone)", padding: "18px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <IconTile><MessageSquarePlus size={16} /></IconTile>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
            {t("inboundWhatsApp.title")}
          </span>
          <span style={{ display: "block", fontSize: 12, color: "var(--mute)" }}>
            {t("inboundWhatsApp.subtitle")}
          </span>
        </span>
        <select
          style={{ ...inputStyle, width: 220 }}
          value={value}
          onChange={(e) => void change(e.target.value)}
          disabled={busy}
        >
          <option value="">{t("inboundWhatsApp.off")}</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name || `#${c.id}`}</option>
          ))}
        </select>
        {busy && <Loader2 size={13} className="animate-spin" style={{ color: "var(--mute-2)" }} />}
      </div>
    </div>
  );
}
