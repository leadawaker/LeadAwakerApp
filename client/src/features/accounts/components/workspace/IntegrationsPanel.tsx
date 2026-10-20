import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RequestChangeNote } from "@/components/crm/RequestChangeNote";
import { MeetingTypeCard } from "./MeetingTypeCard";
import { VisitsCard } from "./VisitsCard";
import type { AccountRow, AccountDetail } from "./types";
import { CalendarConnectCard, BookingPageCard, BookingLinkReadOnly, CustomBookingDomainCard } from "./CalendarConnectCard";
import { WebsiteChatCard, InboundWhatsAppCard } from "./WebsiteChatCard";
import { WhatsAppCloudCard } from "./whatsapp/WhatsAppCloudCard";
import { WhatsAppTemplatesCard } from "./whatsapp/WhatsAppTemplatesCard";
import { WhatsAppBehaviourCard } from "./whatsapp/WhatsAppBehaviourCard";
import { PhoneConnection } from "./PhoneConnection";
import { VoiceSettingsSection } from "./VoiceSettingsSection";
import { ConnectionsOverview, groupAnchorId, type ConnectionGroup } from "./ConnectionsOverview";
import { InstagramConnectCard, useSocialStatus } from "@/features/social/components/InstagramConnectCard";
import { integrationGroupsFor } from "@/features/social/lib/socialState";

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
// What is connected, in five families: the phone number, WhatsApp, the chat on
// the client's website, where appointments land, and Instagram. A menu of the four (with
// each one's state) opens one family at a time: a column on the left on
// desktop, a 2-column grid on top on a phone. How the assistant behaves on a call is
// the Phone line tab. A client login (readOnly) sees bookings, plus Social once the
// agency switched it on for the account (the client logs in to Instagram itself), no menu.
export function IntegrationsPanel({ account, d, onSave, stacked = false, readOnly = false, initialGroup }: {
  account: AccountRow;
  d: AccountDetail;
  onSave: (field: string, value: string) => Promise<void>;
  fieldCols?: number;
  stacked?: boolean;
  readOnly?: boolean;
  /** Opened first (agency): the Social group after the Instagram connect flow returns. */
  initialGroup?: ConnectionGroup;
}) {
  const { t: tc } = useTranslation("crm");
  const accountId = account.Id ?? account.id ?? 0;
  const [open, setOpen] = useState<ConnectionGroup>(() => (!readOnly && initialGroup) || (readOnly ? "bookings" : "phone"));
  const { data: social } = useSocialStatus(accountId);
  const clientGroups = integrationGroupsFor({ isAgency: false, socialEnabled: social?.enabled === true });
  const isShown = (g: ConnectionGroup) => (readOnly ? clientGroups.includes(g) : open === g);

  const groups = (
    <div style={{ display: "flex", flexDirection: "column", gap: 34, minWidth: 0 }}>
      {readOnly && <RequestChangeNote area={tc("requestChange.areas.integrations")} />}
      {isShown("phone") && (
        <Group index={1} group="phone">
          <PhoneConnection accountId={accountId} />
        </Group>
      )}

      {isShown("messaging") && (
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

      {isShown("website") && (
        <Group index={3} group="website">
          {/* specs/website-widget */}
          <WebsiteChatCard accountId={accountId} />
        </Group>
      )}

      {isShown("bookings") && (
      <Group index={readOnly ? 1 : 4} group="bookings">
        {/* Calendar first, the booking page second: one under the other, in that order. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
        {/* In-person visits besides the call (specs/phone-booking-v2). */}
        {!readOnly && (
          <div className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--bone)" }}>
            <VisitsCard key={accountId} accountId={accountId} />
          </div>
        )}
        {/* Optional and folded; visible to clients too. */}
        <div className="neu-raised" style={cardStyle}>
          <CustomBookingDomainCard accountId={accountId} noBorder website={account.website ? String(account.website) : null} />
        </div>
      </Group>
      )}

      {isShown("social") && (
        <Group index={readOnly ? 2 : 5} group="social">
          <InstagramConnectCard accountId={accountId} />
        </Group>
      )}
    </div>
  );

  if (readOnly) return groups;
  if (stacked) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <ConnectionsOverview accountId={accountId} active={open} onSelect={setOpen} layout="grid" />
        {groups}
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
      <div style={{ position: "sticky", top: "calc(var(--ws-sticky-top, 0px) + 16px)" }}>
        <ConnectionsOverview accountId={accountId} active={open} onSelect={setOpen} layout="rail" />
      </div>
      {groups}
    </div>
  );
}
