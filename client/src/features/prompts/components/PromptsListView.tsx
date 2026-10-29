// Prompt Library split view: area tabs (promptCategories) in the topbar, the
// prompt list on the left (380px) and the selected prompt's editor on the
// right, with its preview beside it by default (Ctrl+P toggles it).
// Parts live in ./promptList/.
import { useState, useEffect, useRef, useMemo } from "react";
import { ListPanelFooter, ListPanelUnfoldButton } from "@/components/crm/ListPanelToggleButton";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { useListPanelState } from "@/hooks/useListPanelState";
import { useListPanelFold } from "@/hooks/useListPanelFold";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLastTab } from "@/hooks/useLastTab";
import { usePersistedState } from "@/hooks/usePersistedState";
import { usePersistedSelection } from "@/hooks/usePersistedSelection";
import { useFKeyScrollToSelected } from "@/hooks/useFKeyScrollToSelected";
import { useInlineEditing } from "@/features/prospects/components/useInlineEditing";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { PageTopbar, ExpandingSearch } from "@/components/crm/primitives";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { type CampaignForPreview } from "../utils/resolveVariables";
import { getPromptId, MODEL_OPTIONS, isCampaignPrompt } from "../types";
import {
  CATEGORY_COLOR, PROMPT_CATEGORIES, isDemoPrompt, isPromptCategory, promptCategory,
  type PromptCategory, type PromptListTab,
} from "../promptCategories";
import { PromptEditorPanel, type PromptEditorPanelHandle } from "./PromptEditorPanel";
import { NicheVocabularyPanel } from "./NicheVocabularyPanel";
import { PromptListCard, CompactPromptRail, PromptGroupHeader } from "./promptList/PromptListCard";
import { PromptListControls, type PromptListControlsProps } from "./promptList/PromptListControls";
import { PromptFontPopover, PromptSaveVersionPopover, PromptVersionHistory } from "./promptList/PromptVersionControls";
import { PromptDetailHeader } from "./promptList/PromptDetailHeader";
import { PromptCategoryTabs, PromptListStrip } from "./promptList/PromptCategoryTabs";
import { usePromptVersions } from "./promptList/usePromptVersions";

const LIST_TABS: readonly PromptListTab[] = [...PROMPT_CATEGORIES, "niche"];

interface PromptsListViewProps extends PromptListControlsProps {
  prompts: any[];
  groupedRows: Map<string, any[]> | null;
  q: string;
  onQChange: (v: string) => void;
  onSaved: (saved: any) => void;
  onDelete: (prompt: any) => void;
  /** Opens the create panel; the new prompt starts in this area. */
  onOpenCreate: (category: PromptCategory) => void;
  campaignMap: Map<number, string>;
  campaigns: CampaignForPreview[];
}

