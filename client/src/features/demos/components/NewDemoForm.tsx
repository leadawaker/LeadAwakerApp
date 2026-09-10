import { useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/apiUtils";
import { useDemoClients, type DemoLang } from "@/features/campaigns/api/demoClientsApi";
import { ProspectDemoPanel } from "./ProspectDemoPanel";



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

export function NewDemoForm() {
  const { t } = useTranslation("demos");
  const { data: clients } = useDemoClients();

  const [firstName, setFirstName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [clientNiche, setClientNiche] = useState("");
  const [niche, setNiche] = useState("");
  const [language, setLanguage] = useState<DemoLang>("en");
  const [market, setMarket] = useState<"" | "uk" | "us" | "nl">("");
  const [aiDisclosure, setAiDisclosure] = useState<"" | "off" | "opener" | "second_message">("");
  // One id for this prospect, minted once and carried by every service link
  // created below it, which is what lets the Demos page show them as one row.
  // Services are created one button at a time during a call, so nothing
  // server-side could infer that they belong together.
  const [prospectGroup] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState("");

  // Build a Client from the prospect's own website, then select it. The scrape
  // supplies the facts (services, hours, area); the niche generator supplies
  // the vocabulary and ladder. Clears the free-text niche because create-link
  // ignores `clientNiche` whenever `niche` is also set.
  const scanWebsite = async (fromNotes = false) => {
    const url = website.trim();
    const text = notes.trim();
    if (fromNotes ? !text : !url) return;
    setScanning(true);
    setScanNote("");
    setError("");
    try {
      const res = await apiFetch("/api/demo/clients/from-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(fromNotes ? { text } : { url }),
          language,
          ...(language === "en" && market ? { market } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.message || t("new.websiteFailed"));
        return;
      }
      setClientNiche(body.client);
      setNiche("");
      setScanNote(
        t("new.websiteDone", { client: body.client, pages: (body.pages_scraped ?? []).length }),
      );
    } catch {
      setError(t("new.websiteFailed"));
    } finally {
      setScanning(false);
    }
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

        {/* Spans both columns: the URL is the fastest way to fill the Client
            picker below it, so it reads as the step before it, not beside it. */}
        <div className="col-span-2">
          <Field label={t("new.website")}>
            <div className="flex items-center gap-2">
              <input
                style={inputStyle}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder={t("new.websitePlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!scanning) void scanWebsite();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => void scanWebsite()}
                disabled={scanning || !website.trim()}
                style={{
                  flex: "0 0 auto",
                  height: 36,
                  padding: "0 12px",
                  borderRadius: "var(--r-surface)",
                  border: "1px solid var(--line)",
                  background: "var(--bg)",
                  color: "var(--ink)",
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  opacity: scanning || !website.trim() ? 0.5 : 1,
                  cursor: scanning || !website.trim() ? "default" : "pointer",
                }}
              >
                {scanning ? t("new.websiteScanning") : t("new.websiteScrape")}
              </button>
            </div>
          </Field>
          <p style={{ marginTop: 4, fontSize: 11, color: "var(--mute)" }}>
            {scanNote || t("new.websiteHint")}
          </p>

          {/* The escape hatch. Some sites answer a scraper with 403 or render
              only in JavaScript, and the presenter usually knows the business
              anyway: paste it and get the same Client, saved the same way. */}
          <div style={{ marginTop: 10 }}>
            <Field label={t("new.notes")}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("new.notesPlaceholder")}
                rows={4}
                style={{ ...inputStyle, height: "auto", padding: "8px 10px", resize: "vertical" }}
              />
            </Field>
            <button
              type="button"
              onClick={() => void scanWebsite(true)}
              disabled={scanning || !notes.trim()}
              style={{
                marginTop: 6,
                height: 30,
                padding: "0 12px",
                borderRadius: "var(--r-surface)",
                border: "1px solid var(--line)",
                background: "var(--bg)",
                color: "var(--ink)",
                fontSize: 11,
                fontWeight: 600,
                opacity: scanning || !notes.trim() ? 0.5 : 1,
                cursor: scanning || !notes.trim() ? "default" : "pointer",
              }}
            >
              {scanning ? t("new.websiteScanning") : t("new.notesBuild")}
            </button>
          </div>
        </div>

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

        <Field label={t("new.disclosure")}>
          <select
            style={inputStyle}
            value={aiDisclosure}
            onChange={(e) => setAiDisclosure(e.target.value as typeof aiDisclosure)}
          >
            <option value="">{t("new.disclosureDefault")}</option>
            <option value="off">{t("disclosure.off")}</option>
            <option value="opener">{t("disclosure.opener")}</option>
            <option value="second_message">{t("disclosure.second_message")}</option>
          </select>
        </Field>

        {language === "en" && (
          <Field label={t("new.market")}>
            <select
              style={inputStyle}
              value={market}
              onChange={(e) => setMarket(e.target.value as typeof market)}
            >
              <option value="">{t("new.marketDefault")}</option>
              <option value="uk">UK (£)</option>
              <option value="us">US ($)</option>
              <option value="nl">NL (€)</option>
            </select>
          </Field>
        )}
      </div>

      {error && (
        <p className="mt-3" style={{ fontSize: 12.5, color: "var(--danger, #9A3B2E)" }}>
          {error}
        </p>
      )}

      <ProspectDemoPanel
        input={{
          firstName,
          language,
          clientNiche,
          companyName,
          market,
          aiDisclosure,
          prospectGroup,
        }}
      />
    </div>
  );
}
