import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, X } from "lucide-react";
import { MobileListHeader } from "@/components/crm/mobile/MobileListHeader";
import { MobileSheet, MobileRecede } from "@/components/crm/mobile/MobileSheet";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { getPromptId } from "../types";
import { resolveVariablesHtml, type CampaignForPreview, type LeadForPreview } from "../utils/resolveVariables";

interface Props {
  prompts: any[];
  q: string;
  onQChange: (v: string) => void;
  onSaved: (saved: any) => void;
  campaigns?: CampaignForPreview[];
}

function statusColor(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "active") return "var(--good)";
  if (s === "archived") return "var(--mute)";
  return "var(--mute-2)";
}

function fmtDate(p: any) {
  const raw = p.updatedAt || p.updated_at;
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * MobilePromptsView — full-width mobile Prompt Library: a list of prompt rows
 * and a bottom-sheet editor with an Edit/Preview tab editing the main prompt text.
 */
export function MobilePromptsView({ prompts, q, onQChange, onSaved, campaigns = [] }: Props) {
  const { t, i18n } = useTranslation("prompts");
  const { toast } = useToast();

  const [selected, setSelected] = useState<any | null>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [sampleLead, setSampleLead] = useState<LeadForPreview | null>(null);

  useEffect(() => {
    if (selected) {
      setDraft(selected.promptText || selected.prompt_text || "");
      setTab("edit");
    }
  }, [selected]);

  // Campaign linked to the selected prompt (system prompts have none → chips only)
  const selectedCampaign = useMemo(() => {
    if (!selected) return null;
    const cId = Number(selected.campaignsId || selected.Campaigns_id || 0);
    return cId ? campaigns.find((c) => c.id === cId) ?? null : null;
  }, [selected, campaigns]);

  // Fetch a sample lead so variables resolve to real values (mirrors desktop preview)
  useEffect(() => {
    const cId = selectedCampaign?.id;
    if (tab !== "preview" || !cId) { setSampleLead(null); return; }
    apiFetch(`/api/leads?campaignId=${cId}&limit=1`)
      .then((r) => r.json())
      .then((data: any[]) => {
        const lead = Array.isArray(data) ? data[0] : null;
        setSampleLead(lead ? {
          firstName: lead.firstName ?? lead.first_name ?? null,
          lastName: lead.lastName ?? lead.last_name ?? null,
          phone: lead.phone ?? null,
          email: lead.email ?? null,
          whatHasTheLeadDone: lead.whatHasTheLeadDone ?? lead.what_has_the_lead_done ?? null,
        } : null);
      })
      .catch(() => setSampleLead(null));
  }, [tab, selectedCampaign]);

  const previewHtml = useMemo(
    () => resolveVariablesHtml(draft, selectedCampaign, sampleLead, null, i18n.language),
    [draft, selectedCampaign, sampleLead, i18n.language],
  );

  const handleSave = async () => {
    if (!selected || saving) return;
    const id = getPromptId(selected);
    setSaving(true);
    try {
      const res = await apiFetch(`/api/prompts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptText: draft }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      onSaved(updated);
      toast({ title: t("toast.saved", "Prompt saved") });
      setSelected(null);
    } catch (e: any) {
      toast({ title: t("toast.saveFailed", "Failed to save"), description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <MobileRecede open={selected !== null}>
        <div className="relative h-full min-h-0 flex flex-col overflow-hidden" style={{ background: "var(--bg)" }} data-testid="mobile-prompts-view">
          <MobileListHeader
            title={t("page.title", "Prompts")}
            searchValue={q}
            onSearchChange={onQChange}
            searchPlaceholder={t("toolbar.searchPlaceholder", "Search prompts...")}
          />

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 14px calc(24px + var(--safe-bottom))", display: "flex", flexDirection: "column", gap: 8 }}>
            {prompts.length === 0 ? (
              <div style={{ padding: "60px 20px", textAlign: "center", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)" }}>
                {t("emptyState.noPrompts", "No prompts found")}
              </div>
            ) : (
              prompts.map((p) => (
                <button
                  key={getPromptId(p)}
                  onClick={() => setSelected(p)}
                  className="neu-raised row"
                  style={{ gap: 12, padding: "12px 14px", borderRadius: "var(--r-card)", border: "none", background: "var(--card)", width: "100%", textAlign: "left", cursor: "pointer" }}
                  data-testid={`mobile-prompt-row-${getPromptId(p)}`}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: statusColor(p.status) }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name || `#${getPromptId(p)}`}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute-2)" }}>
                      {(p.status || "").toUpperCase()}{fmtDate(p) ? ` · ${fmtDate(p)}` : ""}
                    </div>
                  </div>
                  <span style={{ color: "var(--mute-2)", display: "flex" }}><ChevronRight size={15} /></span>
                </button>
              ))
            )}
          </div>
        </div>
      </MobileRecede>

      {/* Editor sheet */}
      <MobileSheet open={selected !== null} onClose={() => setSelected(null)} data-testid="mobile-prompt-sheet">
        {selected && (
          <>
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "2px 16px 12px", borderBottom: "1px solid var(--line)" }}>
              <span className="serif" style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.name || `#${getPromptId(selected)}`}</span>
              <button
                onClick={() => setSelected(null)}
                aria-label={t("common.close", "Close")}
                style={{ width: 36, height: 36, flexShrink: 0, borderRadius: "var(--r-pill)", border: "none", cursor: "pointer", background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", color: "var(--mute)", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: "12px 16px 0" }}>
              <div className="la-seg la-seg--fill">
                {(["edit", "preview"] as const).map((k) => (
                  <button key={k} onClick={() => setTab(k)} className={`la-seg-btn${tab === k ? " on" : ""}`} style={{ padding: "9px 0", fontSize: 11, letterSpacing: "0.13em" }} data-testid={`mobile-prompt-tab-${k}`}>
                    {k === "edit" ? t("tabs.edit", "Edit") : t("tabs.preview", "Preview")}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, padding: "12px 16px", display: "flex", flexDirection: "column" }}>
              {tab === "edit" ? (
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  data-testid="mobile-prompt-textarea"
                  style={{
                    flex: 1, minHeight: 0, width: "100%", resize: "none",
                    border: "1px solid var(--line)", borderRadius: "var(--r-surface)",
                    background: "var(--surface)", color: "var(--ink)",
                    padding: 12, fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.6, outline: "none",
                  }}
                />
              ) : (
                <div
                  data-testid="mobile-prompt-preview"
                  style={{
                    flex: 1, minHeight: 0, overflowY: "auto", whiteSpace: "pre-wrap",
                    border: "1px solid var(--line)", borderRadius: "var(--r-surface)",
                    background: "#FFFFFF", color: "#1a1a1a",
                    padding: 12, fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.6,
                  }}
                >
                  {draft
                    ? <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    : <span style={{ color: "var(--mute-2)" }}>{t("preview.empty", "Nothing to preview")}</span>}
                </div>
              )}
            </div>

            <div style={{ flexShrink: 0, padding: "10px 16px calc(14px + var(--safe-bottom))", borderTop: "1px solid var(--line)" }}>
              <button
                onClick={handleSave}
                disabled={saving}
                className="la-btn la-btn--wine"
                style={{ width: "100%", justifyContent: "center", opacity: saving ? 0.6 : 1 }}
                data-testid="mobile-prompt-save"
              >
                {saving ? t("form.saving", "Saving...") : t("form.save", "Save")}
              </button>
            </div>
          </>
        )}
      </MobileSheet>
    </>
  );
}
