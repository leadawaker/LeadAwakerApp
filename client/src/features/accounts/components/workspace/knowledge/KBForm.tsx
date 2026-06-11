import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check } from "lucide-react";
import { KB_CATEGORIES, type KBFormPayload } from "./useKnowledgeBase";
import { kbIcon } from "./kbIcons";
import type { KBScope, KBInject, KBCampaign } from "../types";

const INJECT_OPTIONS: KBInject[] = ["always", 1, 2, 3, 4, 5];

function ScopePicker({ scope, onChange, campaigns }: { scope: KBScope; onChange: (s: KBScope) => void; campaigns: KBCampaign[] }) {
  const { t } = useTranslation("accounts");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const selectedIds = Array.isArray(scope) ? scope : [];
  const label = scope === "all" ? t("knowledge.campaigns.all")
    : scope === "hidden" || (Array.isArray(scope) && scope.length === 0) ? t("knowledge.campaigns.hidden")
    : t("scope.nSelected", { count: selectedIds.length });

  const toggleCampaign = (id: number) => {
    const current = Array.isArray(scope) && scope.length > 0 ? scope : [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onChange(next.length > 0 ? next : "hidden");
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="row" style={{ gap: 7, padding: "6px 11px", borderRadius: "var(--r-pill)", border: "none", cursor: "pointer", background: "var(--wine-tint)", boxShadow: "inset 0 0 0 1px rgba(94,34,48,0.14)", color: "var(--wine)", fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em" }}>
        {label}<span style={{ display: "flex" }}><ChevronDown size={11} /></span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 30, width: 260, background: "var(--card)", borderRadius: "var(--r-card)", boxShadow: "var(--sh-raised-tall)", padding: 8, maxHeight: 300, overflowY: "auto" }}>
          {([["all", t("knowledge.campaigns.allCampaigns")], ["hidden", t("knowledge.campaigns.hiddenFromAll")]] as const).map(([k, lbl]) => {
            const active = scope === k || (k === "hidden" && Array.isArray(scope) && scope.length === 0);
            return (
              <button key={k} type="button" onClick={() => onChange(k)} className="row" style={{ width: "100%", gap: 10, padding: "9px 10px", border: "none", background: "transparent", cursor: "pointer", borderRadius: "var(--r-button)", textAlign: "left" }}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, boxShadow: active ? "none" : "var(--sh-inset-crisp)", background: active ? "var(--wine)" : "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>{active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--paper)" }} />}</span>
                <span style={{ fontSize: 13, color: "var(--ink)" }}>{lbl}</span>
              </button>
            );
          })}
          {campaigns.length > 0 && <div className="rule" style={{ margin: "6px 8px" }} />}
          {campaigns.map((c) => {
            const checked = selectedIds.includes(c.id);
            return (
              <button key={c.id} type="button" onClick={() => toggleCampaign(c.id)} className="row" style={{ width: "100%", gap: 10, padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", borderRadius: "var(--r-button)", textAlign: "left" }}>
                <span style={{ width: 16, height: 16, borderRadius: 5, flexShrink: 0, boxShadow: checked ? "none" : "var(--sh-inset-crisp)", background: checked ? "var(--wine)" : "var(--bg)", color: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center" }}>{checked && <Check size={11} />}</span>
                <span style={{ fontSize: 13, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function KBForm({ campaigns, initial, saving, onSubmit, onClose }: {
  campaigns: KBCampaign[];
  initial?: Partial<KBFormPayload>;
  saving?: boolean;
  onSubmit: (p: KBFormPayload) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("accounts");
  const [category, setCategory] = useState(initial?.category ?? "faq");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [scope, setScope] = useState<KBScope>(initial?.scope ?? "all");
  const [inject, setInject] = useState<KBInject>(initial?.inject ?? "always");
  const Ic = kbIcon(category);

  const canSave = !!title.trim() && !!content.trim() && !saving;
  const submit = () => { if (canSave) onSubmit({ category, title: title.trim(), content: content.trim(), scope, inject }); };

  return (
    <div className="neu-inset" style={{ borderRadius: "var(--r-card)", padding: 18, marginBottom: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 8, padding: "8px 12px", borderRadius: "var(--r-button)", background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", minWidth: 150, position: "relative" }}>
          <span style={{ display: "flex", color: "var(--wine)" }}><Ic size={15} /></span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--ink)", border: "none", background: "transparent", outline: "none", cursor: "pointer", appearance: "none" }}>
            {KB_CATEGORIES.map((c) => <option key={c} value={c}>{t(`knowledge.categories.${c}`)}</option>)}
          </select>
          <span style={{ display: "flex", color: "var(--mute-2)" }}><ChevronDown size={12} /></span>
        </div>
        <input className="neu-input" placeholder={t("knowledge.titlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1, minWidth: 180, background: "var(--card)", boxShadow: "var(--sh-raised-crisp)" }} />
      </div>
      <textarea className="neu-input" placeholder={t("knowledge.contentPlaceholder")} rows={3} value={content} onChange={(e) => setContent(e.target.value)} style={{ resize: "vertical", lineHeight: 1.5, background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", fontFamily: "var(--sans)" }} />
      <div className="row" style={{ gap: 14 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute)", width: 78, flexShrink: 0 }}>{t("knowledge.campaigns.label")}</span>
        <ScopePicker scope={scope} onChange={setScope} campaigns={campaigns} />
      </div>
      <div className="row" style={{ gap: 14, alignItems: "center" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute)", width: 78, flexShrink: 0 }}>{t("knowledge.injectAfter")}</span>
        <div className="la-seg" style={{ flexWrap: "wrap" }}>
          {INJECT_OPTIONS.map((o) => (
            <button key={String(o)} type="button" onClick={() => setInject(o)} className={`la-seg-btn${inject === o ? " on" : ""}`} style={{ padding: "7px 12px" }}>
              {o === "always" ? t("voice.always", { defaultValue: "always" }) : `${o}msg`}
            </button>
          ))}
        </div>
      </div>
      <div className="row" style={{ gap: 10, justifyContent: "flex-end", marginTop: 2 }}>
        <button className="la-btn la-btn--soft la-btn--lg" onClick={onClose}>{t("knowledge.cancel")}</button>
        <button className="la-btn la-btn--wine la-btn--lg" onClick={submit} disabled={!canSave}><Check size={14} />{saving ? t("knowledge.saving") : t("knowledge.save")}</button>
      </div>
    </div>
  );
}
