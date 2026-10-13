// /number-docs/:token: the private page on which a client hands in what the
// phone carrier needs to register a number in their company's name. No login:
// the link is the key. Files are passed straight on to the carrier
// (server/routes/numberRequests.ts); this page never shows them again.
import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { useTranslation } from "react-i18next";
import { Building2, Check, Clock, FileText, FileUp, Home, IdCard, Loader2, Lock, ShieldCheck } from "lucide-react";
import { API_BASE } from "@/lib/apiUtils";

const DETAILS = ["legalName", "kvkNumber", "representative", "contactPhone", "street", "postalCode", "city"] as const;
const KINDS = ["kvk", "id", "address"] as const;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "application/pdf,image/jpeg,image/png";

type Detail = (typeof DETAILS)[number];
type Kind = (typeof KINDS)[number];
interface View {
  companyName: string;
  status: "open" | "submitted";
  details: Partial<Record<Detail, string>>;
  documents: { kind: Kind; filename: string }[];
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function NumberDocs() {
  const { i18n } = useTranslation();
  const [, params] = useRoute("/number-docs/:token");
  const token = params?.token ?? "";
  // The link carries the client's language; the visitor's own setting is left alone.
  const t = useMemo(() => {
    const lang = new URLSearchParams(window.location.search).get("lang");
    return i18n.getFixedT(lang && ["en", "nl", "pt"].includes(lang) ? lang : i18n.language, "voiceTab", "numberDocs.page");
  }, [i18n]);

  // Plain fetch, not apiFetch: there is no session here and a 401 must not send the client to the login page.
  const api = `${API_BASE}/api/number-request/${token}`;
  const [view, setView] = useState<View | null>(null);
  const [form, setForm] = useState<Partial<Record<Detail, string>>>({});
  const [invalid, setInvalid] = useState(false);
  const [busyKind, setBusyKind] = useState<Kind | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(api).then(async (res) => {
      if (!res.ok) return setInvalid(true);
      const data = (await res.json()) as View;
      setView(data); setForm(data.details);
    }).catch(() => setInvalid(true));
  }, [api]);

  const saveDetails = async (): Promise<boolean> => {
    const res = await fetch(`${api}/details`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    }).catch(() => null);
    return !!res?.ok;
  };

  const upload = async (kind: Kind, file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) return setError(t("errors.tooLarge"));
    if (!ACCEPT.split(",").includes(file.type)) return setError(t("errors.fileType"));
    setBusyKind(kind);
    try {
      const res = await fetch(`${api}/documents/${kind}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, data: await toBase64(file) }),
      });
      if (!res.ok) setError(t("errors.upload"));
      else setView((await res.json()) as View);
    } catch { setError(t("errors.upload")); }
    finally { setBusyKind(null); }
  };

  const send = async () => {
    setError(null);
    if (DETAILS.some((k) => !form[k]?.trim())) return setError(t("errors.detailsMissing"));
    if (KINDS.some((k) => !view?.documents.some((d) => d.kind === k))) return setError(t("errors.documentsMissing"));
    setSending(true);
    try {
      if (!(await saveDetails())) return setError(t("errors.save"));
      const res = await fetch(`${api}/submit`, { method: "POST" });
      if (!res.ok) setError(t("errors.save"));
      else setView((await res.json()) as View);
    } catch { setError(t("errors.save")); }
    finally { setSending(false); }
  };

  const detailsDone = DETAILS.every((k) => form[k]?.trim());
  const docsDone = !!view && KINDS.every((k) => view.documents.some((d) => d.kind === k));

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: "var(--bone)", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{".dark .nd-telnyx { filter: invert(1); }"}</style>
      <div style={{ width: "100%", maxWidth: 720, padding: "18px 18px 0" }}>
        {/* The brand logo has white letters: it needs the homepage's sand bar behind it. */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 18px", borderRadius: 16, background: "hsl(var(--border) / 0.42)", border: "1px solid var(--line)" }}>
          <img src="/premium/logo-v2.svg" alt="Lead Awaker" style={{ height: 30 }} />
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-soft)" }}>
            <Lock size={11} /> {t("secure")}
          </span>
        </header>
      </div>
      <main style={{ width: "100%", maxWidth: 720, padding: "26px 18px 40px", display: "flex", flexDirection: "column", gap: 22, flex: 1 }}>{children}</main>
      <footer style={{ padding: "0 18px 26px", fontSize: 11.5, color: "var(--mute-2)", textAlign: "center" }}>{t("footer")}</footer>
    </div>
  );
  const card: React.CSSProperties = { borderRadius: "var(--r-card)", background: "var(--bone)", padding: "24px 26px" };
  const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)" };
  const help: React.CSSProperties = { fontSize: 12.5, color: "var(--mute)", lineHeight: 1.55, margin: 0 };

  if (invalid) return shell(<p style={{ ...help, fontSize: 14 }}>{t("invalid")}</p>);
  if (!view) return shell(<Loader2 size={18} className="animate-spin" style={{ color: "var(--mute)" }} />);

  if (view.status === "submitted") {
    return shell(
      <div className="neu-raised" style={{ ...card, padding: "40px 30px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <span style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--good-tint)", color: "var(--good)", display: "grid", placeItems: "center" }}>
          <Check size={26} />
        </span>
        <h1 style={{ margin: 0, fontSize: 22, color: "var(--ink)" }}>{t("done.title")}</h1>
        <p style={{ ...help, fontSize: 14, maxWidth: 420 }}>{t("done.body")}</p>
      </div>,
    );
  }

  const steps = [
    { key: "details", done: detailsDone },
    { key: "documents", done: docsDone },
    { key: "send", done: false },
  ];
  const sectionHead = (icon: React.ReactNode, title: string, done: boolean) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <IconTile>{icon}</IconTile>
      <h2 style={{ margin: 0, fontSize: 16, color: "var(--ink)", flex: 1 }}>{title}</h2>
      {done && <DoneDot />}
    </div>
  );

  return shell(
    <>
      <section className="neu-raised" style={{ ...card, padding: 0, overflow: "hidden", display: "flex", flexWrap: "wrap", alignItems: "stretch" }}>
        <div style={{ flex: "1 1 320px", padding: "28px 26px", minWidth: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--wine)", background: "var(--wine-tint)", padding: "4px 10px", borderRadius: 999, marginBottom: 14 }}>
            <Clock size={11} /> {t("minutes")}
          </span>
          <h1 style={{ margin: "0 0 10px", fontSize: 26, lineHeight: 1.2, color: "var(--ink)" }}>{t("title", { company: view.companyName })}</h1>
          <p style={{ ...help, fontSize: 14 }}>{t("intro")}</p>
        </div>
        <div style={{ flex: "0 1 240px", minWidth: 200, background: "var(--wine-tint)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "18px 18px 20px" }}>
          <HeroArt />
          <a href="https://telnyx.com" target="_blank" rel="noopener" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textDecoration: "none" }}>
            <span className="eyebrow eyebrow-sm" style={{ color: "var(--mute)" }}>{t("carrierLabel")}</span>
            <img className="nd-telnyx" src="/premium/telnyx-logo.svg" alt="Telnyx" style={{ height: 24 }} />
            <span style={{ fontSize: 11.5, color: "var(--mute)" }}>telnyx.com</span>
          </a>
        </div>
      </section>

      <ol style={{ listStyle: "none", margin: 0, padding: "0 4px", display: "flex", alignItems: "center", gap: 10 }}>
        {steps.map((s, i) => (
          <li key={s.key} style={{ display: "flex", alignItems: "center", gap: 8, flex: i < steps.length - 1 ? 1 : "0 0 auto", minWidth: 0 }}>
            <span style={{
              width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0, fontSize: 11.5, fontWeight: 700,
              background: s.done ? "var(--good)" : "var(--wine-tint)", color: s.done ? "#fff" : "var(--wine)",
            }}>
              {s.done ? <Check size={13} /> : i + 1}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: s.done ? "var(--ink-soft)" : "var(--mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t(`steps.${s.key}`)}</span>
            {i < steps.length - 1 && <span style={{ flex: 1, height: 1, background: "var(--line-strong)", minWidth: 12 }} />}
          </li>
        ))}
      </ol>

      <section className="neu-raised" style={card}>
        {sectionHead(<Building2 size={17} />, t("detailsTitle"), detailsDone)}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px 18px" }}>
          {DETAILS.map((key) => (
            <label key={key} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <span style={label}>{t(`fields.${key}`)}</span>
              <input
                style={FIELD}
                value={form[key] ?? ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                onBlur={() => void saveDetails()}
                maxLength={200}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="neu-raised" style={card}>
        {sectionHead(<FileText size={17} />, t("documentsTitle"), docsDone)}
        <p style={{ ...help, margin: "-6px 0 16px" }}>{t("documentsHelp")}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {KINDS.map((kind) => {
            const doc = view.documents.find((d) => d.kind === kind);
            return (
              <div key={kind} style={{ borderRadius: 12, border: "1px solid var(--line-strong)", background: "var(--paper)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <span style={{
                  width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", flexShrink: 0,
                  background: doc ? "var(--good-tint)" : "var(--wine-tint)", color: doc ? "var(--good)" : "var(--wine)",
                }}>
                  {doc ? <Check size={18} /> : DOC_ICON[kind]}
                </span>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={label}>{t(`docs.${kind}.title`)}</div>
                  <p style={help}>{doc ? doc.filename : t(`docs.${kind}.help`)}</p>
                </div>
                <label className={`la-btn ${doc ? "la-btn--soft" : "la-btn--wine"}`} style={{ cursor: busyKind ? "default" : "pointer" }}>
                  {busyKind === kind ? <Loader2 size={13} className="animate-spin" /> : <FileUp size={13} />}
                  {busyKind === kind ? t("uploading") : doc ? t("replace") : t("upload")}
                  <input
                    type="file" accept={ACCEPT} hidden disabled={!!busyKind}
                    onChange={(e) => { void upload(kind, e.target.files?.[0]); e.target.value = ""; }}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "0 4px" }}>
        <ShieldCheck size={18} style={{ color: "var(--good)", flexShrink: 0, marginTop: 1 }} />
        <p style={help}><strong style={{ color: "var(--ink-soft)" }}>{t("carrierTitle")}</strong> {t("privacy")}</p>
      </div>

      {error && <div role="alert" style={{ fontSize: 13, color: "var(--stage-lost)", padding: "0 4px" }}>{error}</div>}
      <div style={{ padding: "0 4px" }}>
        <button type="button" className="la-btn la-btn--wine" style={{ padding: "11px 20px", fontSize: 14 }} onClick={() => void send()} disabled={sending || !!busyKind}>
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {t("send")}
        </button>
      </div>
    </>,
  );
}

/** A flat, crisp field: a hairline and a white surface, no carved shadow. */
const FIELD: React.CSSProperties = {
  fontSize: 14, padding: "10px 12px", width: "100%", borderRadius: 9, outline: "none",
  border: "1px solid var(--line-strong)", background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

const DOC_ICON: Record<Kind, React.ReactNode> = {
  kvk: <Building2 size={18} />,
  id: <IdCard size={18} />,
  address: <Home size={18} />,
};

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ width: 36, height: 36, borderRadius: 11, background: "var(--wine-tint)", color: "var(--wine)", display: "grid", placeItems: "center", flexShrink: 0 }}>
      {children}
    </span>
  );
}

function DoneDot() {
  return (
    <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--good-tint)", color: "var(--good)", display: "grid", placeItems: "center" }}>
      <Check size={13} />
    </span>
  );
}

/** A phone that is ringing happily, with the paperwork ticked off beside it. */
function HeroArt() {
  return (
    <svg viewBox="0 0 200 170" width="100%" style={{ maxWidth: 210 }} role="img" aria-hidden="true">
      {/* document */}
      <g transform="rotate(-8 62 92)">
        <rect x="26" y="46" width="72" height="92" rx="10" fill="var(--paper)" stroke="var(--line-strong)" />
        <rect x="38" y="62" width="34" height="6" rx="3" fill="var(--wine)" opacity="0.75" />
        <rect x="38" y="78" width="48" height="5" rx="2.5" fill="var(--line-strong)" />
        <rect x="38" y="90" width="48" height="5" rx="2.5" fill="var(--line-strong)" />
        <rect x="38" y="102" width="30" height="5" rx="2.5" fill="var(--line-strong)" />
        <circle cx="80" cy="120" r="9" fill="var(--good)" />
        <path d="M75.5 120.2l3.2 3.2 5.8-6.2" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* phone */}
      <rect x="104" y="26" width="64" height="122" rx="15" fill="var(--wine)" />
      <rect x="110" y="36" width="52" height="98" rx="9" fill="var(--paper)" />
      <rect x="126" y="30" width="20" height="3.5" rx="1.75" fill="var(--paper)" opacity="0.55" />
      {/* her face on the screen */}
      <circle cx="136" cy="74" r="17" fill="var(--wine-tint)" />
      <circle cx="130" cy="71" r="2.2" fill="var(--wine)" />
      <circle cx="142" cy="71" r="2.2" fill="var(--wine)" />
      <path d="M129 79c3.6 4.2 10.4 4.2 14 0" fill="none" stroke="var(--wine)" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="120" y="102" width="32" height="5" rx="2.5" fill="var(--line-strong)" />
      <rect x="126" y="113" width="20" height="5" rx="2.5" fill="var(--line-strong)" />
      {/* ringing */}
      <path d="M176 44c5 5 5 13 0 18M183 37c9 9 9 23 0 32" fill="none" stroke="var(--wine)" strokeWidth="2.6" strokeLinecap="round" opacity="0.55" />
      {/* sparkles */}
      <path d="M22 30l2.4 5.6L30 38l-5.6 2.4L22 46l-2.4-5.6L14 38l5.6-2.400z" fill="var(--wine)" opacity="0.5" />
      <circle cx="98" cy="20" r="3" fill="var(--good)" opacity="0.7" />
      <circle cx="184" cy="150" r="4" fill="var(--wine)" opacity="0.3" />
    </svg>
  );
}
