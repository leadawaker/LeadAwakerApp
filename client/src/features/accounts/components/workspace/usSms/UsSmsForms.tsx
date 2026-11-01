// The three forms of US texting: the business (brand), the use case (campaign)
// and the number. The campaign form comes prefilled with a typical Lead Awaker
// client (reactivation plus receptionist replies, booking links), in English
// because carriers review US campaigns in English.
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Search } from "lucide-react";
import { EditSelect, EditText, InfoRow } from "@/features/campaigns/components/formFields";
import { searchUsNumbers, type UsNumber } from "./usSmsApi";

const ENTITY_TYPES = ["PRIVATE_PROFIT", "SOLE_PROPRIETOR", "NON_PROFIT", "PUBLIC_PROFIT"];
const VERTICALS = [
  "PROFESSIONAL", "CONSTRUCTION", "REAL_ESTATE", "HEALTHCARE", "RETAIL", "HOSPITALITY", "LEGAL", "FINANCIAL", "INSURANCE",
  "EDUCATION", "TECHNOLOGY", "TRANSPORTATION", "ENERGY", "ENTERTAINMENT", "MANUFACTURING", "AGRICULTURE", "HUMAN_RESOURCES",
  "COMMUNICATION", "NGO", "GOVERNMENT", "POSTAL", "POLITICAL", "GAMBLING",
];
const USECASES = ["MIXED", "LOW_VOLUME", "CUSTOMER_CARE", "MARKETING"];
const vertLabel = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, " ");

function Grid({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", columnGap: 18 }}>{children}</div>;
}

export function Submit({ busy, label, onClick, disabled }: { busy: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="la-btn la-btn--wine" onClick={onClick} disabled={busy || disabled} style={{ alignSelf: "flex-start", marginTop: 8 }}>
      {busy && <Loader2 size={14} className="animate-spin" />}{label}
    </button>
  );
}

export function BrandForm({ accountName, busy, onSubmit }: { accountName: string; busy: boolean; onSubmit: (b: Record<string, string>) => void }) {
  const { t } = useTranslation("usTexting");
  const [f, setF] = useState<Record<string, string>>({ entityType: "PRIVATE_PROFIT", displayName: accountName, vertical: "PROFESSIONAL" });
  const soleProp = f.entityType === "SOLE_PROPRIETOR";
  const field = (k: string, placeholder?: string) => (
    <InfoRow key={k} label={t(`brand.${k}`)} value={null}
      editChild={<EditText value={f[k] ?? ""} onChange={(v) => setF((s) => ({ ...s, [k]: v }))} placeholder={placeholder} />} />
  );
  return (
    <div style={{ display: "flex", flexDirection: "column" }} data-testid="us-sms-brand-form">
      <Grid>
        <InfoRow label={t("brand.entityType")} value={null} editChild={
          <EditSelect value={f.entityType} onChange={(v) => setF((s) => ({ ...s, entityType: v }))} options={ENTITY_TYPES}
            labels={Object.fromEntries(ENTITY_TYPES.map((e) => [e, t(`brand.entityTypes.${e}`)]))} />
        } />
        <InfoRow label={t("brand.vertical")} value={null} editChild={
          <EditSelect value={f.vertical} onChange={(v) => setF((s) => ({ ...s, vertical: v }))} options={VERTICALS}
            labels={Object.fromEntries(VERTICALS.map((v) => [v, vertLabel(v)]))} />
        } />
        {field("displayName")}
        {!soleProp && field("companyName")}
        {!soleProp && field("ein", "12-3456789")}
        {field("firstName")}
        {field("lastName")}
        {field("email")}
        {field("phone", "+1")}
        {soleProp && field("mobilePhone", "+1")}
        {field("website", "https://")}
        {field("street")}
        {field("city")}
        {field("state", "TX")}
        {field("postalCode")}
      </Grid>
      <Submit busy={busy} label={t("brand.submit")} onClick={() => onSubmit(f)} />
    </div>
  );
}

function defaults(name: string, bookingLink: string) {
  const link = bookingLink || "https://book.example.com/your-visit";
  return {
    usecase: "MIXED",
    description: `${name} texts people who asked about its services: answering their questions, following up on earlier quote requests and booking appointments. Messages are written by ${name}'s assistant and replies are answered within business hours.`,
    messageFlow: `Customers give their mobile number when they request a quote or book through ${name}'s website form, by phone or in person. The website form has an unchecked checkbox reading: "I agree to receive text messages from ${name} about my request. Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out, HELP for help." The privacy policy is linked next to it. Numbers are never bought or shared.`,
    samples: [
      `Hi Sarah, this is Emma from ${name}. You asked about a quote for your project last spring. Are you still planning it? Reply STOP to opt out.`,
      `Thanks Mark! I can do Tuesday 10am or Thursday 2pm for the visit. Which suits you? You can also pick a time here: ${link}`,
      `Hi Lisa, just checking in from ${name}: did you get a chance to look at the times I sent? Happy to help if you have questions.`,
    ],
    helpMessage: `${name}: reply with your question and we will get back to you, or visit our website. Msg & data rates may apply. Reply STOP to opt out.`,
    optoutMessage: `${name}: you are unsubscribed and will receive no more messages. Reply START to subscribe again.`,
    optinMessage: `${name}: thanks, you will now receive texts about your request. Msg & data rates may apply. Reply STOP to opt out, HELP for help.`,
    privacyPolicyLink: "",
    termsAndConditionsLink: "",
    embeddedLink: true,
  };
}

export function CampaignForm({ accountName, soleProp, busy, onSubmit }: {
  accountName: string; soleProp: boolean; busy: boolean; onSubmit: (c: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation("usTexting");
  const [f, setF] = useState(() => defaults(accountName, ""));
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));
  const text = (k: "description" | "messageFlow" | "helpMessage" | "optoutMessage" | "optinMessage", rows = 2) => (
    <InfoRow label={t(`campaign.${k}`)} value={null}
      editChild={<EditText value={f[k]} onChange={(v) => set(k, v)} multiline minRows={rows} />} />
  );
  return (
    <div style={{ display: "flex", flexDirection: "column" }} data-testid="us-sms-campaign-form">
      {!soleProp && (
        <InfoRow label={t("campaign.usecase")} value={null} editChild={
          <EditSelect value={f.usecase} onChange={(v) => set("usecase", v)} options={USECASES}
            labels={Object.fromEntries(USECASES.map((u) => [u, t(`campaign.usecases.${u}`)]))} />
        } />
      )}
      {text("description", 3)}
      {text("messageFlow", 4)}
      <InfoRow label={t("campaign.samples")} value={null} editChild={
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <EditText key={i} value={f.samples[i] ?? ""} multiline minRows={2} placeholder={t("campaign.sample", { n: i + 1 })}
              onChange={(v) => setF((s) => { const samples = [...s.samples]; samples[i] = v; return { ...s, samples }; })} />
          ))}
        </div>
      } />
      {text("helpMessage")}
      {text("optoutMessage")}
      {text("optinMessage")}
      <Grid>
        <InfoRow label={t("campaign.privacy")} value={null} editChild={<EditText value={f.privacyPolicyLink} onChange={(v) => set("privacyPolicyLink", v)} placeholder="https://" />} />
        <InfoRow label={t("campaign.terms")} value={null} editChild={<EditText value={f.termsAndConditionsLink} onChange={(v) => set("termsAndConditionsLink", v)} placeholder="https://" />} />
      </Grid>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink)", padding: "10px 0" }}>
        <input type="checkbox" checked={f.embeddedLink} onChange={(e) => set("embeddedLink", e.target.checked)} />
        {t("campaign.embeddedLink")}
      </label>
      <Submit busy={busy} label={t("campaign.submit")} onClick={() => onSubmit({ ...f, samples: f.samples.filter((s) => s?.trim()) })} />
    </div>
  );
}

