import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X, Phone, MessageCircle, Video } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { IntegSection, SectionHead, IconTile } from "./integrationsAtoms";
import { PanelAction, EditButton } from "./atoms";

type MeetingType = "phone_call" | "whatsapp_call";

interface Props {
  accountId: number;
  meetingType?: string | null;
  callingNumber?: string | null;
}

const MEETING_OPTIONS: {
  key: MeetingType | "google_meet" | "zoom";
  icon: React.ReactNode;
  disabled?: boolean;
}[] = [
  { key: "phone_call",    icon: <Phone size={14} /> },
  { key: "whatsapp_call", icon: <MessageCircle size={14} /> },
  { key: "google_meet",   icon: <Video size={14} />, disabled: true },
  { key: "zoom",          icon: <Video size={14} />, disabled: true },
];

export function MeetingTypeCard({ accountId, meetingType: initialType, callingNumber: initialNumber }: Props) {
  const { t } = useTranslation("accounts");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [meetingType, setMeetingType] = useState<string>(initialType || "phone_call");
  const [callingNumber, setCallingNumber] = useState(initialNumber || "");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string | null> = { meeting_type: meetingType };
      if (meetingType === "phone_call") {
        body.calling_number = callingNumber || null;
      } else {
        body.calling_number = null;
      }
      const res = await apiFetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setIsEditing(false);
    } catch (err: any) {
      setError(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setMeetingType(initialType || "phone_call");
    setCallingNumber(initialNumber || "");
    setError(null);
    setIsEditing(false);
  }

  const currentOption = MEETING_OPTIONS.find((o) => o.key === meetingType);

  return (
    <IntegSection>
      <SectionHead>
        <IconTile>{currentOption?.icon ?? <Phone size={14} />}</IconTile>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>
          {t("meetingType.title")}
        </span>
        {isEditing ? (
          <div className="row" style={{ gap: 6 }}>
            <PanelAction onClick={cancel} disabled={saving} icon={<X size={12} />}>{t("detail.cancel")}</PanelAction>
            <PanelAction wine onClick={save} disabled={saving} icon={<Check size={12} />}>
              {saving ? t("detail.saving") : t("detail.save")}
            </PanelAction>
          </div>
        ) : (
          <EditButton label={t("detail.edit")} onClick={() => setIsEditing(true)} />
        )}
      </SectionHead>

      {/* Option cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
        {MEETING_OPTIONS.map(({ key, icon, disabled }) => {
          const selected = meetingType === key;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled || !isEditing}
              onClick={() => { if (!disabled && isEditing) setMeetingType(key); }}
              style={{
                display: "flex", alignItems: "center", gap: 9, padding: "10px 13px",
                borderRadius: "var(--r-button)", border: "none", cursor: disabled ? "not-allowed" : isEditing ? "pointer" : "default",
                background: selected ? "var(--wine-tint)" : "var(--bg)",
                boxShadow: selected ? "none" : "var(--sh-inset-crisp)",
                outline: selected ? "1px solid var(--wine)" : "none",
                opacity: disabled ? 0.45 : 1,
                transition: "background 120ms",
              }}
            >
              <span style={{ color: selected ? "var(--wine)" : "var(--ink-soft)" }}>{icon}</span>
              <span style={{ fontSize: 13, fontWeight: selected ? 600 : 400, color: selected ? "var(--wine)" : "var(--ink-soft)", flex: 1, textAlign: "left" }}>
                {t(`meetingType.options.${key}`)}
              </span>
              {disabled && (
                <span style={{ fontFamily: "var(--mono)", fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute-2)", background: "var(--bg)", padding: "2px 6px", borderRadius: "var(--r-pill)", boxShadow: "var(--sh-inset-crisp)" }}>
                  {t("pills.comingSoon")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Calling number field — shown only for phone_call */}
      {meetingType === "phone_call" && (
        <div style={{ marginTop: 13 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 6 }}>
            {t("meetingType.callingNumber")}
          </div>
          {isEditing ? (
            <input
              className="neu-input"
              style={{ fontSize: 13, padding: "8px 11px", width: "100%" }}
              type="tel"
              value={callingNumber}
              onChange={(e) => setCallingNumber(e.target.value)}
              placeholder={t("meetingType.callingNumberPlaceholder")}
            />
          ) : (
            <div style={{ fontSize: 13, color: callingNumber ? "var(--ink-soft)" : "var(--mute-2)", fontStyle: callingNumber ? "normal" : "italic" }}>
              {callingNumber || t("meetingType.callingNumberEmpty")}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: "var(--mute)", marginTop: 5, lineHeight: 1.5 }}>
            {t("meetingType.callingNumberHint")}
          </div>
        </div>
      )}

      {/* WhatsApp call hint */}
      {meetingType === "whatsapp_call" && (
        <div style={{ marginTop: 13, fontSize: 12, color: "var(--mute)", lineHeight: 1.5 }}>
          {t("meetingType.whatsappHint")}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--wine)" }}>{error}</div>
      )}
    </IntegSection>
  );
}
