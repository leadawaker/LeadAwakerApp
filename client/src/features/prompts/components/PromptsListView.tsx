// Prompt Library split view: area tabs (promptCategories) in the topbar, the
// prompt list on the left (380px) and the selected prompt's editor on the
// right, with its preview beside it by default (Ctrl+P toggles it).
// Parts live in ./promptList/.
import { useState, useEffect, useRef, useMemo } from "react";
import { ListPanelFooter } from "@/components/crm/ListPanelToggleButton";
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
import { PageTopbar, ExpandingSearch, ListSection } from "@/components/crm/primitives";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { type CampaignForPreview } from "../utils/resolveVariables";
import { getPromptId, MODEL_OPTIONS, isCampaignPrompt, modelLabel } from "../types";
import { campaignsByPrompt, effectivePromptModel } from "../utils/campaignPrompt";
import {
  PROMPT_CATEGORIES, VOICE_SECTIONS, isDemoPrompt, isPromptCategory, promptCategory, voiceSection, voiceSectionRank,
  type PromptCategory, type PromptListTab,
} from "../promptCategories";
import { PromptEditorPanel, type PromptEditorPanelHandle } from "./PromptEditorPanel";
import { PromptListCard, CompactPromptRail } from "./promptList/PromptListCard";
import { PromptListControls, type PromptListControlsProps } from "./promptList/PromptListControls";
import { PromptFontPopover, PromptSaveVersionPopover, PromptVersionHistory } from "./promptList/PromptVersionControls";
import { PromptDetailHeader } from "./promptList/PromptDetailHeader";
import { PromptCategoryTabs, PromptListStrip } from "./promptList/PromptCategoryTabs";
import { usePromptVersions } from "./promptList/usePromptVersions";

const LIST_TABS: readonly PromptListTab[] = PROMPT_CATEGORIES;

interface PromptsListViewProps extends PromptListControlsProps {
  prompts: any[];
  groupedRows: Map<string, any[]> | null;
  q: string;
  onQChange: (v: string) => void;
  onSaved: (saved: any) => void;
  onDelete: (prompt: any) => void;
  /** Opens the create panel; the new prompt starts in this area. */
  onOpenCreate: (category: PromptCategory) => void;
  /** Every account's name, for the "used by" groups and the "Preview as" list. */
  accountNames: Map<number, string>;
  campaigns: CampaignForPreview[];
  /** A campaign row was saved from the editor (model, a variable's value). */
  onCampaignUpdated: (row: any) => void;
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
  const { prompts, groupedRows, q, onQChange, onSaved, onDelete, onOpenCreate, accountNames, campaigns, onCampaignUpdated } = props;
  const { t } = useTranslation("prompts");
  const { toast } = useToast();
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const { state: listPanelState } = useListPanelState();

  // Area tab, reopening on the one used last.
  const [listTab, setListTab] = useLastTab<PromptListTab>("prompts", LIST_TABS, "chat");
  // List fold button (lg+, where the list panel sits beside the editor).
  const belowLg = useIsMobile(1024);
  useListPanelFold(!belowLg);
  const [showDemo, setShowDemo] = usePersistedState<boolean>("prompts-show-demo", true, (v) => typeof v === "boolean");

  const [showSystemMessage, setShowSystemMessage] = useState(false);
  const [showEditorSidebar, setShowEditorSidebar] = useState(true);
  const [previewOpen, setPreviewOpen] = usePersistedState<boolean>("prompts-preview-open", true, (v) => typeof v === "boolean");
  const [editorFontSize, setEditorFontSize] = usePersistedState<number>(
    "prompts-editor-font-size", 14, (v) => typeof v === "number" && v >= 11 && v <= 18,
  );
  const [previewFont, setPreviewFont] = usePersistedState<string>("prompts-preview-font-v2", "var(--mono)", (v) => typeof v === "string");
  const [tokenEstimate, setTokenEstimate] = useState(0);
  const [saveVersionOpen, setSaveVersionOpen] = useState(false);
  const editPanelRef = useRef<PromptEditorPanelHandle>(null);

  // Campaigns that talk with each prompt, resolved like the engine's
  // get_prompt_for_campaign: the picked prompt_id, the campaign's own row, then
  // prompt_campaign_id. A helper row (not "conversation") shows its own campaign.
  const usedByOf = useMemo(() => {
    const byPrompt = campaignsByPrompt(prompts, campaigns);
    return (p: any): CampaignForPreview[] => {
      const served = (byPrompt.get(getPromptId(p)) ?? []) as CampaignForPreview[];
      if (served.length) return served;
      const cId = Number(p.campaignsId || p.Campaigns_id) || 0;
      const own = cId && !isCampaignPrompt(p) ? campaigns.find((c) => c.id === cId) : undefined;
      return own ? [own] : [];
    };
  }, [prompts, campaigns]);