function TabEmptyState({ tab, searching }: { tab: PromptCategory; searching: boolean }) {
  const { t } = useTranslation("prompts");
  if (searching) return <DataEmptyState variant="search" />;
  return (
    <div className="text-center" style={{ maxWidth: 260 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
        {t("empty.category", { area: t(`category.${tab}`) })}
      </p>
      <p style={{ fontSize: 12, color: "var(--mute)", marginTop: 4 }}>
        {t(tab === "social" ? "empty.socialHint" : "empty.categoryHint")}
      </p>
    </div>
  );
}

export function PromptsListView(props: PromptsListViewProps) {
  const { prompts, groupedRows, q, onQChange, onSaved, onDelete, onOpenCreate, campaignMap, campaigns } = props;
  const { t } = useTranslation("prompts");
  const { toast } = useToast();
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const { state: listPanelState } = useListPanelState();

  // Area tab, reopening on the one used last.
  const [listTab, setListTab] = useLastTab<PromptListTab>("prompts", LIST_TABS, "chat");
  // List fold button (lg+, where the list panel sits beside the editor; not on Niche).
  const belowLg = useIsMobile(1024);
  useListPanelFold(!belowLg && listTab !== "niche");
  const [showDemo, setShowDemo] = usePersistedState<boolean>("prompts-show-demo", true, (v) => typeof v === "boolean");

  const [showSystemMessage, setShowSystemMessage] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showEditorSidebar, setShowEditorSidebar] = useState(true);
  const [previewOpen, setPreviewOpen] = usePersistedState<boolean>("prompts-preview-open", true, (v) => typeof v === "boolean");
  const [editorFontSize, setEditorFontSize] = usePersistedState<number>(
    "prompts-editor-font-size", 14, (v) => typeof v === "number" && v >= 11 && v <= 18,
  );
  const [previewFont, setPreviewFont] = usePersistedState<string>("prompts-preview-font-v2", "var(--mono)", (v) => typeof v === "string");
  const [tokenEstimate, setTokenEstimate] = useState(0);
  const [saveVersionOpen, setSaveVersionOpen] = useState(false);
  const editPanelRef = useRef<PromptEditorPanelHandle>(null);

  const accountMap = useMemo(() => new Map(props.availableAccounts.map((a) => [a.id, a.name])), [props.availableAccounts]);

  // Campaigns that talk with each prompt: its own campaign plus every campaign
  // that borrows it via prompt_campaign_id and has no active prompt of its own
  // (same fall-through as the engine's get_prompt_for_campaign).
  const servedCampaignNames = useMemo(() => {
    const ownActive = new Set<number>();
    for (const p of prompts) {
      if (isCampaignPrompt(p) && String(p.status || "").toLowerCase().trim() === "active") {
        ownActive.add(Number(p.campaignsId || p.Campaigns_id));
      }
    }
    const byPromptCampaign = new Map<number, string[]>();
    for (const c of campaigns) {
      const target = Number(c.promptCampaignId) || 0;
      if (!target || target === c.id || ownActive.has(c.id)) continue;
      const list = byPromptCampaign.get(target) ?? [];
      list.push(c.name);
      byPromptCampaign.set(target, list);
    }
    return (p: any): string | undefined => {
      const cId = Number(p.campaignsId || p.Campaigns_id) || 0;
      const own = cId ? campaignMap.get(cId) : undefined;
      if (!own) return undefined;
      if (!isCampaignPrompt(p)) return own;
      return [own, ...(byPromptCampaign.get(cId) ?? [])].join(" · ");
    };
  }, [prompts, campaigns, campaignMap]);

  function getCardNames(p: any): { campaignName?: string; accountName?: string } {
    const cId = Number(p.campaignsId || p.Campaigns_id) || 0;
    const campaign = cId ? campaigns.find((c) => c.id === cId) : undefined;
    const aId = campaign?.accountsId;
    return { campaignName: servedCampaignNames(p), accountName: aId ? accountMap.get(aId) : undefined };
  }

  /* ── Tab + demo filtering ─────────────────────────────────────────────── */
  const inTab = useMemo(() => {
    const tab = listTab;
    return (p: any) => tab !== "niche" && promptCategory(p) === tab && (showDemo || !isDemoPrompt(p));
  }, [listTab, showDemo]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of prompts) {
      if (!showDemo && isDemoPrompt(p)) continue;
      const c = promptCategory(p);
      counts[c] = (counts[c] ?? 0) + 1;
    }
    return counts;
  }, [prompts, showDemo]);

  const tabFilteredPrompts = useMemo(() => prompts.filter(inTab), [prompts, inTab]);
  const tabDemoCount = useMemo(
    () => (listTab === "niche" ? 0 : prompts.filter((p) => promptCategory(p) === listTab && isDemoPrompt(p)).length),
    [prompts, listTab],
  );

  const listItems = useMemo(() => {
    type Row = { kind: "header"; label: string; count: number } | { kind: "prompt"; prompt: any };
    if (!groupedRows) return tabFilteredPrompts.map((p): Row => ({ kind: "prompt", prompt: p }));
    const rows: Row[] = [];
    groupedRows.forEach((items, label) => {
      const group = items.filter(inTab);
      if (group.length === 0) return;
      rows.push({ kind: "header", label, count: group.length });
      group.forEach((p) => rows.push({ kind: "prompt", prompt: p }));
    });
    return rows;
  }, [groupedRows, tabFilteredPrompts, inTab]);

  /* ── Selection ────────────────────────────────────────────────────────── */
  const [selectedPrompt, setSelectedPrompt] = usePersistedSelection("prompts-selected-id", (p: any) => getPromptId(p), prompts);

  // Keep the selection inside the open tab: its first prompt when the selected one is elsewhere.
  useEffect(() => {
    if (listTab === "niche" || tabFilteredPrompts.length === 0) return;
    const id = selectedPrompt ? getPromptId(selectedPrompt) : null;
    if (id == null || !tabFilteredPrompts.some((p) => getPromptId(p) === id)) setSelectedPrompt(tabFilteredPrompts[0]);
  }, [listTab, tabFilteredPrompts, selectedPrompt, setSelectedPrompt]);

  const visiblePrompt = selectedPrompt && inTab(selectedPrompt) ? selectedPrompt : null;
  const selectedId = visiblePrompt ? getPromptId(visiblePrompt) : null;
  const versions = usePromptVersions(selectedId, visiblePrompt, setSelectedPrompt);

  async function patchPrompt(fields: Record<string, unknown>) {
    if (!selectedId) return null;
    try {
      const res = await apiFetch(`/api/prompts/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved = await res.json();
      setSelectedPrompt(saved);
      onSaved(saved);
      return saved;
    } catch {
      toast({ title: t("toast.saveFailed"), variant: "destructive" });
      return null;
    }
  }

  async function handleAreaPatch(fields: { category?: PromptCategory; isDemo?: boolean }) {
    const saved = await patchPrompt(fields);
    // Follow the prompt to its new tab, and keep a newly tagged demo in view.
    if (saved && fields.category && isPromptCategory(fields.category)) setListTab(fields.category);
    if (saved && fields.isDemo && !showDemo) setShowDemo(true);
  }

  const { editableField: editablePromptName } = useInlineEditing(async (_field, value) => {
    if (value.trim()) await patchPrompt({ name: value.trim() });
  });

  // Keyboard shortcuts: Ctrl+P preview, Ctrl+S save, Ctrl+Shift+S save version
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !visiblePrompt) return;
      const key = e.key.toLowerCase();
      if (key === "p") { e.preventDefault(); setPreviewOpen((p) => !p); }
      if (key === "s" && !e.shiftKey) { e.preventDefault(); editPanelRef.current?.save(); }
      if (key === "s" && e.shiftKey) { e.preventDefault(); setSaveVersionOpen(true); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visiblePrompt, setPreviewOpen]);

  // Smooth scroll to the selected card (below its group header).
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedId == null || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const raf = requestAnimationFrame(() => {
      const el = container.querySelector(`[data-prompt-id="${selectedId}"]`) as HTMLElement | null;
      if (!el) return;
      let headerHeight = 0;
      let sibling = el.previousElementSibling;
      while (sibling) {
        if (sibling.getAttribute("data-group-header") === "true") { headerHeight = (sibling as HTMLElement).offsetHeight; break; }
        sibling = sibling.previousElementSibling;
      }
      const cardTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({ top: cardTop - headerHeight - 3, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedId]);

  useFKeyScrollToSelected({
    containerRef: scrollContainerRef,
    selectedId: selectedId ?? null,
    getSelector: (id) => `[data-prompt-id="${id}"]`,
  });

  const selCampaignId = visiblePrompt ? Number(visiblePrompt.campaignsId || visiblePrompt.Campaigns_id) || 0 : 0;
  const selCampaign = selCampaignId ? campaigns.find((c) => c.id === selCampaignId) : null;
  const detailAccent = visiblePrompt ? CATEGORY_COLOR[promptCategory(visiblePrompt)] : "var(--wine)";
  const createCategory: PromptCategory = listTab === "niche" ? "chat" : listTab;
  const divider = <div style={{ width: 1, height: 22, background: "var(--line)", margin: "0 2px" }} />;

  return (
    <div className="flex flex-col h-full" data-testid="prompts-list-view">
      <PageTopbar
        title={t("page.title")}
        shrinkLeft
        left={<PromptCategoryTabs value={listTab} onChange={setListTab} counts={tabCounts} />}
        right={listTab === "niche" ? null : (
          <div className="hidden lg:flex items-center gap-1.5">
            {visiblePrompt && (MODEL_OPTIONS.includes(visiblePrompt.model) ? (
              <select
                className="text-[12px] font-mono outline-none cursor-pointer shrink-0 neu-inset-crisp"
                style={{ background: "var(--bg)", color: "var(--mute)", borderRadius: "var(--r-pill)", padding: "0 14px", height: 38, border: "none" }}
                value={visiblePrompt.model}
                onChange={(e) => editPanelRef.current?.setField("model", e.target.value)}
                aria-label={t("labels.model")}
              >
                {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <span
                className="text-[12px] font-mono shrink-0 neu-inset-crisp"
                style={{ background: "var(--bg)", color: "var(--mute-2)", borderRadius: "var(--r-pill)", padding: "0 14px", height: 38, lineHeight: "38px" }}
              >
                {t("toolbar.hardcodedModel")}
              </span>
            ))}
            {visiblePrompt && (<>
              <PromptFontPopover
                previewFont={previewFont}
                onPreviewFontChange={setPreviewFont}
                fontSize={editorFontSize}
                onFontSizeChange={setEditorFontSize}
              />
              <PromptSaveVersionPopover open={saveVersionOpen} onOpenChange={setSaveVersionOpen} v={versions} />
              <PromptVersionHistory v={versions} promptVersion={visiblePrompt.version} />
              {divider}
            </>)}
            <ExpandingSearch value={q} onChange={onQChange} placeholder={t("toolbar.searchPlaceholder")} />
            <PromptListControls {...props} />
            {visiblePrompt && (<>
              {divider}
              <button
                type="button"
                onClick={() => onDelete(visiblePrompt)}
                className="la-btn la-btn--soft la-btn--icon"
                style={{ color: "var(--stage-lost)" }}
                title={t("actions.delete")}
                aria-label={t("actions.delete")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {divider}
            </>)}
            <button
              type="button"
              onClick={() => onOpenCreate(createCategory)}
              className="la-btn la-btn--wine max-2xl:!w-[var(--tb-ctl)] max-2xl:!px-0"
              style={{ flexShrink: 0 }}
              title={t("toolbar.create")}
              aria-label={t("toolbar.create")}
            >
              <Plus size={16} /> <span className="max-2xl:hidden">{t("toolbar.create")}</span>
            </button>
          </div>
        )}
      />

      {listTab === "niche" ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <NicheVocabularyPanel />
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* ── Left: the prompt list ─────────────────────────────────── */}
          {listPanelState === "hidden" ? (
            <div className="hidden lg:flex"><ListPanelUnfoldButton /></div>
          ) : listPanelState === "compact" ? (
            <div className="hidden lg:flex">
              <CompactPromptRail
                items={tabFilteredPrompts}
                selectedId={selectedId}
                onSelect={(p) => { setSelectedPrompt(p); setMobileView("detail"); }}
                getNames={getCardNames}
              />
            </div>
          ) : (
            <div
              className={cn(
                "min-h-0 overflow-hidden flex-col",
                mobileView === "detail" ? "hidden lg:flex" : "flex",
                // Wider than the shared --toolbar-w: prompt names are long.
                "w-full lg:w-[380px] lg:shrink-0",
              )}
              style={{ borderRight: "1px solid var(--line)", background: "var(--bg)" }}
            >
              <PromptListStrip
                shown={tabFilteredPrompts.length}
                demoCount={tabDemoCount}
                showDemo={showDemo}
                onShowDemoChange={setShowDemo}
              />
              <div
                ref={scrollContainerRef}
                className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin]"
                style={{ padding: "8px 10px 16px", display: "flex", flexDirection: "column" }}
              >
                {tabFilteredPrompts.length === 0 ? (
                  <div className="flex items-center justify-center h-full p-6">
                    <TabEmptyState tab={listTab} searching={!!q || props.isFilterActive} />
                  </div>
                ) : (
                  listItems.map((item) =>
                    item.kind === "header" ? (
                      <PromptGroupHeader key={`h-${item.label}`} label={item.label} count={item.count} />
                    ) : (
                      <PromptListCard
                        key={getPromptId(item.prompt)}
                        prompt={item.prompt}
                        isActive={selectedId === getPromptId(item.prompt)}
                        onClick={() => { setSelectedPrompt(item.prompt); setMobileView("detail"); }}
                        {...getCardNames(item.prompt)}
                      />
                    ),
                  )
                )}
              </div>
              {/* Bottom bar: the list fold button at the right end */}
              <ListPanelFooter />
            </div>
          )}

          {/* ── Right: header + editor (+ preview) ────────────────────── */}
          <div
            className={cn("flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative", mobileView === "list" ? "hidden lg:flex" : "flex")}
            style={{ background: "var(--surface)" }}
          >
            {visiblePrompt ? (
              <div key={selectedId} className="animate-panel-slide-up flex flex-col flex-1 min-h-0" style={{ padding: 8, gap: 8 }}>
                <PromptDetailHeader
                  prompt={visiblePrompt}
                  promptId={selectedId}
                  nameField={editablePromptName(
                    "name",
                    visiblePrompt.name || "",
                    t("labels.untitledPrompt"),
                    "text-[16px] font-bold text-[color:var(--ink)] min-w-0 max-w-full",
                  )}
                  campaignLabel={servedCampaignNames(visiblePrompt) || t("labels.noCampaign")}
                  accountName={selCampaign?.accountsId ? accountMap.get(selCampaign.accountsId) : null}
                  campaigns={campaigns}
                  tokenEstimate={tokenEstimate}
                  onStatusChange={(status) => { patchPrompt({ status }); }}
                  onCampaignChange={(id) => editPanelRef.current?.setField("campaignsId", id)}
                  onPatch={handleAreaPatch}
                  showSystemMessage={showSystemMessage}
                  onToggleSystemMessage={() => setShowSystemMessage((v) => !v)}
                  showNotes={showNotes}
                  onToggleNotes={() => setShowNotes((v) => !v)}
                  showSidebar={showEditorSidebar}
                  onToggleSidebar={() => setShowEditorSidebar((v) => !v)}
                  previewOpen={previewOpen}
                  onTogglePreview={() => setPreviewOpen((p) => !p)}
                />
                <PromptEditorPanel
                  ref={editPanelRef}
                  prompt={visiblePrompt}
                  onSaved={onSaved}
                  onDelete={onDelete}
                  campaigns={campaigns}
                  versionOverride={versions.versionOverride}
                  previewOpen={previewOpen}
                  setPreviewOpen={setPreviewOpen}
                  showSidebar={showEditorSidebar}
                  showSystemMessage={showSystemMessage}
                  showNotes={showNotes}
                  editorFontSize={editorFontSize}
                  previewFont={previewFont}
                  accentColor={detailAccent}
                  onTokenEstimate={setTokenEstimate}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                {tabFilteredPrompts.length === 0
                  ? <TabEmptyState tab={listTab} searching={!!q || props.isFilterActive} />
                  : <DataEmptyState variant="prompts" />}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
