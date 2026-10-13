// Visits: an in-person appointment (viewing, test drive, consultation) the
// phone receptionist can book besides the call (specs/phone-booking-v2).
//
// Every save sends all four visit fields in ONE PATCH: the server re-provisions
// the Cal.diy visit event type on any of them (10 to 20 seconds, in the
// background), and two saves close together can race. So there is never more
// than one request in flight; an edit made while one is running is sent once,
// with the latest values, when it finishes.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Loader2, Check } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { Switch } from "@/components/ui/switch";
import { IntegSection, SectionHead, IconTile } from "./integrationsAtoms";

const LENGTHS = [30, 45, 60, 90, 120];
const DEFAULT_LENGTH = 60;

interface Props {
  accountId: number;
}

interface Draft {
  enabled: boolean;
  title: string;
  minutes: number;
  address: string;
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
  color: "var(--mute-2)", marginBottom: 6,
};

function toBody(d: Draft) {
  return {
    visits_enabled: d.enabled,
    visit_title: d.title.trim() || null,
    visit_duration_minutes: d.minutes,
    visit_address: d.address.trim() || null,
  };
}

export function VisitsCard({ accountId }: Props) {
  const { t } = useTranslation("accounts");
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(DEFAULT_LENGTH);
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savedKey = useRef("");                  // body of the last accepted save
  const inFlight = useRef(false);
  const queued = useRef<Draft | null>(null);    // newest edit made during a save
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);

  // The panel mounts this card with key={accountId}, so state and refs are
  // per account. A save that lands after the card is gone touches nothing.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(savedTimer.current);
    };
  }, []);

  // Always read the account fresh: the account object the panel holds can be
  // older than the last save, and saving defaults over real values would hurt.
  // Every control stays disabled until this has loaded.
  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/accounts/${accountId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (!data) { setLoadFailed(true); return; }
        const draft: Draft = {
          enabled: Boolean(data.visits_enabled),
          title: data.visit_title ?? "",
          minutes: LENGTHS.includes(data.visit_duration_minutes) ? data.visit_duration_minutes : DEFAULT_LENGTH,
          address: data.visit_address ?? "",
        };
        setEnabled(draft.enabled);
        setTitle(draft.title);
        setMinutes(draft.minutes);
        setAddress(draft.address);
        savedKey.current = JSON.stringify(toBody(draft));
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [accountId]);

  async function save(draft: Draft) {
    // Queue first: an edit made during a save may equal the last accepted
    // values, and the request already running would then be the last word.
    // The re-save after it lands compares against what the server really has.
    if (inFlight.current) {
      queued.current = draft;
      return;
    }
    const body = toBody(draft);
    const key = JSON.stringify(body);
    if (key === savedKey.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: key,
      });
      if (!res.ok) throw new Error(await res.text());
      savedKey.current = key;
      if (mounted.current) {
        setJustSaved(true);
        clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setJustSaved(false), 1500);
      }
    } catch (err: any) {
      if (mounted.current) setError(err?.message || t("visits.saveFailed"));
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setSaving(false);
        const next = queued.current;
        queued.current = null;
        if (next) void save(next);
      }
    }
  }

  const current: Draft = { enabled, title, minutes, address };

  return (
    <IntegSection>
      <SectionHead>
        <IconTile><MapPin size={14} /></IconTile>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>
          {t("visits.title")}
        </span>
        {saving ? (
          <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute-2)" }} />
        ) : justSaved ? (
          <Check size={14} style={{ color: "var(--good)" }} />
        ) : null}
      </SectionHead>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Switch
          id={`visits-enabled-${accountId}`}
          checked={enabled}
          disabled={!loaded}
          onCheckedChange={(on) => { setEnabled(on); void save({ ...current, enabled: on }); }}
        />
        <label htmlFor={`visits-enabled-${accountId}`} style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          {t("visits.enable")}
        </label>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--mute)", marginTop: 8, lineHeight: 1.5 }}>
        {t("visits.hint")}
      </div>
      {loadFailed && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--wine)" }}>{t("visits.loadFailed")}</div>
      )}

      {enabled && (
        <>
          <div style={{ marginTop: 14 }}>
            <div style={labelStyle}>{t("visits.name")}</div>
            <input
              className="neu-input"
              style={{ fontSize: 13, padding: "8px 11px", width: "100%" }}
              value={title}
              disabled={!loaded}
              placeholder={t("visits.namePlaceholder")}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => void save(current)}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={labelStyle}>{t("visits.length")}</div>
            <select
              className="neu-input"
              style={{ fontSize: 13, padding: "9px 11px", width: "100%" }}
              value={minutes}
              disabled={!loaded}
              onChange={(e) => { const v = Number(e.target.value); setMinutes(v); void save({ ...current, minutes: v }); }}
            >
              {LENGTHS.map((m) => (
                <option key={m} value={m}>{t("visits.minutes", { count: m })}</option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={labelStyle}>{t("visits.address")}</div>
            <input
              className="neu-input"
              style={{ fontSize: 13, padding: "8px 11px", width: "100%" }}
              value={address}
              disabled={!loaded}
              placeholder={t("visits.addressPlaceholder")}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={() => void save(current)}
            />
            {!address.trim() && (
              <div style={{ fontSize: 11.5, color: "var(--wine)", marginTop: 5, lineHeight: 1.5 }}>
                {t("visits.addressNeeded")}
              </div>
            )}
          </div>
        </>
      )}

      {error && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--wine)" }}>{error}</div>
      )}
    </IntegSection>
  );
}
