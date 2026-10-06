// Step renderers for the receptionist onboarding sections (services, stock feed,
// handoff, voice, website chat, WhatsApp). See specs/receptionist-onboarding.
// Answers live in ProfileAnswers.setup; the widget and WhatsApp steps embed the
// same cards as the Integrations tab, which save on their own.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { OptionCard, Chip, RecommendedBadge, inputStyle } from "./wizardAtoms";
import {
  SERVICES, VOICE_LINES, FORWARD_WHEN, RING_WHEN, AFTER_HOURS, WA_NUMBER_CHOICE, WA_APP_TYPE,
  VOICE_OPTIONS, VOICE_LOCALES, MOBILE_FORWARD_CODES, type ReceptionistSetup,
} from "./setupConstants";
import { WebsiteChatCard, InboundWhatsAppCard } from "../WebsiteChatCard";
import { MessagingCard } from "../MessagingCards";
import type { AccountRow, AccountDetail } from "../types";

// Recommended picks (badge only, never preselected).
const RECOMMENDED: Record<string, string> = {
  ringWhen: "hours", afterHours: "callback", voice: "marin", numberChoice: "new",
};

const help = { fontSize: 12.5, color: "var(--mute)", margin: "0 0 12px", lineHeight: 1.5 } as const;
const fieldGap = { display: "flex", flexDirection: "column", gap: 16 } as const;

function Label({ children }: { children: ReactNode }) {
  return <div className="eyebrow eyebrow-sm" style={{ marginBottom: 8 }}>{children}</div>;
}

function TextInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="neu-inset-crisp" style={inputStyle} />;
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

interface Props {
  stepKey: string;
  services: string[];
  onServicesChange: (services: string[]) => void;
  setup: ReceptionistSetup;
  onSetupChange: <K extends keyof ReceptionistSetup>(part: K, patch: Partial<ReceptionistSetup[K]>) => void;
  accountId?: number;
  account?: AccountRow;
  detail?: AccountDetail;
  onSaveAccount?: (field: string, value: string) => Promise<void>;
}

