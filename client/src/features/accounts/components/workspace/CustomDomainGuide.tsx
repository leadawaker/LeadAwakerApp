// "How to set this up" for a custom booking domain: a popup with the steps,
// who manages the client's DNS (looked up live), the exact record to add, and
// a ready-made message to forward to whoever runs their website.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, HelpCircle, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { fetchDnsHost, type DnsHost } from "../../api/calendarApi";

const stepNum: React.CSSProperties = {
  width: 24, height: 24, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
  background: "var(--wine-tint)", color: "var(--wine)", fontSize: 12, fontWeight: 700,
};
const mono: React.CSSProperties = { fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)" };

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <span style={stepNum}>{n}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

export function CustomDomainGuide({ accountId, domain, cnameTarget, website }: {
  accountId: number;
  /** The saved domain, if any. */
  domain: string | null;
  cnameTarget: string;
  /** The account's website, to suggest afspraak.<their domain>. */
  website?: string | null;
}) {
  const { t } = useTranslation("accounts");
  const site = (website ?? "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const suggested = domain ?? (site ? `${t("customDomainGuide.subdomain")}.${site}` : "");
  const [host, setHost] = useState<DnsHost | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const name = suggested ? suggested.split(".")[0] : t("customDomainGuide.subdomain");
  const message = t("customDomainGuide.message", { domain: suggested || `${name}.example.com`, name, target: cnameTarget });

  const copy = (key: string, value: string) => {
    void navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };
  const lookUp = async () => {
    if (!suggested) return;
    setLooking(true); setLookupFailed(false);
    try { setHost(await fetchDnsHost(accountId, suggested)); } catch { setLookupFailed(true); }
    finally { setLooking(false); }
  };
  const copyBtn = (key: string, value: string) => (
    <button type="button" className="la-btn la-btn--icon" onClick={() => copy(key, value)} style={{ background: "transparent", boxShadow: "none", color: "var(--mute-2)" }} aria-label={t("customDomainGuide.copy")}>
      {copied === key ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="la-btn la-btn--soft" data-testid="custom-domain-guide">
          <HelpCircle size={12} /> {t("customDomainGuide.open")}
        </button>
      </DialogTrigger>
      <DialogContent style={{ maxWidth: "min(92vw, 600px)", maxHeight: "88vh", overflowY: "auto" }}>
        <DialogHeader>
          <DialogTitle>{t("customDomainGuide.title")}</DialogTitle>
          <DialogDescription>{t("customDomainGuide.intro")}</DialogDescription>
        </DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 4 }}>
          <Step n={1} title={t("customDomainGuide.step1")}>
            <p style={{ fontSize: 12.5, color: "var(--mute)", margin: 0, lineHeight: 1.5 }}>
              {t("customDomainGuide.step1Help")} {suggested && <span style={mono}>{suggested}</span>}
            </p>
          </Step>
          <Step n={2} title={t("customDomainGuide.step2")}>
            <p style={{ fontSize: 12.5, color: "var(--mute)", margin: "0 0 8px", lineHeight: 1.5 }}>{t("customDomainGuide.step2Help")}</p>
            {suggested && (
              <button type="button" className="la-btn la-btn--soft" onClick={lookUp} disabled={looking}>
                {looking ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />} {t("customDomainGuide.lookUp")}
              </button>
            )}
            {host && (
              <div className="neu-inset-crisp" style={{ borderRadius: "var(--r-surface)", padding: "10px 12px", marginTop: 8, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                {host.registrar && <div>{t("customDomainGuide.registrar")}: <b>{host.registrar}</b></div>}
                {host.nameservers.length > 0 && <div>{t("customDomainGuide.nameservers")}: <span style={mono}>{host.nameservers.join(", ")}</span></div>}
                <div style={{ color: "var(--mute)", marginTop: 4 }}>{t("customDomainGuide.hostHint")}</div>
              </div>
            )}
            {lookupFailed && <p style={{ fontSize: 12, color: "var(--warn)", margin: "6px 0 0" }}>{t("customDomainGuide.lookupFailed")}</p>}
          </Step>
          <Step n={3} title={t("customDomainGuide.step3")}>
            <div className="neu-inset-crisp" style={{ borderRadius: "var(--r-surface)", padding: "6px 12px", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "4px 12px", alignItems: "center", fontSize: 12.5 }}>
              <span style={{ color: "var(--mute)" }}>{t("customDomain.recordType")}</span><span style={mono}>CNAME</span><span />
              <span style={{ color: "var(--mute)" }}>{t("customDomain.recordName")}</span><span style={mono}>{name}</span>{copyBtn("name", name)}
              <span style={{ color: "var(--mute)" }}>{t("customDomain.recordTarget")}</span><span style={{ ...mono, overflowWrap: "anywhere" }}>{cnameTarget}</span>{copyBtn("target", cnameTarget)}
            </div>
            <p style={{ fontSize: 12, color: "var(--mute)", margin: "6px 0 0", lineHeight: 1.5 }}>{t("customDomainGuide.step3Help")}</p>
          </Step>
          <Step n={4} title={t("customDomainGuide.step4")}>
            <p style={{ fontSize: 12.5, color: "var(--mute)", margin: 0, lineHeight: 1.5 }}>{t("customDomainGuide.step4Help")}</p>
          </Step>
          <Step n={5} title={t("customDomainGuide.step5")}>
            <p style={{ fontSize: 12.5, color: "var(--mute)", margin: 0, lineHeight: 1.5 }}>{t("customDomainGuide.step5Help")}</p>
          </Step>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="eyebrow eyebrow-sm">{t("customDomainGuide.messageTitle")}</span>
              <button type="button" className="la-btn la-btn--soft" onClick={() => copy("message", message)}>
                {copied === "message" ? <Check size={12} /> : <Copy size={12} />} {t("customDomainGuide.copyMessage")}
              </button>
            </div>
            <pre className="neu-inset-crisp" style={{ margin: 0, borderRadius: "var(--r-surface)", padding: "10px 12px", whiteSpace: "pre-wrap", fontFamily: "var(--sans)", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.55 }}>{message}</pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
