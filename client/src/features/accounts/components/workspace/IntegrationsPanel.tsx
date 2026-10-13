import { useTranslation } from "react-i18next";
import { MeetingTypeCard } from "./MeetingTypeCard";
import type { AccountRow, AccountDetail } from "./types";
import { CalendarConnectCard, BookingPageCard, BookingLinkReadOnly, CustomBookingDomainCard } from "./CalendarConnectCard";
import { WebsiteChatCard, InboundWhatsAppCard } from "./WebsiteChatCard";
import { WhatsAppCloudCard } from "./whatsapp/WhatsAppCloudCard";
import { WhatsAppTemplatesCard } from "./whatsapp/WhatsAppTemplatesCard";
import { WhatsAppBehaviourCard } from "./whatsapp/WhatsAppBehaviourCard";
import { PhoneConnection } from "./PhoneConnection";
import { VoiceSettingsSection } from "./VoiceSettingsSection";
import { ConnectionsOverview, groupAnchorId, type ConnectionGroup } from "./ConnectionsOverview";

const cardStyle: React.CSSProperties = { borderRadius: "var(--r-card)", padding: "22px 24px", background: "var(--bone)" };


/** One channel family: a numbered heading, one line on what it is for, its cards. */
function Group({ index, group, children }: { index: number; group: ConnectionGroup; children: React.ReactNode }) {
  const { t } = useTranslation("accounts");
  return (
    <section id={groupAnchorId(group)} style={{ display: "flex", flexDirection: "column", gap: 14, scrollMarginTop: 96 }} data-testid={`integrations-${group}`}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", padding: "0 4px 10px", borderBottom: "1px solid var(--line)" }}>
        <span className="eyebrow eyebrow-sm" style={{ color: "var(--mute-2)" }}>{String(index).padStart(2, "0")}</span>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>{t(`integrationGroups.${group}.title`)}</h3>
        <span style={{ fontSize: 12.5, color: "var(--mute)" }}>{t(`integrationGroups.${group}.help`)}</span>
      </header>
      {children}
    </section>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────
// What is connected, in four families: the phone number, WhatsApp, the chat on
// the client's website, and where appointments land. A strip on top shows the
// state of all four. How the assistant behaves on a call is the Phone line
// tab. A client login (readOnly) sees bookings only.
export function IntegrationsPanel({ account, d, onSave, stacked = false, readOnly = false }: {
  account: AccountRow;
  d: AccountDetail;
  onSave: (field: string, value: string) => Promise<void>;
  fieldCols?: number;
  stacked?: boolean;
  readOnly?: boolean;
}) {
  const accountId = account.Id ?? account.id ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
      {!readOnly && <ConnectionsOverview accountId={accountId} stacked={stacked} />}

      {!readOnly && (
        <Group index={1} group="phone">
          <PhoneConnection accountId={accountId} />
        </Group>
      )}

      {!readOnly && (
        <Group index={2} group="messaging">
          {/* WhatsApp on the client's own number (specs/receptionist-channels) */}
          <WhatsAppCloudCard accountId={accountId} />
          <WhatsAppBehaviourCard accountId={accountId} />
          <WhatsAppTemplatesCard accountId={accountId} />
          {/* The voice of the voice notes she sends on WhatsApp. */}
          <div className="neu-raised" style={cardStyle}>
            <VoiceSettingsSection account={account} voices={d.voices} onSave={onSave} stacked={stacked} card />
          </div>
          <InboundWhatsAppCard
            accountId={accountId}
            account={account as unknown as Record<string, unknown>}
            onSave={onSave}
          />
        </Group>
      )}

      {!readOnly && (
        <Group index={3} group="website">
          {/* specs/website-widget */}
          <WebsiteChatCard accountId={accountId} />
        </Group>
      )}

      <Group index={readOnly ? 1 : 4} group="bookings">
        <div style={{ display: "grid", gridTemplateColumns: stacked ? "1fr" : "1fr 1fr", gap: 18 }}>
          <div className="neu-raised" style={cardStyle}>
            <CalendarConnectCard accountId={accountId} noBorder clientMode={readOnly} />
          </div>
          <div className="neu-raised" style={cardStyle}>
            {readOnly ? (
              <BookingLinkReadOnly accountId={accountId} noBorder />
            ) : (
              <BookingPageCard accountId={accountId} noBorder />
            )}
          </div>
        </div>
        {!readOnly && (
          <div className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--bone)" }}>
            <MeetingTypeCard
              accountId={accountId}
              meetingType={account.meeting_type}
              callingNumber={account.calling_number}
            />
          </div>
        )}
        {/* Optional and folded; visible to clients too. */}
        <div className="neu-raised" style={cardStyle}>
          <CustomBookingDomainCard accountId={accountId} noBorder />
        </div>
      </Group>
    </div>
  );
}
