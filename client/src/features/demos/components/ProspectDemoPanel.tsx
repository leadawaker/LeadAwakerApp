import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, ExternalLink, Loader2, MessageCircle } from "lucide-react";
import { createDemoLink, demoOpenUrl } from "../api/demoSessionsApi";
import { SERVICES, tokenFromUrl, type ServiceDef } from "../services";
import type { DemoLang } from "@/features/campaigns/api/demoClientsApi";

/**
 * One prospect, every service, on one screen.
 *
 * The persona (a saved Client, usually built by scanning their website) is the
 * constant; each button mints that persona a link on a different service
 * campaign. That is what makes a discovery call pivotable: the prospect says
 * "we don't have an old database, our problem is nobody answers the phone", and
 * the voice demo is one click away wearing their brand.
 */

export interface ProspectDemoInput {
  firstName: string;
  language: DemoLang;
  clientNiche: string;
  companyName?: string;
  /** "" is the form's "not chosen" state for both, and means the campaign's own
   *  setting applies — so neither is ever sent empty. */
  market?: "" | "uk" | "us" | "nl";
  aiDisclosure?: "" | "off" | "opener" | "second_message";
  /** Ties every link minted here into one row on the Demos page. */
  prospectGroup: string;
}

export function ProspectDemoPanel({ input }: { input: ProspectDemoInput }) {
  const { t } = useTranslation("demos");
  const [links, setLinks] = useState<Record<string, { url: string; whatsapp?: string }>>({});
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");

  const ready = !!input.clientNiche && !!input.firstName.trim();

  const mint = async (svc: ServiceDef) => {
    if (!svc.campaignId || !ready) return;
    setBusy(svc.key);
    setError("");
    try {
      const body = await createDemoLink({
        firstName: input.firstName.trim(),
        language: input.language,
        campaignId: svc.campaignId,
        scenario: svc.scenario,
        clientNiche: input.clientNiche,
        service: svc.key,
        prospectGroup: input.prospectGroup,
        ...(input.companyName?.trim() ? { companyName: input.companyName.trim() } : {}),
        ...(input.aiDisclosure ? { aiDisclosure: input.aiDisclosure } : {}),
        ...(input.language === "en" && input.market ? { market: input.market } : {}),
      });
      const url = svc.voice
        ? `${window.location.origin}/voice-demo?token=${tokenFromUrl(body.demoUrl)}`
        : demoOpenUrl(body.demoUrl);
      setLinks((prev) => ({
        ...prev,
        // Voice has no WhatsApp side: it is a browser call, not a chat thread.
        [svc.key]: { url, whatsapp: svc.voice ? undefined : body.whatsappUrl },
      }));
    } catch (e) {
      setError((e as Error).message || "Failed");
    } finally {
      setBusy("");
    }
  };

  const copy = (key: string, url: string) => {
    void navigator.clipboard.writeText(url);
    setCopied(key);
    setTimeout(() => setCopied(""), 1200);
  };

  return (
    <div className="mt-6 border-t border-border pt-5">
      <h3 className="serif mb-1" style={{ fontSize: 15, color: "var(--ink)" }}>
        {t("services.heading")}
      </h3>
      <p className="mb-3" style={{ fontSize: 11, color: "var(--mute)" }}>
        {ready ? t("services.hint") : t("services.needClient")}
      </p>

      <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
        {SERVICES.map((svc) => {
          const link = links[svc.key];
          const disabled = !svc.campaignId || !ready || busy === svc.key;
          const Icon = svc.icon;
          return (
            <div
              key={svc.key}
              className="flex items-center gap-2 rounded-[var(--r-surface)] border border-border px-3 py-2"
              style={{ background: "var(--bg)", opacity: svc.campaignId ? 1 : 0.55 }}
            >
              <Icon size={14} style={{ flex: "0 0 auto", color: "var(--mute)" }} />
              <span className="flex-1 truncate" style={{ fontSize: 12, color: "var(--ink)" }}>
                {t(svc.labelKey)}
                {!svc.campaignId && (
                  <span style={{ marginLeft: 6, fontSize: 10, color: "var(--mute)" }}>
                    {t("services.soon")}
                  </span>
                )}
              </span>

              {link ? (
                <>
                  <button
                    type="button"
                    onClick={() => copy(svc.key, link.url)}
                    title={t("services.copy")}
                    style={{ color: "var(--mute)" }}
                  >
                    {copied === svc.key ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    title={t("services.open")}
                    style={{ color: "var(--mute)" }}
                  >
                    <ExternalLink size={14} />
                  </a>
                  {/* The same demo over WhatsApp. Click opens it, and a
                      long-press-free alternative is the copy above. */}
                  {link.whatsapp && (
                    <a
                      href={link.whatsapp}
                      target="_blank"
                      rel="noreferrer"
                      title={t("services.whatsapp")}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        copy(`${svc.key}-wa`, link.whatsapp!);
                      }}
                      style={{ color: "var(--mute)" }}
                    >
                      {copied === `${svc.key}-wa` ? (
                        <Check size={14} />
                      ) : (
                        <MessageCircle size={14} />
                      )}
                    </a>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void mint(svc)}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 9px",
                    borderRadius: "var(--r-surface)",
                    border: "1px solid var(--line)",
                    color: "var(--ink)",
                    cursor: disabled ? "default" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                  }}
                >
                  {busy === svc.key ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    t("services.create")
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-2" style={{ fontSize: 11, color: "var(--danger, #b4413c)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
