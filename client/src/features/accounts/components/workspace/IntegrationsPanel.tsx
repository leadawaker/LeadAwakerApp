import { VoiceSettingsSection } from "./VoiceSettingsSection";
import { MissedCallCard } from "./MissedCallCard";
import { MeetingTypeCard } from "./MeetingTypeCard";
import type { AccountRow, AccountDetail } from "./types";
import { CalendarConnectCard, BookingPageCard, BookingLinkReadOnly, CustomBookingDomainCard } from "./CalendarConnectCard";
import { MessagingCard, EmailSenderCard } from "./MessagingCards";

const cardStyle: React.CSSProperties = { borderRadius: "var(--r-card)", padding: "22px 24px", background: "var(--bone)" };

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
      {/* ── Messaging & email ─────────────────────────────────────── */}
      {!readOnly && (
        <MessagingCard account={account} d={d} onSave={onSave} fieldCols={fieldCols} />
      )}

      {/* ── Meetings & calendar ───────────────────────────────────── */}
      {!readOnly && (
        <div className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--bone)" }}>
          <MeetingTypeCard
            accountId={accountId}
            meetingType={account.meeting_type}
            callingNumber={account.calling_number}
          />
        </div>
      )}

      {/* Email sender — HIDDEN (2026-07-13): email fallback is OFF while the DIY
          SMTP path is not deliverability-safe. Card kept for easy re-enable when
          email returns via proper infra. See
          specs/channel-fallback/email-fallback-assessment-2026-07-13.md. */}
      {false && !readOnly && <EmailSenderCard accountId={accountId} />}

      {/* Calendar + Booking side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
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

      {/* Custom booking domain — optional, folded; visible to clients too. */}
      <div className="neu-raised" style={cardStyle}>
        <CustomBookingDomainCard accountId={accountId} noBorder />
      </div>

      {/* ── Voice ─────────────────────────────────────────────────── */}
      {withVoice && !readOnly && (
        <div style={{ padding: "0 0 20px" }}>
          <VoiceSettingsSection account={account} voices={d.voices} onSave={onSave} stacked={stacked} />
        </div>
      )}

      {/* ── Not yet available: Missed-Call Text-Back (folded, at bottom) ── */}
      {!readOnly && <MissedCallCard accountId={accountId} />}
    </div>
  );
}
