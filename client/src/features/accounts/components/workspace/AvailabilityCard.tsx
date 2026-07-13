import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, Loader2, Check } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { IntegSection, SectionHead, IconTile } from "./integrationsAtoms";

interface Props {
  accountId: number;
}

// GET /api/accounts/:id returns snake_case keys (server/dbKeys.ts's toDbKeys
// converts JS camelCase -> DB snake_case for the wire format — confirmed
// against how AccountDetailsPanel.tsx reads val("business_hours_start") from
// the same endpoint). Do NOT expect camelCase here.
interface AccountAvailability {
  open_days?: number[] | null;
  business_hours_start?: string | null;
  business_hours_end?: string | null;
  default_call_duration_minutes?: number | null;
  min_booking_notice_hours?: number | null;
}

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon...Sun, matches how clients think about their week

export function AvailabilityCard({ accountId }: Props) {
  const { t } = useTranslation("accounts");
  const [loaded, setLoaded] = useState(false);
  const [openDays, setOpenDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [duration, setDuration] = useState("30");
  const [notice, setNotice] = useState("16");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/accounts/${accountId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AccountAvailability | null) => {
        if (cancelled || !data) return;
        if (data.open_days?.length) setOpenDays(data.open_days);
        if (data.business_hours_start) setStart(data.business_hours_start);
        if (data.business_hours_end) setEnd(data.business_hours_end);
        if (data.default_call_duration_minutes != null) setDuration(String(data.default_call_duration_minutes));
        if (data.min_booking_notice_hours != null) setNotice(String(data.min_booking_notice_hours));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  async function persist(body: Record<string, unknown>) {
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

  // Mirrors MeetingTypeCard's savedNumber pattern: track the last-persisted
  // value per field so onBlur only fires a PATCH when something actually changed.
  const [savedStart, setSavedStart] = useState("09:00");
  const [savedEnd, setSavedEnd] = useState("17:00");
  const [savedDuration, setSavedDuration] = useState("30");
  const [savedNotice, setSavedNotice] = useState("16");

  useEffect(() => {
    if (!loaded) return;
    setSavedStart(start);
    setSavedEnd(end);
    setSavedDuration(duration);
    setSavedNotice(notice);
    // Only re-sync "saved" baselines the moment the fetched values land, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  function toggleDay(day: number) {
    const next = openDays.includes(day) ? openDays.filter((d) => d !== day) : [...openDays, day];
    setOpenDays(next);
    void persist({ open_days: next });
  }

  function onBlurStart() {
    if (start === savedStart) return;
    setSavedStart(start);
    void persist({ business_hours_start: start || null });
  }

  function onBlurEnd() {
    if (end === savedEnd) return;
    setSavedEnd(end);
    void persist({ business_hours_end: end || null });
  }

  function onBlurDuration() {
    const n = parseInt(duration, 10);
    const clamped = isNaN(n) ? 30 : Math.min(240, Math.max(5, n));
    setDuration(String(clamped));
    if (String(clamped) === savedDuration) return;
    setSavedDuration(String(clamped));
    void persist({ default_call_duration_minutes: clamped });
  }

  function onBlurNotice() {
    const n = parseInt(notice, 10);
    const clamped = isNaN(n) ? 16 : Math.min(168, Math.max(0, n));
    setNotice(String(clamped));
    if (String(clamped) === savedNotice) return;
    setSavedNotice(String(clamped));
    void persist({ min_booking_notice_hours: clamped });
  }

  return (
    <IntegSection>
      <SectionHead>
        <IconTile><CalendarClock size={14} /></IconTile>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>
          {t("availability.title")}
        </span>
        {saving ? (
          <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute-2)" }} />
        ) : justSaved ? (
          <Check size={14} style={{ color: "var(--good)" }} />
        ) : null}
      </SectionHead>

      {/* Open days */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 6 }}>
          {t("availability.openDays")}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DAY_ORDER.map((day) => {
            const selected = openDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                disabled={saving}
                onClick={() => toggleDay(day)}
                className="la-btn la-btn--soft"
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  ...(selected
                    ? { background: "var(--wine)", color: "var(--wine-fg, #fff)", boxShadow: "none" }
                    : {}),
                }}
              >
                {t(`availability.days.${day}`)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Opening / closing time */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 6 }}>
            {t("availability.openingTime")}
          </div>
          <input
            className="neu-input"
            style={{ fontSize: 13, padding: "8px 11px", width: "100%" }}
            type="time"
            value={start}
            disabled={saving}
            onChange={(e) => setStart(e.target.value)}
            onBlur={onBlurStart}
          />
        </div>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 6 }}>
            {t("availability.closingTime")}
          </div>
          <input
            className="neu-input"
            style={{ fontSize: 13, padding: "8px 11px", width: "100%" }}
            type="time"
            value={end}
            disabled={saving}
            onChange={(e) => setEnd(e.target.value)}
            onBlur={onBlurEnd}
          />
        </div>
      </div>

      {/* Call duration */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 6 }}>
          {t("availability.callDuration")}
        </div>
        <input
          className="neu-input"
          style={{ fontSize: 13, padding: "8px 11px", width: "100%" }}
          type="number"
          min={5}
          max={240}
          value={duration}
          disabled={saving}
          onChange={(e) => setDuration(e.target.value)}
          onBlur={onBlurDuration}
        />
      </div>

      {/* Minimum booking notice */}
      <div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 6 }}>
          {t("availability.minBookingNotice")}
        </div>
        <input
          className="neu-input"
          style={{ fontSize: 13, padding: "8px 11px", width: "100%" }}
          type="number"
          min={0}
          max={168}
          value={notice}
          disabled={saving}
          onChange={(e) => setNotice(e.target.value)}
          onBlur={onBlurNotice}
        />
        <div style={{ fontSize: 11.5, color: "var(--mute)", marginTop: 5, lineHeight: 1.5 }}>
          {t("availability.minBookingNoticeHint")}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--wine)" }}>{error}</div>
      )}
    </IntegSection>
  );
}
