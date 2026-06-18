import { useTranslation } from "react-i18next";
import { Shield, Mail, Clock, FileText, Check, X } from "lucide-react";
import { Panel, PanelAction, GroupLabel, FieldRow, EditButton } from "./atoms";
import { useAccountEdit } from "./useAccountEdit";
import { useWorkspace } from "@/hooks/useWorkspace";
import { formatTimeDisplay } from "../accountDetailWidgets/accountFormatters";
import type { AccountRow } from "./types";

const STATUS_OPTIONS = ["Active", "Trial", "Inactive", "Suspended"];
const TYPE_OPTIONS = ["Agency", "Client"];
const TIMEZONE_OPTIONS = ["America/Sao_Paulo", "Europe/Amsterdam"];
const LANGUAGE_OPTIONS = ["English", "Portuguese", "Dutch"];

const inputStyle: React.CSSProperties = { fontSize: 13, padding: "9px 12px", width: "100%" };

function EditInput({ value, onChange, type = "text", placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <input className="neu-input" style={inputStyle} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}
function EditSelectField({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select className="neu-input" style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
function EditArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea className="neu-input" style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5, fontFamily: "var(--sans)" }} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function AccountDetailsPanel({ account, onSave, cols = 2 }: {
  account: AccountRow;
  onSave: (field: string, value: string) => Promise<void>;
  cols?: 1 | 2;
}) {
  const { t } = useTranslation("accounts");
  const { isEditing, saving, startEdit, cancelEdit, set, val, save } = useAccountEdit(account, onSave);
  const { isOwner } = useWorkspace();

  const ColA = (
    <div>
      <GroupLabel icon={<Shield size={13} />}>{t("detail.overview")}</GroupLabel>
      <FieldRow label={t("fields.status")} value={val("status")} dropdown editChild={isEditing ? <EditSelectField value={val("status")} onChange={(v) => set("status", v)} options={STATUS_OPTIONS} /> : undefined} />
      {isOwner && <FieldRow label={t("fields.type")} value={val("type")} dropdown editChild={isEditing ? <EditSelectField value={val("type")} onChange={(v) => set("type", v)} options={TYPE_OPTIONS} /> : undefined} />}
      <FieldRow label={t("columns.niche", { defaultValue: t("fields.businessNiche") })} value={val("business_niche")} editChild={isEditing ? <EditInput value={val("business_niche")} onChange={(v) => set("business_niche", v)} placeholder={t("fields.businessNichePlaceholder")} /> : undefined} />

      <div style={{ height: 10 }} />
      <GroupLabel icon={<Mail size={13} />}>{t("sections.contact")}</GroupLabel>
      <FieldRow label={t("fields.email")} value={val("owner_email")} editChild={isEditing ? <EditInput value={val("owner_email")} onChange={(v) => set("owner_email", v)} type="email" placeholder={t("fields.ownerEmailPlaceholder")} /> : undefined} />
      <FieldRow label={t("fields.phone")} value={val("phone")} mono editChild={isEditing ? <EditInput value={val("phone")} onChange={(v) => set("phone", v)} type="tel" placeholder={t("fields.phonePlaceholder")} /> : undefined} />
      <FieldRow label={t("fields.website")} value={val("website")} mono editChild={isEditing ? <EditInput value={val("website")} onChange={(v) => set("website", v)} type="url" placeholder={t("fields.websitePlaceholder")} /> : undefined} />
      <FieldRow label={t("fields.address")} value={val("address")} editChild={isEditing ? <EditInput value={val("address")} onChange={(v) => set("address", v)} placeholder="Street, City, Country" /> : undefined} />
    </div>
  );

  const ColB = (
    <div>
      <GroupLabel icon={<Clock size={13} />}>{t("sections.schedule")}</GroupLabel>
      <FieldRow label={t("fields.timezone")} value={val("timezone")} dropdown editChild={isEditing ? <EditSelectField value={val("timezone")} onChange={(v) => set("timezone", v)} options={TIMEZONE_OPTIONS} /> : undefined} />
      <FieldRow label={t("fields.language")} value={val("language")} dropdown editChild={isEditing ? <EditSelectField value={val("language")} onChange={(v) => set("language", v)} options={LANGUAGE_OPTIONS} /> : undefined} />
      {isEditing ? (
        <>
          <FieldRow label={t("fields.hoursOpen")} editChild={<EditInput value={val("business_hours_start")} onChange={(v) => set("business_hours_start", v)} type="time" />} />
          <FieldRow label={t("fields.hoursClose")} editChild={<EditInput value={val("business_hours_end")} onChange={(v) => set("business_hours_end", v)} type="time" />} />
        </>
      ) : (
        <FieldRow label={t("fields.hoursOpen")} value={`${formatTimeDisplay(val("business_hours_start")) || "—"} – ${formatTimeDisplay(val("business_hours_end")) || "—"}`} mono />
      )}
      <FieldRow label={t("fields.dailySends")} value={val("max_daily_sends")} mono editChild={isEditing ? <EditInput value={val("max_daily_sends")} onChange={(v) => set("max_daily_sends", v)} type="number" placeholder="0" /> : undefined} />
      <FieldRow label={t("fields.optOutKeyword")} value={val("opt_out_keyword")} mono editChild={isEditing ? <EditInput value={val("opt_out_keyword")} onChange={(v) => set("opt_out_keyword", v)} placeholder="e.g. STOP" /> : undefined} />

      <div style={{ height: 10 }} />
      <GroupLabel icon={<FileText size={13} />}>{t("sections.notes")}</GroupLabel>
      <FieldRow label={t("fields.taxId")} value={val("tax_id")} mono muted editChild={isEditing ? <EditInput value={val("tax_id")} onChange={(v) => set("tax_id", v)} placeholder="Tax identifier" /> : undefined} />
      <div style={{ padding: "7px 0" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 7 }}>{t("fields.description")}</div>
        {isEditing ? (
          <EditArea value={val("business_description")} onChange={(v) => set("business_description", v)} placeholder="Business description…" rows={3} />
        ) : (
          <div className="neu-inset-crisp" style={{ padding: "11px 13px", borderRadius: "var(--r-button)", fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-soft)" }}>
            {val("business_description") || <span style={{ color: "var(--mute-2)", fontStyle: "italic" }}>—</span>}
          </div>
        )}
      </div>
    </div>
  );

  const action = isEditing ? (
    <div className="row" style={{ gap: 8 }}>
      <PanelAction onClick={cancelEdit} disabled={saving} icon={<X size={12} />}>{t("detail.cancel")}</PanelAction>
      <PanelAction wine onClick={save} disabled={saving} icon={<Check size={12} />}>{saving ? t("detail.saving") : t("detail.save")}</PanelAction>
    </div>
  ) : (
    <EditButton label={t("detail.edit")} onClick={startEdit} />
  );

  return (
    <Panel eyebrow="01" title={t("panels.accountDetails")} action={action}>
      {cols === 2
        ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>{ColA}{ColB}</div>
        : <div>{ColA}<div style={{ height: 10 }} />{ColB}</div>}
    </Panel>
  );
}
