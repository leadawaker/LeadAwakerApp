import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { Panel, PanelAction } from "../atoms";
import { useKnowledgeBase, type KBFormPayload } from "./useKnowledgeBase";
import { KBCategory } from "./KBCategory";
import { KBForm } from "./KBForm";
import type { KBEntryData } from "../types";

export function KBPanel({ accountId, collapsible = false, defaultCollapsed = false, titleOverride, inset = false, insetCrisp = false }: {
  accountId: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  titleOverride?: string;
  inset?: boolean;
  insetCrisp?: boolean;
}) {
  const { t } = useTranslation("accounts");
  const { entries, campaigns, loading, populated, empty, addEntry, updateEntry, deleteEntry } = useKnowledgeBase(accountId);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<KBEntryData | null>(null);
  const [preCategory, setPreCategory] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(!defaultCollapsed);

  const openAdd = (category?: string) => { setEditing(null); setPreCategory(category); setAdding(true); };
  const openEdit = (e: KBEntryData) => { setAdding(false); setEditing(e); };
  const closeForm = () => { setAdding(false); setEditing(null); setPreCategory(undefined); };

  const handleSubmit = async (p: KBFormPayload) => {
    setSaving(true);
    const ok = editing ? await updateEntry(editing.id, p) : await addEntry(p);
    setSaving(false);
    if (ok) closeForm();
  };

  const formOpen = adding || !!editing;
  const initial: Partial<KBFormPayload> | undefined = editing
    ? { category: editing.category, title: editing.title, content: editing.content, scope: editing.scope, inject: editing.inject }
    : preCategory ? { category: preCategory } : undefined;

  const toggleBtn = collapsible ? (
    <button
      onClick={() => setBodyOpen((v) => !v)}
      style={{ background: "transparent", boxShadow: "none", border: "none", cursor: "pointer", color: "var(--mute-2)", display: "flex", padding: 4 }}
    >
      {bodyOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
    </button>
  ) : undefined;

  const addBtn = (!formOpen && bodyOpen) ? (
    <PanelAction wine icon={<Plus size={12} />} onClick={() => openAdd()}>{t("knowledge.add")}</PanelAction>
  ) : undefined;

  return (
    <Panel
      icon={<BookOpen size={16} />}
      title={titleOverride ?? t("panels.knowledgeBase")}
      count={bodyOpen ? t("knowledge.countEntries", { count: entries.length }) : undefined}
      inset={inset}
      insetCrisp={insetCrisp}
      onTitleClick={collapsible ? () => setBodyOpen((v) => !v) : undefined}
      action={
        <div className="row" style={{ gap: 6 }}>
          {addBtn}
          {toggleBtn}
        </div>
      }
      style={bodyOpen ? { height: "100%" } : undefined}
    >
      {bodyOpen && (
        <>
          {formOpen && (
            <KBForm campaigns={campaigns} initial={initial} saving={saving} onSubmit={handleSubmit} onClose={closeForm} />
          )}

          {loading ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: "var(--mute)", fontSize: 13 }}>{t("knowledge.loading")}</div>
          ) : entries.length === 0 && !formOpen ? (
            <div className="neu-inset" style={{ borderRadius: "var(--r-card)", padding: "30px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8 }}>
              <div style={{ width: 44, height: 44, borderRadius: "var(--r-surface)", background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mute-2)", marginBottom: 4 }}><BookOpen size={20} /></div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-soft)" }}>{t("knowledge.emptyTitle")}</div>
              <div style={{ fontSize: 12, color: "var(--mute)", maxWidth: 280, lineHeight: 1.5 }}>{t("knowledge.emptyDescription")}</div>
              <button className="la-btn la-btn--wine" style={{ marginTop: 8 }} onClick={() => openAdd()}><Plus size={12} />{t("knowledge.add")}</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {populated.map((g) => (
                <KBCategory key={g.category} category={g.category} entries={g.entries} campaigns={campaigns} onEdit={openEdit} onDelete={deleteEntry} />
              ))}
            </div>
          )}

          {!loading && empty.length > 0 && (
            <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--mute-2)", marginRight: 2 }}>{t("panels.actions.addCategory")}</span>
              {empty.map((cat) => (
                <button key={cat} className="row" onClick={() => openAdd(cat)} style={{ gap: 6, padding: "5px 11px", borderRadius: "var(--r-pill)", border: "1px dashed var(--line-strong)", background: "transparent", cursor: "pointer", color: "var(--mute)", fontSize: 12, fontWeight: 500 }}>
                  <Plus size={11} />{t(`knowledge.categories.${cat}`)}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
