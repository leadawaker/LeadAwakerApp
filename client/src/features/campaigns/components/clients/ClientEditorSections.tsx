/**
 * The form sections of the persona editor. Presentation only: every value
 * comes from ClientEditor's draft and every change goes back through its
 * setters, so autosave sees one draft no matter which section was typed in.
 */
import { useTranslation } from "react-i18next";
import { BookOpenText, Languages, MessageSquareQuote, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { TERM_GROUPS, type ClientTextField, type DemoLang, type TermGroup } from "../../api/demoClientsApi";
import { CategorySelect } from "./CategorySelect";
import { ClientSection } from "./ClientSection";
import { LANGS, filledLangs, rowsVar } from "./clientDisplay";
import { OPENER_FIELDS, TEXT_FIELDS, type Draft, type PersonaGroup, type TextFieldDef } from "./clientDraft";

/** "Filled in: EN, NL", the header verdict of a per-language section. */
function FilledVerdict({ langs }: { langs: DemoLang[] }) {
  const { t } = useTranslation("campaigns");
  return (
    <span className="dp-verdict">
      {langs.length
        ? t("clients.filledIn", { langs: langs.map((l) => l.toUpperCase()).join(", ") })
        : t("clients.nothingFilled")}
    </span>
  );
}

/** One language's box for a field that exists per language. */
function LangSlot({ lang, label, value, onChange, rows }: {
  lang: DemoLang;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Present: a textarea of that height. Absent: a single-line input. */
  rows?: number;
}) {
  const shared = { className: "la-input dp-input", value, "aria-label": `${label} (${lang.toUpperCase()})` };
  return (
    <div className={cn("dp-slot", value.trim() && "is-filled")}>
      <span className="dp-slot-tag" aria-hidden>{lang.toUpperCase()}</span>
      {rows === undefined
        ? <input {...shared} onChange={(e) => onChange(e.target.value)} />
        : <textarea {...shared} rows={rows} style={rowsVar(rows)} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

/** Where the persona is filed in the library and the emoji it is listed with. */
export function IdentitySection({ category, emoji, onCategory, onEmoji }: {
  category: string;
  emoji: string;
  onCategory: (value: string) => void;
  onEmoji: (value: string) => void;
}) {
  const { t } = useTranslation("campaigns");
  return (
    <ClientSection icon={Tag} title={t("clients.identityTitle")} blurb={t("clients.identityHint")}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 220px", maxWidth: 300 }}>
          <label className="dp-label">{t("clients.categoryLabel", "Category")}</label>
          <CategorySelect value={category} onChange={onCategory} />
        </div>
        <div style={{ width: 90 }}>
          <label className="dp-label" htmlFor="dp-emoji">{t("clients.emojiLabel", "Emoji")}</label>
          <input
            id="dp-emoji"
            className="la-input dp-input"
            value={emoji}
            onChange={(e) => onEmoji(e.target.value)}
            maxLength={8}
            placeholder="🍳"
          />
        </div>
      </div>
    </ClientSection>
  );
}

/** Terms: the only genuinely per-language part. */
export function WordsSection({ terms, onChange }: {
  terms: Draft["terms"];
  onChange: (group: TermGroup, lang: DemoLang, value: string) => void;
}) {
  const { t } = useTranslation("campaigns");
  return (
    <ClientSection
      icon={Languages}
      title={t("clients.termsTitle", "Words")}
      blurb={t("clients.termsHint")}
      aside={<FilledVerdict langs={filledLangs(TERM_GROUPS.map((g) => terms[g]))} />}
    >
      <div className="dp-terms">
        {TERM_GROUPS.map((group) => (
          <TermRow
            key={group}
            label={t(`clients.terms.${group}`)}
            values={terms[group] ?? {}}
            onChange={(lang, v) => onChange(group, lang, v)}
          />
        ))}
      </div>
    </ClientSection>
  );
}

/** One term group across the three languages. */
function TermRow({ label, values, onChange }: {
  label: string;
  values: Partial<Record<DemoLang, string>>;
  onChange: (lang: DemoLang, value: string) => void;
}) {
  return (
    <>
      <span className="dp-term-label">{label}</span>
      {LANGS.map((l) => (
        <LangSlot key={l} lang={l} label={label} value={values[l] ?? ""} onChange={(v) => onChange(l, v)} />
      ))}
    </>
  );
}

/** Opener: substituted verbatim, so per-language too. */
export function OpenerSection({ text, onChange }: {
  text: Draft["text"];
  onChange: (field: ClientTextField, lang: DemoLang, value: string) => void;
}) {
  const { t } = useTranslation("campaigns");
  return (
    <ClientSection
      icon={MessageSquareQuote}
      title={t("clients.openerTitle", "Opener")}
      blurb={t("clients.openerHint")}
      aside={<FilledVerdict langs={filledLangs(OPENER_FIELDS.map(({ field }) => text[field]))} />}
    >
      <div className="dp-fields">
        {OPENER_FIELDS.map(({ field, labelKey, rows }) => (
          <div key={field}>
            <span className="dp-label">{t(labelKey)}</span>
            <div className="dp-trio">
              {LANGS.map((l) => (
                <LangSlot
                  key={l}
                  lang={l}
                  label={t(labelKey)}
                  value={text[field]?.[l] ?? ""}
                  onChange={(v) => onChange(field, l, v)}
                  rows={rows ?? 1}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </ClientSection>
  );
}

const PERSONA_GROUPS: PersonaGroup[] = ["business", "lead", "conversation"];

/** Everything the model reads: one language at a time. */
export function PersonaSection({ text, lang, onLang, onChange }: {
  text: Draft["text"];
  lang: DemoLang;
  onLang: (lang: DemoLang) => void;
  onChange: (field: ClientTextField, lang: DemoLang, value: string) => void;
}) {
  const { t } = useTranslation("campaigns");
  const withContent = filledLangs(TEXT_FIELDS.map(({ field }) => text[field]));

  const box = ({ field, labelKey, rows }: TextFieldDef) => (
    <div key={field}>
      <label className="dp-label" htmlFor={`dp-${field}`}>{t(labelKey)}</label>
      <textarea
        id={`dp-${field}`}
        className="la-input dp-input"
        value={text[field]?.[lang] ?? ""}
        onChange={(e) => onChange(field, lang, e.target.value)}
        rows={rows ?? 1}
        style={rowsVar(rows ?? 1)}
      />
      {field === "companyNameTemplate" && <p className="dp-help">{t("clients.companyNameHint")}</p>}
    </div>
  );

  return (
    <ClientSection
      icon={BookOpenText}
      title={t("clients.personaTitle", "Persona")}
      blurb={t("clients.personaHint")}
      aside={
        /* Authored once, in whichever language it was written in (English by
           convention, but a scraped Client may live in NL or PT only). This
           switches which slot the boxes below show and edit; it never shows
           three at once, unlike Words/Opener, because a Client's persona is
           not normally written in more than one language at a time. */
        <div className="la-seg" role="tablist" aria-label={t("clients.personaLanguage")}>
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={lang === l}
              className={cn("la-seg-btn", lang === l && "on")}
              onClick={() => onLang(l)}
            >
              {l.toUpperCase()}
              {!withContent.includes(l) && <span style={{ opacity: 0.6, fontWeight: 400 }}>{t("clients.empty", "(empty)")}</span>}
            </button>
          ))}
        </div>
      }
    >
      {PERSONA_GROUPS.map((group) => {
        const fields = TEXT_FIELDS.filter((f) => f.group === group);
        const short = fields.filter((f) => f.rows === undefined);
        const long = fields.filter((f) => f.rows !== undefined);
        return (
          <div key={group} className="dp-group">
            <div className="dp-group-title">{t(`clients.groups.${group}`)}</div>
            <div className="dp-fields">
              {short.length > 0 && <div className="dp-trio" style={{ alignItems: "start" }}>{short.map(box)}</div>}
              {long.map(box)}
            </div>
          </div>
        );
      })}
    </ClientSection>
  );
}