  function getCardNames(p: any): { usedBy: CampaignForPreview[]; accountName?: string } {
    const cId = Number(p.campaignsId || p.Campaigns_id) || 0;
    const campaign = cId ? campaigns.find((c) => c.id === cId) : undefined;
    const aId = campaign?.accountsId;
    return { usedBy: usedByOf(p), accountName: aId ? accountNames.get(aId) : undefined };
  }

  /* ── Tab + demo filtering ─────────────────────────────────────────────── */
  const inTab = useMemo(() => {
    const tab = listTab;
    return (p: any) => promptCategory(p) === tab && (showDemo || !isDemoPrompt(p));
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
    () => prompts.filter((p) => promptCategory(p) === listTab && isDemoPrompt(p)).length,
    [prompts, listTab],
  );

  // The list's groups, each drawn as its own card under its title. label null: one untitled card.
  const listGroups = useMemo(() => {
    type Group = { label: string | null; items: any[] };
    // Voice always splits into GPT Live's parts: voice, then the backend frame with its business prompts.
    if (listTab === "voice") {
      const groups: Group[] = [];
      for (const section of VOICE_SECTIONS) {
        const items = tabFilteredPrompts.filter((p) => voiceSection(p) === section);
        if (items.length === 0) continue;
        // Stable sort: the frame first, the rest keep the chosen sort.
        items.sort((a, b) => voiceSectionRank(a) - voiceSectionRank(b));
        groups.push({ label: t(`voiceSection.${section}`), items });
      }
      return groups;
    }
    if (!groupedRows) return [{ label: null, items: tabFilteredPrompts }];
    const groups: Group[] = [];
    groupedRows.forEach((rows, label) => {
      const items = rows.filter(inTab);
      if (items.length) groups.push({ label, items });
    });
    return groups;
  }, [groupedRows, tabFilteredPrompts, inTab, listTab, t]);

  /* ── Selection ────────────────────────────────────────────────────────── */
  const [selectedPrompt, setSelectedPrompt] = usePersistedSelection("prompts-selected-id", (p: any) => getPromptId(p), prompts);

  // Keep the selection inside the open tab: its first prompt when the selected one is elsewhere.
  useEffect(() => {
    if (tabFilteredPrompts.length === 0) return;
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

  // Smooth scroll to the selected card, below its group's title (pinned while scrolling).
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedId == null || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const raf = requestAnimationFrame(() => {
      const el = container.querySelector(`[data-prompt-id="${selectedId}"]`) as HTMLElement | null;
      if (!el) return;
      const title = el.closest(".la-list-section")?.querySelector(".la-list-section-title") as HTMLElement | null;
      const headerHeight = title?.offsetHeight ?? 0;
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

  const selectedUsedBy = useMemo(() => (visiblePrompt ? usedByOf(visiblePrompt) : []), [visiblePrompt, usedByOf]);
  const servingCampaignIds = useMemo(() => selectedUsedBy.map((c) => c.id), [selectedUsedBy]);
  // One source for the model: the linked campaign's ai_model (what the engine reads), with the
  // pick shown at once while the autosave is on its way.
  const [pendingModel, setPendingModel] = useState<string | null>(null);
  const savedModel = visiblePrompt ? effectivePromptModel(visiblePrompt, campaigns) : "";
  useEffect(() => { setPendingModel(null); }, [selectedId, savedModel]);
  const shownModel = pendingModel ?? savedModel;
  const createCategory: PromptCategory = listTab;
  const divider = <div style={{ width: 1, height: 22, background: "var(--line)", margin: "0 2px" }} />;
  // The prompt's edit actions: they sit in its header, a step smaller than the topbar's.
  const promptActions = visiblePrompt && (
    <div className="la-prompt-actions hidden lg:flex items-center gap-1.5">
      {MODEL_OPTIONS.includes(shownModel) ? (
        <select
          className="text-[11px] font-mono outline-none cursor-pointer shrink-0 neu-inset-crisp"
          style={{ background: "var(--bg)", color: "var(--mute)", borderRadius: "var(--r-pill)", padding: "0 10px", height: 28, border: "none", maxWidth: 150 }}
          value={shownModel}
          onChange={(e) => { setPendingModel(e.target.value); editPanelRef.current?.setField("model", e.target.value); }}
          aria-label={t("labels.model")}
        >
          {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{modelLabel(m)}</option>)}
        </select>
      ) : (
        <span
          className="text-[11px] font-mono shrink-0 neu-inset-crisp"
          style={{ background: "var(--bg)", color: "var(--mute-2)", borderRadius: "var(--r-pill)", padding: "0 10px", height: 28, lineHeight: "28px" }}
        >
          {t("toolbar.hardcodedModel")}
        </span>
      )}
      <PromptFontPopover
        previewFont={previewFont}
        onPreviewFontChange={setPreviewFont}
        fontSize={editorFontSize}
        onFontSizeChange={setEditorFontSize}
      />
      <PromptSaveVersionPopover open={saveVersionOpen} onOpenChange={setSaveVersionOpen} v={versions} />
      <PromptVersionHistory v={versions} promptVersion={visiblePrompt.version} />
    </div>
  );


  return (
    <div className="flex flex-col h-full" data-testid="prompts-list-view">
      <PageTopbar
        title={t("page.title")}
        shrinkLeft
        left={<PromptCategoryTabs value={listTab} onChange={setListTab} counts={tabCounts} />}
        right={(
          <div className="hidden lg:flex items-center gap-1.5">
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

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Left: the prompt list ─────────────────────────────────── */}
        {listPanelState === "compact" ? (
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
              "la-list-panel la-list-panel--split",
              "min-h-0 overflow-hidden flex-col",
              mobileView === "detail" ? "hidden lg:flex" : "flex",
              "w-full lg:w-[var(--toolbar-w)] lg:shrink-0",
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
              className="la-split-scroll flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin]"
              style={{ padding: "6px 8px 8px", display: "flex", flexDirection: "column" }}
            >
              {tabFilteredPrompts.length === 0 ? (
                <div className="flex items-center justify-center h-full p-6">
                  <TabEmptyState tab={listTab} searching={!!q || props.isFilterActive} />
                </div>
              ) : (
                // Each group is its own card under its title, as on Calls (phones get MobilePromptsView).
                listGroups.map((group) => (
                  <ListSection key={group.label ?? "all"} label={group.label ?? undefined} count={group.label ? group.items.length : undefined}>
                    <div className="la-cards la-cards--flat">
                      {group.items.map((p) => (
                        <PromptListCard
                          key={getPromptId(p)}
                          prompt={p}
                          isActive={selectedId === getPromptId(p)}
                          onClick={() => { setSelectedPrompt(p); setMobileView("detail"); }}
                          accountNames={accountNames}
                          {...getCardNames(p)}
                        />
                      ))}
                    </div>
                  </ListSection>
                ))
              )}
            </div>
            {/* Bottom bar: the list fold button at the right end */}
            <ListPanelFooter />
          </div>
        )}

        {/* ── Right: header + editor (+ preview) ────────────────────── */}
        <div
          className={cn("flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative", mobileView === "list" ? "hidden lg:flex" : "flex")}
          style={{ background: "var(--bg)" }}
        >
          {visiblePrompt ? (
            <div key={selectedId} className="animate-panel-slide-up flex flex-col flex-1 min-h-0" style={{ padding: 14, gap: 12 }}>
              <PromptDetailHeader
                prompt={visiblePrompt}
                promptId={selectedId}
                nameField={editablePromptName(
                  "name",
                  visiblePrompt.name || "",
                  t("labels.untitledPrompt"),
                  "text-[18px] font-bold text-[color:var(--ink)] min-w-0 max-w-full",
                )}
                usedBy={selectedUsedBy}
                accountNames={accountNames}
                campaigns={campaigns}
                tokenEstimate={tokenEstimate}
                onStatusChange={(status) => { patchPrompt({ status }); }}
                onCampaignChange={(id) => editPanelRef.current?.setField("campaignsId", id)}
                onNoteChange={(note) => editPanelRef.current?.setField("notes", note)}
                onPatch={handleAreaPatch}
                showSystemMessage={showSystemMessage}
                onToggleSystemMessage={() => setShowSystemMessage((v) => !v)}
                showSidebar={showEditorSidebar}
                onToggleSidebar={() => setShowEditorSidebar((v) => !v)}
                previewOpen={previewOpen}
                onTogglePreview={() => setPreviewOpen((p) => !p)}
                actions={promptActions}
              />
              <PromptEditorPanel
                ref={editPanelRef}
                prompt={visiblePrompt}
                onSaved={onSaved}
                campaigns={campaigns}
                servingCampaignIds={servingCampaignIds}
                accountNames={accountNames}
                onCampaignUpdated={onCampaignUpdated}
                versionOverride={versions.versionOverride}
                previewOpen={previewOpen}
                showSidebar={showEditorSidebar}
                showSystemMessage={showSystemMessage}
                editorFontSize={editorFontSize}
                previewFont={previewFont}
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
    </div>
  );
}
