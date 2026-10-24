// BlockPanel: create or edit a manual busy block, as a right-hand panel
// (UI_STANDARDS 3.7). DesktopCalendar mounts it in the right slot, or in a
// MobileSheet on phones. Opened from the toolbar "Add busy block" button
// (create) and by clicking a block in the week grid (edit).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { RightPanel } from "@/components/crm/primitives";
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
  /** "inline" when the page already wraps it in a MobileSheet on phones. */
  mobile?: "fullscreen" | "inline";
  className?: string;
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

const FORM_ID = "calendar-block-form";

export function BlockPanel({ initialDate, block, onClose, onSave, onDelete, mobile, className }: Props) {
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
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.05em" };

  return (
    <RightPanel
      title={block ? t("blocks.editTitle") : t("blocks.addTitle")}
      onClose={onClose}
      formId={FORM_ID}
      submitLabel={saving ? t("blocks.saving") : t("blocks.save")}
      submitting={saving}
      footerExtra={onDelete && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting || saving}
          className="la-btn la-btn--soft h-9 px-4 text-sm gap-1.5 text-destructive disabled:opacity-50"
        >
          {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("blocks.delete")}
        </button>
      )}
      mobile={mobile}
      className={className}
      data-testid="calendar-block-panel"
    >
      <form id={FORM_ID} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Date */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={labelStyle}>{t("blocks.date")}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required style={inputStyle} />
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
              <label style={labelStyle}>{t("blocks.startTime")}</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required={!allDay} style={inputStyle} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={labelStyle}>{t("blocks.endTime")}</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required={!allDay} style={inputStyle} />
            </div>
          </div>
        )}

        {/* Label */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={labelStyle}>
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
      </form>
    </RightPanel>
  );
}
