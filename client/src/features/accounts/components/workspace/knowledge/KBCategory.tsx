import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { kbIcon } from "./kbIcons";
import { ScopeChip, InjectChip } from "./kbChips";
import type { KBEntryData, KBCampaign } from "../types";

function KBEntry({ e, campaigns, onEdit, onDelete }: {
  e: KBEntryData; campaigns: KBCampaign[]; onEdit: () => void; onDelete: () => void;
}) {
  const { t } = useTranslation("accounts");
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: "relative", padding: "11px 14px 13px 22px", borderLeft: "2px solid var(--line)" }}>
      <div className="row" style={{ gap: 8, marginBottom: 5, flexWrap: "wrap", paddingRight: 56 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{e.title}</span>
        <ScopeChip scope={e.scope} campaigns={campaigns} allLabel={t("knowledge.campaigns.all")} hiddenLabel={t("knowledge.campaigns.hidden")} />
        <InjectChip value={e.inject} />
      </div>
      <div style={{ fontSize: 12.5, color: "var(--mute)", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{e.content}</div>
      <div className="row" style={{ gap: 5, position: "absolute", top: 8, right: 10, opacity: hover ? 1 : 0, transition: "opacity 130ms", pointerEvents: hover ? "auto" : "none" }}>
        <button className="la-btn la-btn--inset la-btn--icon" style={{ width: 26, height: 26 }} onClick={onEdit}><Pencil size={12} /></button>
        <button className="la-btn la-btn--inset la-btn--icon" style={{ width: 26, height: 26, color: "var(--wine)" }} onClick={onDelete}><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

export function KBCategory({ category, entries, campaigns, onEdit, onDelete }: {
  category: string;
  entries: KBEntryData[];
  campaigns: KBCampaign[];
  onEdit: (e: KBEntryData) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation("accounts");
  const [open, setOpen] = useState(true);
  const Ic = kbIcon(category);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="row" style={{ width: "100%", gap: 11, padding: "10px 14px", borderRadius: "var(--r-surface)", cursor: "pointer", border: "none", background: "var(--bg-2)", boxShadow: "var(--sh-raised-crisp)", textAlign: "left" }}>
        <span style={{ display: "flex", color: "var(--wine)" }}><Ic size={16} /></span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t(`knowledge.categories.${category}`)}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute)" }}>{entries.length}</span>
        <span style={{ display: "flex", color: "var(--mute-2)", transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 160ms" }}><ChevronDown size={13} /></span>
      </button>
      {open && (
        <div style={{ padding: "4px 0 8px 8px" }}>
          {entries.map((e) => <KBEntry key={e.id} e={e} campaigns={campaigns} onEdit={() => onEdit(e)} onDelete={() => onDelete(e.id)} />)}
        </div>
      )}
    </div>
  );
}
