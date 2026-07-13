import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Phone, MessageCircle, Video, Loader2, Check } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { IntegSection, SectionHead, IconTile } from "./integrationsAtoms";

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
  const [meetingType, setMeetingType] = useState<string>(initialType || "phone_call");
  const [callingNumber, setCallingNumber] = useState(initialNumber || "");
  const [savedNumber, setSavedNumber] = useState(initialNumber || "");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persist(body: Record<string, string | null>) {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch (err: any) {
      setError(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function onSelectType(value: string) {
    setMeetingType(value);
    void persist({ meeting_type: value });
  }

  function onBlurNumber() {
    const trimmed = callingNumber.trim();
    if (trimmed === savedNumber) return;
    setSavedNumber(trimmed);
    void persist({ calling_number: trimmed || null });
  }

  const currentOption = MEETING_OPTIONS.find((o) => o.key === meetingType);

  return (
    <IntegSection>
      <SectionHead>
        <IconTile>{currentOption?.icon ?? <Phone size={14} />}</IconTile>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>
          {t("meetingType.title")}
        </span>
        {saving ? (
          <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute-2)" }} />
        ) : justSaved ? (
          <Check size={14} style={{ color: "var(--good)" }} />
        ) : null}
      </SectionHead>

      {/* Meeting type dropdown */}
      <select
        className="neu-input"
        style={{ fontSize: 13, padding: "9px 11px", width: "100%" }}
        value={meetingType}
        disabled={saving}
        onChange={(e) => onSelectType(e.target.value)}
      >
        {MEETING_OPTIONS.map(({ key, disabled }) => (
          <option key={key} value={key} disabled={disabled}>
            {t(`meetingType.options.${key}`)}{disabled ? ` — ${t("pills.comingSoon")}` : ""}
          </option>
        ))}
      </select>

      {/* Calling number — always visible; feeds the post-booking vCard.
          Editable for whatsapp_call too, since the chat number and the
          advisor who actually calls are often different people/numbers. */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 6 }}>
          {t("meetingType.callingNumber")}
        </div>
        <input
          className="neu-input"
          style={{ fontSize: 13, padding: "8px 11px", width: "100%" }}
          type="tel"
          value={callingNumber}
          disabled={saving}
          onChange={(e) => setCallingNumber(e.target.value)}
          onBlur={onBlurNumber}
          placeholder={t("meetingType.callingNumberPlaceholder")}
        />
        <div style={{ fontSize: 11.5, color: "var(--mute)", marginTop: 5, lineHeight: 1.5 }}>
          {meetingType === "whatsapp_call" ? t("meetingType.callingNumberHintWhatsapp") : t("meetingType.callingNumberHint")}
        </div>
      </div>

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