export function ServiceStep({ stepKey, services, onServicesChange, setup, onSetupChange, accountId, account, detail, onSaveAccount }: Props) {
  const { t } = useTranslation("communicationProfile");
  const q = (k: string): string => t(`questions.${stepKey}.${k}`);
  const badge = (field: string, key: string) =>
    RECOMMENDED[field] === key ? <RecommendedBadge label={t("wizard.recommended")} /> : undefined;
  const { handoff, voice, whatsapp, stock } = setup;

  switch (stepKey) {
    case "services":
      return (
        <div>
          <p style={help}>{q("help")}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {SERVICES.map((s) => (
              <OptionCard key={s} selected={services.includes(s)} onClick={() => onServicesChange(toggle(services, s))}>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-soft)", display: "block" }}>{q(`options.${s}.label`)}</span>
                <span style={{ fontSize: 12, color: "var(--mute)", display: "block", marginTop: 4, lineHeight: 1.5 }}>{q(`options.${s}.help`)}</span>
              </OptionCard>
            ))}
          </div>
        </div>
      );

    case "stockFeed":
      return (
        <div style={fieldGap}>
          <p style={{ ...help, margin: 0 }}>{q("help")}</p>
          <div>
            <Label>{q("urlLabel")}</Label>
            <TextInput type="url" value={stock.feedUrl} onChange={(feedUrl) => onSetupChange("stock", { feedUrl })} placeholder={q("urlPlaceholder")} />
          </div>
          <div>
            <Label>{q("notesLabel")}</Label>
            <textarea
              value={stock.notes}
              onChange={(e) => onSetupChange("stock", { notes: e.target.value })}
              placeholder={q("notesPlaceholder")}
              rows={3}
              className="neu-inset-crisp"
              style={{ ...inputStyle, padding: "11px 13px", resize: "vertical", lineHeight: 1.5 }}
            />
          </div>
        </div>
      );

    case "handoffContact":
      return (
        <div style={fieldGap}>
          <p style={{ ...help, margin: 0 }}>{q("help")}</p>
          <div>
            <Label>{q("nameLabel")}</Label>
            <TextInput value={handoff.name} onChange={(name) => onSetupChange("handoff", { name })} placeholder={q("namePlaceholder")} />
          </div>
          <div>
            <Label>{q("numberLabel")}</Label>
            <TextInput type="tel" value={handoff.number} onChange={(number) => onSetupChange("handoff", { number })} placeholder="+31 6 12345678" />
          </div>
        </div>
      );

    case "handoffRules":
      return (
        <div style={fieldGap}>
          <div>
            <Label>{q("ringLabel")}</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {RING_WHEN.map((k) => (
                <OptionCard key={k} selected={handoff.ringWhen === k} onClick={() => onSetupChange("handoff", { ringWhen: k })} badge={badge("ringWhen", k)}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink-soft)", display: "block" }}>{q(`options.${k}.label`)}</span>
                  <span style={{ fontSize: 12, color: "var(--mute)", display: "block", marginTop: 4, lineHeight: 1.5 }}>{q(`options.${k}.help`)}</span>
                </OptionCard>
              ))}
            </div>
          </div>
          <div>
            <Label>{q("recapLabel")}</Label>
            <p style={help}>{q("recapHelp")}</p>
            <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
              <Chip selected={handoff.recap} onClick={() => onSetupChange("handoff", { recap: true })} label={q("recapOn")} />
              <Chip selected={!handoff.recap} onClick={() => onSetupChange("handoff", { recap: false })} label={q("recapOff")} />
              {handoff.recap && (
                <input
                  type="time"
                  value={handoff.recapTime}
                  onChange={(e) => onSetupChange("handoff", { recapTime: e.target.value })}
                  aria-label={q("recapTime")}
                  className="neu-inset-crisp"
                  style={{ ...inputStyle, width: 120 }}
                />
              )}
            </div>
          </div>
        </div>
      );

    case "voiceForwarding": {
      const hasLandline = voice.lines.includes("landline");
      const hasMobile = voice.lines.includes("mobile");
      const aiNumber = q("aiNumber");
      return (
        <div style={fieldGap}>
          <p style={{ ...help, margin: 0 }}>{q("help")}</p>
          <div>
            <Label>{q("linesLabel")}</Label>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              {VOICE_LINES.map((k) => (
                <Chip key={k} selected={voice.lines.includes(k)} onClick={() => onSetupChange("voice", { lines: toggle(voice.lines, k) })} label={q(`lines.${k}`)} />
              ))}
            </div>
          </div>
          {hasLandline && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <Label>{q("landlineNumber")}</Label>
                <TextInput type="tel" value={voice.landlineNumber} onChange={(landlineNumber) => onSetupChange("voice", { landlineNumber })} placeholder="073 123 4567" />
              </div>
              <div>
                <Label>{q("landlineProvider")}</Label>
                <TextInput value={voice.landlineProvider} onChange={(landlineProvider) => onSetupChange("voice", { landlineProvider })} placeholder={q("landlineProviderPlaceholder")} />
              </div>
              <p style={{ ...help, gridColumn: "1 / -1", margin: 0 }}>{q("landlineHelp")}</p>
            </div>
          )}
          {hasMobile && (
            <div>
              <Label>{q("mobileNumber")}</Label>
              <TextInput type="tel" value={voice.mobileNumber} onChange={(mobileNumber) => onSetupChange("voice", { mobileNumber })} placeholder="06 12345678" />
            </div>
          )}
          <div>
            <Label>{q("whenLabel")}</Label>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              {FORWARD_WHEN.map((k) => (
                <Chip key={k} selected={voice.forwardWhen.includes(k)} onClick={() => onSetupChange("voice", { forwardWhen: toggle(voice.forwardWhen, k) })} label={q(`when.${k}`)} />
              ))}
            </div>
          </div>
          {hasMobile && voice.forwardWhen.length > 0 && (
            <div style={{ background: "var(--paper)", borderRadius: "var(--r-button)", padding: "13px 15px" }}>
              <div className="eyebrow eyebrow-sm" style={{ marginBottom: 9, color: "var(--mute-2)" }}>{q("codesLabel")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {FORWARD_WHEN.filter((k) => voice.forwardWhen.includes(k)).map((k) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5 }}>
                    <span style={{ color: "var(--mute)" }}>{q(`when.${k}`)}</span>
                    <span style={{ fontFamily: "var(--mono)", color: "var(--ink-soft)" }}>{MOBILE_FORWARD_CODES[k].replace("{n}", aiNumber)}</span>
                  </div>
                ))}
              </div>
              <p style={{ ...help, margin: "9px 0 0" }}>{q("cancelHint")}</p>
            </div>
          )}
        </div>
      );
    }

    case "voiceSound":
      return (
        <div style={fieldGap}>
          <div>
            <Label>{q("voiceLabel")}</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {VOICE_OPTIONS.map((k) => (
                <OptionCard key={k} selected={voice.voice === k} onClick={() => onSetupChange("voice", { voice: k })} badge={badge("voice", k)}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink-soft)", display: "block", textTransform: "capitalize" }}>{k}</span>
                  <span style={{ fontSize: 12, color: "var(--mute)", display: "block", marginTop: 3 }}>{q(`voices.${k}`)}</span>
                </OptionCard>
              ))}
            </div>
          </div>
          <div>
            <Label>{q("localeLabel")}</Label>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              {VOICE_LOCALES.map((k) => (
                <Chip key={k} selected={voice.locale === k} onClick={() => onSetupChange("voice", { locale: k })} label={q(`locales.${k}`)} />
              ))}
            </div>
          </div>
          <div>
            <Label>{q("greetingLabel")}</Label>
            <p style={help}>{q("greetingHelp")}</p>
            <textarea
              value={voice.greeting}
              onChange={(e) => onSetupChange("voice", { greeting: e.target.value })}
              placeholder={q("greetingPlaceholder")}
              rows={3}
              className="neu-inset-crisp"
              style={{ ...inputStyle, padding: "11px 13px", resize: "vertical", lineHeight: 1.5 }}
            />
          </div>
        </div>
      );

    case "voicePronunciation": {
      const rows = voice.pronunciation.length ? voice.pronunciation : [{ word: "", sayAs: "" }];
      const setRows = (pronunciation: typeof rows) => onSetupChange("voice", { pronunciation });
      return (
        <div>
          <p style={help}>{q("help")}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((row, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={row.word}
                  onChange={(e) => setRows(rows.map((r, idx) => (idx === i ? { ...r, word: e.target.value } : r)))}
                  placeholder={q("wordPlaceholder")}
                  className="neu-inset-crisp"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  value={row.sayAs}
                  onChange={(e) => setRows(rows.map((r, idx) => (idx === i ? { ...r, sayAs: e.target.value } : r)))}
                  placeholder={q("sayAsPlaceholder")}
                  className="neu-inset-crisp"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                  className="la-btn la-btn--soft la-btn--icon"
                  title={q("remove")}
                  style={{ width: 34, height: 34, flexShrink: 0 }}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="la-btn la-btn--inset" style={{ marginTop: 12 }} onClick={() => setRows([...rows, { word: "", sayAs: "" }])}>
            <Plus size={13} />{q("add")}
          </button>
        </div>
      );
    }

    case "voiceAfterHours":
      return (
        <div>
          <p style={help}>{q("help")}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {AFTER_HOURS.map((k) => (
              <OptionCard key={k} selected={voice.afterHours === k} onClick={() => onSetupChange("voice", { afterHours: k })} badge={badge("afterHours", k)}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink-soft)", display: "block" }}>{q(`options.${k}.label`)}</span>
                <span style={{ fontSize: 12, color: "var(--mute)", display: "block", marginTop: 4, lineHeight: 1.5 }}>{q(`options.${k}.help`)}</span>
              </OptionCard>
            ))}
          </div>
        </div>
      );

    case "widgetSetup":
      return (
        <div>
          <p style={help}>{q("help")}</p>
          {accountId ? <WebsiteChatCard accountId={accountId} /> : null}
        </div>
      );

    case "whatsappNumber":
      return (
        <div style={fieldGap}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {WA_NUMBER_CHOICE.map((k) => (
              <OptionCard key={k} selected={whatsapp.numberChoice === k} onClick={() => onSetupChange("whatsapp", { numberChoice: k })} badge={badge("numberChoice", k)}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink-soft)", display: "block" }}>{q(`options.${k}.label`)}</span>
                <span style={{ fontSize: 12, color: "var(--mute)", display: "block", marginTop: 4, lineHeight: 1.5 }}>{q(`options.${k}.help`)}</span>
              </OptionCard>
            ))}
          </div>
          <div>
            <Label>{q("appLabel")}</Label>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              {WA_APP_TYPE.map((k) => (
                <Chip key={k} selected={whatsapp.appType === k} onClick={() => onSetupChange("whatsapp", { appType: k })} label={q(`app.${k}`)} />
              ))}
            </div>
          </div>
        </div>
      );

    case "whatsappConnect":
      if (!account || !detail || !onSaveAccount || !accountId) return <p style={help}>{q("noAccount")}</p>;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ ...help, margin: 0 }}>{q("help")}</p>
          <MessagingCard account={account} d={detail} onSave={onSaveAccount} fieldCols={1} />
          <InboundWhatsAppCard accountId={accountId} account={account as unknown as Record<string, unknown>} onSave={onSaveAccount} />
        </div>
      );

    default:
      return null;
  }
}