export function NumberPicker({ accountId, busy, onBuy }: { accountId: number; busy: boolean; onBuy: (phoneNumber: string) => void }) {
  const { t } = useTranslation("usTexting");
  const [area, setArea] = useState("");
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<UsNumber[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const search = async () => {
    setLoading(true); setError(null);
    try { setFound(await searchUsNumbers(accountId, area)); } catch (e) { setError((e as Error).message); setFound(null); } finally { setLoading(false); }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="us-sms-number-picker">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input className="la-input" style={{ maxWidth: 120 }} inputMode="numeric" maxLength={3} value={area} aria-label={t("number.areaCode")}
          placeholder={t("number.areaCode")} onChange={(e) => setArea(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => { if (e.key === "Enter" && area.length === 3) void search(); }} />
        <button type="button" className="la-btn la-btn--soft" onClick={() => void search()} disabled={area.length !== 3 || loading}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}{t("number.search")}
        </button>
      </div>
      {error && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: "var(--stage-lost)" }}>{t("error", { message: error })}</p>}
      {found && found.length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }}>{t("number.none")}</p>}
      {found && found.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {found.map((n) => (
            <div key={n.phoneNumber} className="neu-inset-crisp" style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: "var(--r-button)", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink)" }}>{n.phoneNumber}</span>
              <span style={{ fontSize: 12, color: "var(--mute)", flex: 1 }}>
                {[n.locality, n.region].filter(Boolean).join(", ")}{n.monthly ? ` · ${t("number.monthly", { price: `$${Number(n.monthly).toFixed(2)}` })}` : ""}
              </span>
              <button type="button" className="la-btn la-btn--soft" disabled={busy} onClick={() => onBuy(n.phoneNumber)}>
                {busy && <Loader2 size={13} className="animate-spin" />}{t("number.buy", { number: n.phoneNumber })}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
