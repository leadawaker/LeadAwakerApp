import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { useDemoClients, type DemoLang } from "@/features/campaigns/api/demoClientsApi";
import { demoOpenUrl, useCreateDemoLink, type NewDemoResult } from "../api/demoSessionsApi";

const UNIVERSAL_DEMO_CAMPAIGN_ID = 60;

interface DemoCampaign {
  id: number;
  key: string;
  niche: string;
  emoji: string;
}

function useDemoCampaigns() {
  return useQuery<DemoCampaign[]>({
    queryKey: ["/api/demo/campaigns"],
    queryFn: async () => {
      const res = await apiFetch("/api/demo/campaigns");
      if (!res.ok) throw new Error("Failed to load demo campaigns");
      return (await res.json()).campaigns ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block" style={{ fontSize: 11, fontWeight: 600, color: "var(--mute)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 36,
  padding: "0 10px",
  borderRadius: "var(--r-surface)",
  border: "1px solid var(--line)",
  background: "var(--bg)",
  color: "var(--ink)",
  fontSize: 13,
  fontFamily: "var(--sans)",
};

function LinkRow({ label, url }: { label: string; url: string }) {
  const { t } = useTranslation("demos");
  const [copied, setCopied] = useState(false);
  return (
    <div className="mb-2 flex items-center gap-2">
      <span
        style={{
          flex: "0 0 84px",
          fontSize: 10.5,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--mute-2)",
        }}
      >
        {label}
      </span>
      <input readOnly value={url} style={{ ...inputStyle, height: 32, fontSize: 11.5, color: "var(--mute)" }} />
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted"
        style={{ color: "var(--mute-2)" }}
        aria-label={t("actions.copied")}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export function NewDemoForm() {
  const { t } = useTranslation("demos");
  const { data: clients } = useDemoClients();
  const { data: campaigns } = useDemoCampaigns();
  const create = useCreateDemoLink();

  const [firstName, setFirstName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [clientNiche, setClientNiche] = useState("");
  const [niche, setNiche] = useState("");
  const [language, setLanguage] = useState<DemoLang>("en");
  const [market, setMarket] = useState("");
  const [scenario, setScenario] = useState<"inquired" | "deciding">("inquired");
  const [aiDisclosure, setAiDisclosure] = useState("");
  const [campaignId, setCampaignId] = useState(UNIVERSAL_DEMO_CAMPAIGN_ID);
  const [result, setResult] = useState<NewDemoResult | null>(null);
  const [error, setError] = useState("");

  const submit = () => {
    setError("");
    if (!firstName.trim()) {
      setError(t("new.nameRequired"));
      return;
    }
    create.mutate(
      {
        firstName: firstName.trim(),
        language,
        campaignId,
        scenario,
        // Free text beats the picker: typing a niche is an explicit request for
        // a new persona, and create-link ignores `niche` when `clientNiche` is
        // also set, so sending both would silently drop the typed one.
        ...(niche.trim() ? { niche: niche.trim() } : clientNiche ? { clientNiche } : {}),
        ...(companyName.trim() ? { companyName: companyName.trim() } : {}),
        ...(aiDisclosure ? { aiDisclosure: aiDisclosure as "off" | "opener" | "second_message" } : {}),
        // Only meaningful on an English link: nl and pt resolve their own
        // market inside the generator.
        ...(language === "en" && market ? { market: market as "uk" | "us" | "nl" } : {}),
      },
      {
        onSuccess: (r) => setResult(r),
        onError: (e) => setError(e.message || t("new.failed")),
      },
    );
  };

  return (
    <div className="max-w-[560px]">
      <h2 className="serif mb-4" style={{ fontSize: 17, color: "var(--ink)" }}>
        {t("new.heading")}
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("new.firstName")}>
          <input
            style={inputStyle}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder={t("new.firstNamePlaceholder")}
          />
        </Field>
        <Field label={t("new.company")}>
          <input
            style={inputStyle}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder={t("new.companyPlaceholder")}
          />
        </Field>

        <Field label={t("new.client")}>
          <select style={inputStyle} value={clientNiche} onChange={(e) => setClientNiche(e.target.value)}>
            <option value="">{t("new.clientNone")}</option>
            {(clients ?? []).map((c) => (
              <option key={c.niche} value={c.niche}>
                {(c.emoji ? `${c.emoji} ` : "") + (c.label || c.niche)}
                {c.languages?.length ? ` · ${c.languages.join("/").toUpperCase()}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("new.language")}>
          <select style={inputStyle} value={language} onChange={(e) => setLanguage(e.target.value as DemoLang)}>
            <option value="en">English</option>
            <option value="nl">Nederlands</option>
            <option value="pt">Português</option>
          </select>
        </Field>

        <div className="col-span-2">
          <Field label={t("new.niche")}>
            <input
              style={inputStyle}
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder={t("new.nichePlaceholder")}
            />
          </Field>
        </div>

        <Field label={t("new.scenario")}>
          <select
            style={inputStyle}
            value={scenario}
            onChange={(e) => setScenario(e.target.value as "inquired" | "deciding")}
          >
            <option value="inquired">{t("mode.inquired")}</option>
            <option value="deciding">{t("mode.deciding")}</option>
          </select>
        </Field>
        <Field label={t("new.disclosure")}>
          <select style={inputStyle} value={aiDisclosure} onChange={(e) => setAiDisclosure(e.target.value)}>
            <option value="">{t("new.disclosureDefault")}</option>
            <option value="off">{t("disclosure.off")}</option>
            <option value="opener">{t("disclosure.opener")}</option>
            <option value="second_message">{t("disclosure.second_message")}</option>
          </select>
        </Field>

        {language === "en" && (
          <Field label={t("new.market")}>
            <select style={inputStyle} value={market} onChange={(e) => setMarket(e.target.value)}>
              <option value="">{t("new.marketDefault")}</option>
              <option value="uk">UK (£)</option>
              <option value="us">US ($)</option>
              <option value="nl">NL (€)</option>
            </select>
          </Field>
        )}
        <Field label={t("new.campaign")}>
          <select style={inputStyle} value={campaignId} onChange={(e) => setCampaignId(Number(e.target.value))}>
            {/* The universal demo is listed explicitly because it is NOT in
                DEMO_CAMPAIGNS: that list is the legacy per-niche campaigns the
                public /try flow offers, and adding 60 to it would change what
                anonymous visitors are served. It is the default here because it
                is the campaign every minted link actually runs on. */}
            <option value={UNIVERSAL_DEMO_CAMPAIGN_ID}>{t("new.universalCampaign")}</option>
            {(campaigns ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {(c.emoji ? `${c.emoji} ` : "") + c.niche}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={create.isPending}
        className="la-btn mt-4 inline-flex items-center gap-2"
        style={{
          background: "var(--wine)",
          color: "var(--paper)",
          borderRadius: "var(--r-surface)",
          padding: "9px 18px",
          fontSize: 13,
          fontWeight: 600,
          opacity: create.isPending ? 0.6 : 1,
        }}
      >
        {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {create.isPending ? t("new.submitting") : t("new.submit")}
      </button>

      {error && (
        <p className="mt-3" style={{ fontSize: 12.5, color: "var(--danger, #9A3B2E)" }}>
          {error}
        </p>
      )}

      {result && (
        <div
          className="mt-5"
          style={{
            padding: 14,
            borderRadius: "var(--r-surface)",
            background: "var(--surface)",
            boxShadow: "var(--sh-inset-crisp)",
          }}
        >
          <div
            className="mb-3"
            style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute-2)" }}
          >
            {t("new.resultHeading")}
          </div>
          {/* Said out loud on purpose: a fallback link looks identical to a good
              one, and sending a prospect a generic demo believing it is theirs
              is the worst outcome this form can produce. */}
          {result.generated === false && (
            <p className="mb-3" style={{ fontSize: 12, lineHeight: 1.5, color: "var(--ink)" }}>
              {t("new.fallback")}
            </p>
          )}
          {result.reused && (
            <p className="mb-3" style={{ fontSize: 12, color: "var(--mute)" }}>
              {t("new.reused", { name: result.reused })}
            </p>
          )}
          <LinkRow label={t("new.browserLink")} url={result.demoUrl} />
          <LinkRow label={t("new.whatsappLink")} url={result.whatsappUrl} />
          <a
            href={demoOpenUrl(result.demoUrl)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12.5, color: "var(--wine)", textDecoration: "underline", textUnderlineOffset: 2 }}
          >
            {t("new.openIt")} →
          </a>
        </div>
      )}
    </div>
  );
}
