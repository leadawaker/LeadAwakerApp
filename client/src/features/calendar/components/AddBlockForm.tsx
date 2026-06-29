import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Loader2 } from "lucide-react";
import type { CalendarBlock } from "../hooks/useCalendarBlocks";

interface Props {
  accountId: number;
  initialDate?: string; // YYYY-MM-DD
  block?: CalendarBlock; // if editing
  onClose: () => void;
  onSave: (data: {
    date: string;
    startTime?: string;
    endTime?: string;
    allDay: boolean;
    label?: string;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

function todayStr() {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

function isoToDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA").format(new Date(iso));
}

function isoToTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function AddBlockForm({ initialDate, block, onClose, onSave, onDelete }: Props) {
  const { t } = useTranslation("calendar");

  const [date, setDate] = useState(block ? isoToDate(block.startsAt) : (initialDate ?? todayStr()));
  const [allDay, setAllDay] = useState(block ? block.allDay : false);
  const [startTime, setStartTime] = useState(block && !block.allDay ? isoToTime(block.startsAt) : "09:00");
  const [endTime, setEndTime] = useState(block && !block.allDay ? isoToTime(block.endsAt) : "17:00");
  const [label, setLabel] = useState(block?.label ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ date, startTime: allDay ? undefined : startTime, endTime: allDay ? undefined : endTime, allDay, label: label || undefined });
      onClose();
    } catch (err: any) {
      setError(err.message || t("blocks.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (err: any) {
      setError(err.message || t("blocks.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 10px",
    borderRadius: "var(--r-button)",
    border: "1px solid var(--line)",
    background: "var(--bg)",
    color: "var(--ink)",
    fontSize: 13,
    outline: "none",
  };

  const btnPrimary: React.CSSProperties = {
    flex: 1,
    height: 34,
    borderRadius: "var(--r-button)",
    border: "none",
    background: "var(--primary)",
    color: "var(--paper)",
    fontSize: 13,
    fontWeight: 600,
    cursor: saving ? "not-allowed" : "pointer",
    opacity: saving ? 0.7 : 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
          {block ? t("blocks.editTitle") : t("blocks.addTitle")}
        </span>
        <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mute)", padding: 2 }}>
          <X size={16} />
        </button>
      </div>

      {/* Date */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {t("blocks.date")}
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          style={inputStyle}
        />
      </div>

      {/* All-day toggle */}
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} style={{ accentColor: "var(--primary)", width: 14, height: 14 }} />
        <span style={{ fontSize: 13, color: "var(--ink)" }}>{t("blocks.allDay")}</span>
      </label>

      {/* Time range */}
      {!allDay && (
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t("blocks.startTime")}
            </label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required={!allDay} style={inputStyle} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t("blocks.endTime")}
            </label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required={!allDay} style={inputStyle} />
          </div>
        </div>
      )}

      {/* Label */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {t("blocks.label")} <span style={{ fontWeight: 400, textTransform: "none" }}>({t("blocks.optional")})</span>
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("blocks.labelPlaceholder")}
          maxLength={120}
          style={inputStyle}
        />
      </div>

      {error && (
        <div style={{ fontSize: 12, color: "var(--destructive, #c0392b)", padding: "6px 10px", background: "rgba(192,57,43,0.07)", borderRadius: "var(--r-button)" }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              height: 34,
              borderRadius: "var(--r-button)",
              border: "1px solid rgba(192,57,43,0.35)",
              background: "rgba(192,57,43,0.06)",
              color: "var(--destructive, #c0392b)",
              fontSize: 13,
              fontWeight: 600,
              cursor: deleting ? "not-allowed" : "pointer",
              padding: "0 14px",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {deleting ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : null}
            {t("blocks.delete")}
          </button>
        )}
        <button type="submit" disabled={saving} style={btnPrimary}>
          {saving && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
          {saving ? t("blocks.saving") : t("blocks.save")}
        </button>
      </div>
    </form>
  );
}
