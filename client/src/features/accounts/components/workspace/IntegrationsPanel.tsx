import { VoiceSettingsSection } from "./VoiceSettingsSection";
import { MissedCallCard } from "./MissedCallCard";
import { MeetingTypeCard } from "./MeetingTypeCard";
import type { AccountRow, AccountDetail } from "./types";
import { CalendarConnectCard, BookingPageCard, BookingLinkReadOnly, CustomBookingDomainCard } from "./CalendarConnectCard";
import { MessagingCard, EmailSenderCard } from "./MessagingCards";

// ── Main panel ─────────────────────────────────────────────────────────────────
export function IntegrationsPanel({ account, d, onSave, fieldCols = 3, stacked = false, withVoice = true, readOnly = false }: {
  account: AccountRow;
  d: AccountDetail;
  onSave: (field: string, value: string) => Promise<void>;
  fieldCols?: number;
  stacked?: boolean;
  withVoice?: boolean;
  readOnly?: boolean;
}) {
  const accountId = account.Id ?? account.id ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {!readOnly && (
        <MessagingCard account={account} d={d} onSave={onSave} fieldCols={fieldCols} />
      )}

      {!readOnly && <EmailSenderCard accountId={accountId} />}

      {!readOnly && <MissedCallCard accountId={accountId} />}

      {!readOnly && (
        <div className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--bone)" }}>
          <MeetingTypeCard
            accountId={accountId}
            meetingType={account.meeting_type}
            callingNumber={account.calling_number}
          />
        </div>
      )}

      {/* Calendar + Booking side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="neu-raised" style={{ borderRadius: "var(--r-card)", padding: "22px 24px", background: "var(--bone)" }}>
          <CalendarConnectCard accountId={accountId} noBorder clientMode={readOnly} />
        </div>
        <div className="neu-raised" style={{ borderRadius: "var(--r-card)", padding: "22px 24px", background: "var(--bone)" }}>
          {readOnly ? (
            <BookingLinkReadOnly accountId={accountId} noBorder />
          ) : (
            <BookingPageCard accountId={accountId} noBorder />
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="neu-raised" style={{ borderRadius: "var(--r-card)", padding: "22px 24px", background: "var(--bone)" }}>
          <CustomBookingDomainCard accountId={accountId} noBorder />
        </div>
      )}

      {withVoice && !readOnly && (
        <div style={{ padding: "0 0 20px" }}>
          <VoiceSettingsSection account={account} voices={d.voices} onSave={onSave} stacked={stacked} />
        </div>
      )}
    </div>
  );
}
