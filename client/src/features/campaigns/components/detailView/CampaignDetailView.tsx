import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import {
  getDefaultDateRange,
  isWithinDateRange,
  type DateRangeValue,
} from "@/components/crm/DateRangeFilter";
import { getCampaignAvatarColor } from "@/lib/avatarUtils";
import type { CampaignSortBy, CampaignGroupBy } from "./constants";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useCampaignDetail, getCampaignMetrics } from "../useCampaignDetail";
import type { Tag as TagType } from "@/features/tags/types";
import type { TagSortOption, TagAutoAppliedFilter, TagGroupOption } from "@/features/tags/types";
import {
  GradientControlPoints,
  layerToStyle,
  type GradientLayer,
} from "@/components/ui/gradient-tester";

/** Matches the hardcoded CSS fallback gradients for the campaigns detail page */
const PAGE_DEFAULT_LAYERS: GradientLayer[] = [
  { id: 0, label: "Base", enabled: true, type: "solid", solidColor: "#ffffff", ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [] },
  { id: 1, label: "Yellow corner TL", enabled: true, type: "radial", ellipseW: 200, ellipseH: 200, posX: 6, posY: 5, colorStops: [
    { color: "#fff8c6", opacity: 1, position: 0 },
    { color: "#fff8c6", opacity: 0, position: 30 },
  ]},
  { id: 2, label: "Red glow BL", enabled: true, type: "radial", ellipseW: 103, ellipseH: 130, posX: 35, posY: 85, colorStops: [
    { color: "#ff8686", opacity: 0.4, position: 0 },
    { color: "#ff8686", opacity: 0, position: 69 },
  ]},
  { id: 3, label: "Gold corner TL", enabled: true, type: "radial", ellipseW: 52, ellipseH: 48, posX: 0, posY: 0, colorStops: [
    { color: "#fff6ba", opacity: 1, position: 5 },
    { color: "#fff6ba", opacity: 0, position: 30 },
  ]},
  { id: 4, label: "Peach center-right", enabled: true, type: "radial", ellipseW: 80, ellipseH: 102, posX: 78, posY: 50, colorStops: [
    { color: "#ffc2a5", opacity: 0.6, position: 0 },
    { color: "#ffc2a5", opacity: 0, position: 66 },
  ]},
];

import type { SavedTemplate } from "./types";
import { PromptEditorPanel } from "@/features/prompts/components/PromptEditorPanel";
import { FileText, X as XIcon, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { DetailViewToolbar } from "./DetailViewToolbar";
import { DetailViewHeader } from "./DetailViewHeader";
import { DetailViewBody } from "./DetailViewBody";
export { CampaignDetailViewEmpty } from "./atoms";

export interface CampaignDetailViewProps {
  campaign: Campaign;
  metrics: CampaignMetricsHistory[];
  allCampaigns: Campaign[];
  onToggleStatus: (campaign: Campaign) => void;
  onSave: (id: number, patch: Record<string, unknown>) => Promise<void>;
  onRefresh?: () => void;
  onDelete?: (id: number) => Promise<void>;
  onDuplicate?: (campaign: Campaign) => Promise<void>;
  compact?: boolean;
  onCreateCampaign?: () => void;
  activeTab?: "summary" | "configurations";
  onActiveTabChange?: (tab: "summary" | "configurations") => void;
  listSearch?: string;
  onListSearchChange?: (v: string) => void;
  searchOpen?: boolean;
  onSearchOpenChange?: (v: boolean) => void;
  sortBy?: CampaignSortBy;
  onSortByChange?: (v: CampaignSortBy) => void;
  isSortNonDefault?: boolean;
  filterStatus?: string[];
  onToggleFilterStatus?: (s: string) => void;
  filterAccount?: string;
  onFilterAccountChange?: (a: string) => void;
  isFilterActive?: boolean;
  showDemoCampaigns?: boolean;
  onShowDemoCampaignsChange?: (v: boolean) => void;
  groupBy?: CampaignGroupBy;
  onGroupByChange?: (v: CampaignGroupBy) => void;
  isGroupNonDefault?: boolean;
  availableAccounts?: string[];
  onResetControls?: () => void;
  onBack?: () => void;
  promptPanelOpen?: boolean;
  onTogglePromptPanel?: () => void;
}

export function CampaignDetailView({
  campaign, metrics, allCampaigns, onToggleStatus, onSave, onRefresh, onDelete, onDuplicate, compact = false,
  onCreateCampaign, activeTab: activeTabProp, onActiveTabChange, listSearch, onListSearchChange, searchOpen, onSearchOpenChange,
  sortBy, onSortByChange, isSortNonDefault, filterStatus, onToggleFilterStatus,
  filterAccount, onFilterAccountChange, isFilterActive, showDemoCampaigns, onShowDemoCampaignsChange,
  groupBy, onGroupByChange, isGroupNonDefault, availableAccounts, onResetControls, onBack,
  promptPanelOpen: promptPanelOpenProp, onTogglePromptPanel: onTogglePromptPanelProp,
}: CampaignDetailViewProps) {
  const { t } = useTranslation("campaigns");
  const { isAgencyUser, isAdmin } = useWorkspace();
  const { toast } = useToast();

  // ── Delegate data fetching + edit logic to hook ───────────────────────────
  const detail = useCampaignDetail(campaign, onSave);

  // ── Campaign-filtered metrics ─────────────────────────────────────────────
  const campaignMetrics = useMemo(() => {
    const cid = campaign.id || campaign.Id;
    return metrics.filter((m) => {
      const mid = Number(m.campaigns_id || (m as any).campaignsId || 0);
      return mid === cid;
    });
  }, [campaign, metrics]);

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [internalTab, setInternalTab] = useState<"summary" | "configurations">("summary");
  const activeTab = activeTabProp ?? internalTab;
  const setActiveTab = useCallback((tab: "summary" | "configurations") => {
    setInternalTab(tab);
    onActiveTabChange?.(tab);
  }, [onActiveTabChange]);

  const [dateRange, setDateRange] = useState<DateRangeValue>(getDefaultDateRange());

  // ── Tags toolbar state ────────────────────────────────────────────────────
  const [tagsSearch, setTagsSearch] = useState("");
  const [tagsSortBy, setTagsSortBy] = useState<TagSortOption>("name_asc");
  const tagsGroupBy: TagGroupOption = "category";
  const [tagsFilterAuto, setTagsFilterAuto] = useState<TagAutoAppliedFilter>("all");
  const [tagsFilterCat, setTagsFilterCat] = useState("");
  const [tagsCategories, setTagsCategories] = useState<string[]>([]);
  const [tagsCreateOpen, setTagsCreateOpen] = useState(false);
  const [tagsNewName, setTagsNewName] = useState("");
  const [tagsNewColor, setTagsNewColor] = useState("blue");
  const [tagsNewCategory, setTagsNewCategory] = useState("");
  const tagsCreateRef = useRef<((data: { name: string; color: string; category?: string }) => Promise<void>) | null>(null);

  const tagsIsFilterActive = tagsFilterAuto !== "all" || !!tagsFilterCat;
  const tagsFilterCount = (tagsFilterAuto !== "all" ? 1 : 0) + (tagsFilterCat ? 1 : 0);
  const tagsIsSortNonDefault = tagsSortBy !== "name_asc";

  const submitTagCreate = useCallback(async () => {
    if (!tagsNewName.trim()) return;
    try {
      await tagsCreateRef.current?.({
        name: tagsNewName.trim(),
        color: tagsNewColor,
        category: tagsNewCategory.trim() || undefined,
      });
      setTagsNewName("");
      setTagsNewColor("blue");
      setTagsNewCategory("");
      setTagsCreateOpen(false);
    } catch { /* handled by hook */ }
  }, [tagsNewName, tagsNewColor, tagsNewCategory]);

  // ── Tag template state ────────────────────────────────────────────────────
  const tagsDataRef = useRef<TagType[] | null>(null);
  const [savedTemplates, setSavedTemplates] = usePersistedState<SavedTemplate[]>("la:tag-templates", []);
  const [selectedTemplate, setSelectedTemplate] = useState<SavedTemplate | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateApplying, setTemplateApplying] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");

  const handleSelectTemplate = useCallback((tpl: SavedTemplate) => {
    setSelectedTemplate(tpl);
    setTemplateDialogOpen(true);
  }, []);

  const applyTemplate = useCallback(async () => {
    if (!tagsCreateRef.current || !selectedTemplate) return;
    setTemplateApplying(true);
    try {
      let created = 0;
      for (const tag of selectedTemplate.tags) {
        try { await tagsCreateRef.current({ name: tag.name, color: tag.color, category: tag.category }); created++; }
        catch { /* tag may already exist */ }
      }
      toast({ title: "Template applied", description: `${created} tag(s) created.` });
    } finally {
      setTemplateApplying(false);
      setTemplateDialogOpen(false);
      setSelectedTemplate(null);
    }
  }, [selectedTemplate, toast]);

  const handleSaveTemplate = useCallback(() => {
    const currentTags = tagsDataRef.current;
    if (!currentTags || currentTags.length === 0 || !saveTemplateName.trim()) return;
    const newTemplate: SavedTemplate = {
      name: saveTemplateName.trim(),
      tags: currentTags.map((tg) => ({ name: tg.name, color: tg.color || "blue", category: tg.category || "" })),
    };
    setSavedTemplates((prev) => [...prev, newTemplate]);
    toast({ title: "Template saved", description: `"${newTemplate.name}" saved with ${newTemplate.tags.length} tags.` });
    setSaveDialogOpen(false);
    setSaveTemplateName("");
  }, [saveTemplateName, setSavedTemplates, toast]);

  const handleDeleteTemplate = useCallback((index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedTemplates((prev) => prev.filter((_, i) => i !== index));
    toast({ title: "Template deleted" });
  }, [setSavedTemplates, toast]);

  // ── Prompt panel (agency-only, ultrawide) — lifted to CampaignListView ────
  const promptPanelOpen = promptPanelOpenProp ?? false;
  const togglePromptPanel = onTogglePromptPanelProp ?? (() => {});
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false);

  // ── Animation trigger on campaign change ──────────────────────────────────
  const [animTrigger, setAnimTrigger] = useState(0);
  useEffect(() => {
    setAnimTrigger((n) => n + 1);
  }, [campaign.id, campaign.Id]);

  // ── Gradient tester (agency-only) ─────────────────────────────────────────
  const GRADIENT_KEY = "la:gradient:campaigns";
  const [savedGradient, setSavedGradient] = useState<GradientLayer[] | null>(() => {
    try { const raw = localStorage.getItem(GRADIENT_KEY); return raw ? JSON.parse(raw) as GradientLayer[] : null; } catch { return null; }
  });
  const [gradientTesterOpen, setGradientTesterOpen] = useState(false);
  const [gradientLayers, setGradientLayers] = useState<GradientLayer[]>(savedGradient ?? PAGE_DEFAULT_LAYERS);
  const [gradientDragMode, setGradientDragMode] = useState(false);
  const updateGradientLayer = useCallback((id: number, patch: Partial<GradientLayer>) => {
    if (id === -1) { setGradientLayers(prev => [...prev, patch as GradientLayer]); return; }
    if (id === -2) { setGradientLayers(prev => prev.filter(l => l.id !== (patch as GradientLayer).id)); return; }
    setGradientLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);
  const handleSaveGradient = useCallback(() => {
    localStorage.setItem(GRADIENT_KEY, JSON.stringify(gradientLayers));
    setSavedGradient(gradientLayers);
  }, [gradientLayers]);
  const handleApplyGradient = useCallback(() => {
    handleSaveGradient();
    setGradientTesterOpen(false);
  }, [handleSaveGradient]);
  const toggleGradientTester = useCallback(() => {
    if (!gradientTesterOpen) {
      try {
        const raw = localStorage.getItem(GRADIENT_KEY);
        if (raw) setGradientLayers(JSON.parse(raw) as GradientLayer[]);
        else setGradientLayers(PAGE_DEFAULT_LAYERS);
      } catch { /* keep current layers */ }
    }
    setGradientTesterOpen(prev => !prev);
  }, [gradientTesterOpen]);

  // ── Sticker / Profile image state ─────────────────────────────────────────
  const [selectedStickerSlug, setSelectedStickerSlug] = useState<string | null>((campaign as any).campaign_sticker ?? null);
  const [hueValue, setHueValue] = useState<number>((campaign as any).campaign_hue ?? 0);
  const [stickerSize, setStickerSize] = useState<number>((campaign as any).campaign_sticker_size ?? 130);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [pendingHue, setPendingHue] = useState<number>(0);

  const campaignId = campaign.id || (campaign as any).Id;
  useEffect(() => {
    setSelectedStickerSlug((campaign as any).campaign_sticker ?? null);
    setHueValue((campaign as any).campaign_hue ?? 0);
    setStickerSize((campaign as any).campaign_sticker_size ?? 130);
  }, [campaignId]);

  const selectedSticker = CAMPAIGN_STICKERS.find(s => s.slug === selectedStickerSlug) ?? null;

  const campaignRef = useRef(campaign);
  campaignRef.current = campaign;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const saveSticker = useCallback(async (slug: string | null, hue: number, size: number) => {
    const id = campaignRef.current.id || (campaignRef.current as any).Id;
    if (id) await onSaveRef.current(id, { campaign_sticker: slug, campaign_hue: hue, campaign_sticker_size: size });
  }, []);

  const isStickerSyncRef = useRef(true);
  useEffect(() => { isStickerSyncRef.current = true; }, [campaignId]);
  useEffect(() => {
    if (!selectedStickerSlug) return;
    if (isStickerSyncRef.current) { isStickerSyncRef.current = false; return; }
    const timer = setTimeout(() => saveSticker(selectedStickerSlug, hueValue, stickerSize), 600);
    return () => clearTimeout(timer);
  }, [hueValue, stickerSize, selectedStickerSlug, saveSticker]);

  // ── Logo upload ────────────────────────────────────────────────────────────
  const logoInputRef = useRef<HTMLInputElement>(null);
  const handleLogoFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (logoInputRef.current) logoInputRef.current.value = "";
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const id = campaignRef.current.id || campaignRef.current.Id;
      if (id) await onSaveRef.current(id, { logo_url: dataUrl });
    };
    reader.readAsDataURL(file);
  }, []);
  const handleRemoveLogo = useCallback(async () => {
    const id = campaignRef.current.id || campaignRef.current.Id;
    if (id) await onSaveRef.current(id, { logo_url: "" });
  }, []);

  // ── Derived display values ─────────────────────────────────────────────────
  const status = String(campaign.status || "");
  const avatarColor = getCampaignAvatarColor(status);
  const isDraft = status === "Draft";
  const isPaused = status === "Paused";
  const isInactive = status === "Inactive";
  const isActive = status === "Active";
  const canToggle = isActive || isPaused;

  const initials = (campaign.name || "?").split(" ").slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? "").join("");

  const campaignNumber = useMemo(() => {
    const accountId = campaign.account_id || (campaign as any).Accounts_id;
    const sameAccount = allCampaigns
      .filter((c) => (c.account_id || (c as any).Accounts_id) === accountId)
      .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    const idx = sameAccount.findIndex((c) => (c.id || c.Id) === (campaign.id || campaign.Id));
    return idx >= 0 ? idx + 1 : 1;
  }, [campaign, allCampaigns]);

  const campaignCreatedAt: string | null = (campaign as any).createdAt ?? campaign.created_at ?? null;
  const durationDays = useMemo(() => {
    if (!campaignCreatedAt) return null;
    const start = new Date(campaignCreatedAt);
    const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return days;
  }, [campaignCreatedAt]);

  // ── Metrics filtered by date range ────────────────────────────────────────
  const filteredMetrics = useMemo(() => {
    return campaignMetrics.filter((m) => isWithinDateRange(m.metric_date, dateRange));
  }, [campaignMetrics, dateRange]);

  const agg = useMemo(() => getCampaignMetrics(campaign, filteredMetrics), [campaign, filteredMetrics]);

  const goToConfig = useCallback(() => setActiveTab("configurations"), [setActiveTab]);

  return (
    <div className="relative flex flex-row h-full overflow-hidden" data-testid="campaign-detail-view" data-onboarding="campaign-detail">
      {/* Main column */}
      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">

      {/* ── Background ── */}
      <div className="absolute inset-0 bg-popover dark:bg-background" />
      {gradientTesterOpen ? (
        <>
          {gradientLayers.map(layer => {
            const style = layerToStyle(layer);
            return style ? <div key={layer.id} className="absolute inset-0" style={style} /> : null;
          })}
          {gradientDragMode && (
            <GradientControlPoints layers={gradientLayers} onUpdateLayer={updateGradientLayer} />
          )}
        </>
      ) : savedGradient ? (
        <>
          {savedGradient.map((layer: GradientLayer) => {
            const style = layerToStyle(layer);
            return style ? <div key={layer.id} className="absolute inset-0" style={style} /> : null;
          })}
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_6%_5%,#fff8c6_0%,transparent_30%)] dark:opacity-[0.08]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_103%_130%_at_35%_85%,rgba(255,134,134,0.4)_0%,transparent_69%)] dark:opacity-[0.08]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_52%_48%_at_0%_0%,#fff6ba_5%,transparent_30%)] dark:opacity-[0.08]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_102%_at_78%_50%,rgba(255,194,165,0.6)_0%,transparent_66%)] dark:opacity-[0.08]" />
        </>
      )}

      {/* ── Header outer wrapper ── */}
      <div className="shrink-0 relative z-10">
        <div className="relative px-4 pt-2 md:pt-1 pb-5 space-y-3 w-full">

          {/* Header row: Avatar + Name on left, toolbar actions on right */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <DetailViewHeader
            campaign={campaign}
            isAdmin={isAdmin}
            status={status}
            avatarColor={avatarColor}
            isDraft={isDraft}
            isPaused={isPaused}
            isInactive={isInactive}
            initials={initials}
            campaignNumber={campaignNumber}
            campaignCreatedAt={campaignCreatedAt}
            dailyStats={detail.dailyStats}
            selectedSticker={selectedSticker}
            stickerSize={stickerSize}
            hueValue={hueValue}
            photoDialogOpen={photoDialogOpen}
            pendingSlug={pendingSlug}
            pendingHue={pendingHue}
            setPhotoDialogOpen={setPhotoDialogOpen}
            setPendingSlug={setPendingSlug}
            setPendingHue={setPendingHue}
            saveSticker={saveSticker}
            setSelectedStickerSlug={setSelectedStickerSlug}
            setHueValue={setHueValue}
            logoInputRef={logoInputRef}
            handleLogoFile={handleLogoFile}
            handleRemoveLogo={handleRemoveLogo}
            compact={compact}
            t={t}
            onSaveName={async (name) => { if (campaign.id) await onSave(campaign.id, { name }); }}
          />
            </div>

            {/* Toolbar actions — right side */}
            <div className="shrink-0 pt-1">
              <DetailViewToolbar
                detail={detail}
                campaign={campaign}
                activeTab={activeTab}
                isEditing={detail.isEditing}
                canToggle={canToggle}
                isActive={isActive}
                isAgencyUser={isAgencyUser}
                gradientTesterOpen={gradientTesterOpen}
                onToggleGradientTester={toggleGradientTester}
                onBack={onBack}
                onToggleStatus={onToggleStatus}
                onRefresh={onRefresh}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                promptPanelOpen={promptPanelOpen}
                onTogglePromptPanel={isAgencyUser ? togglePromptPanel : undefined}
                t={t}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tags toolbar placeholder */}
      <div className="relative z-10 shrink-0 px-4 pt-0 pb-0 flex items-center flex-wrap gap-2" />

      {/* Body + Dialogs + GradientTester */}
      <DetailViewBody
        activeTab={activeTab}
        campaign={campaign}
        filteredMetrics={filteredMetrics}
        agg={agg}
        animTrigger={animTrigger}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        campaignCreatedAt={campaignCreatedAt}
        detail={detail}
        compact={compact}
        isAgencyUser={isAgencyUser}
        goToConfig={goToConfig}
        templateDialogOpen={templateDialogOpen}
        selectedTemplate={selectedTemplate}
        templateApplying={templateApplying}
        applyTemplate={applyTemplate}
        setTemplateDialogOpen={setTemplateDialogOpen}
        setSelectedTemplate={setSelectedTemplate}
        saveDialogOpen={saveDialogOpen}
        setSaveDialogOpen={setSaveDialogOpen}
        saveTemplateName={saveTemplateName}
        setSaveTemplateName={setSaveTemplateName}
        handleSaveTemplate={handleSaveTemplate}
        tagsDataRef={tagsDataRef}
        gradientTesterOpen={gradientTesterOpen}
        setGradientTesterOpen={setGradientTesterOpen}
        gradientLayers={gradientLayers}
        updateGradientLayer={updateGradientLayer}
        resetGradientLayers={() => setGradientLayers(PAGE_DEFAULT_LAYERS)}
        gradientDragMode={gradientDragMode}
        setGradientDragMode={setGradientDragMode}
        handleSaveGradient={handleSaveGradient}
        handleApplyGradient={handleApplyGradient}
        onTogglePromptPanel={isAgencyUser ? togglePromptPanel : undefined}
      />
      </div> {/* end main column */}

      {/* Prompt panel — agency only, visible when open */}
      {promptPanelOpen && isAgencyUser && (
        <div className="w-[420px] lg:w-[520px] xl:w-[640px] shrink-0 flex flex-col border-l border-border bg-popover dark:bg-background overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>{detail.linkedPrompt?.name ?? t("toolbar.promptPanel", "Prompt Editor")}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPromptPreviewOpen(p => !p)}
                className={cn("h-7 w-7 rounded-full flex items-center justify-center transition-colors", promptPreviewOpen ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}
                title={promptPreviewOpen ? "Hide preview" : "Preview variables"}
              >
                {promptPreviewOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={togglePromptPanel}
                className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Panel body */}
          {detail.linkedPrompt ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <PromptEditorPanel
                prompt={detail.linkedPrompt}
                onSaved={(_saved) => { detail.reloadPrompts(); }}
                onDelete={() => {}}
                campaigns={[{
                  id: campaign.id,
                  name: campaign.name,
                  aiModel: (campaign as any).aiModel ?? (campaign as any).ai_model ?? "",
                  agentName: (campaign as any).agentName ?? (campaign as any).agent_name ?? null,
                  serviceName: (campaign as any).serviceName ?? (campaign as any).service_name ?? null,
                  campaignService: (campaign as any).campaignService ?? (campaign as any).campaign_service ?? null,
                  campaignUsp: (campaign as any).campaignUsp ?? (campaign as any).campaign_usp ?? null,
                  calendarLink: (campaign as any).calendarLink ?? (campaign as any).calendar_link ?? null,
                  whatLeadDid: (campaign as any).whatLeadDid ?? (campaign as any).what_lead_did ?? null,
                  inquiriesSource: (campaign as any).inquiriesSource ?? (campaign as any).inquiries_source ?? null,
                  inquiryTimeframe: (campaign as any).inquiryTimeframe ?? (campaign as any).inquiry_timeframe ?? null,
                  niche: (campaign as any).niche ?? (campaign as any).campaignNicheOverride ?? null,
                  nicheQuestion: (campaign as any).nicheQuestion ?? (campaign as any).niche_question ?? null,
                  bookingMode: (campaign as any).bookingModeOverride ?? (campaign as any).booking_mode_override ?? null,
                  language: (campaign as any).language ?? null,
                  demoClientName: (campaign as any).demoClientName ?? (campaign as any).demo_client_name ?? null,
                  companyName: (campaign as any).companyName ?? (campaign as any).company_name ?? null,
                  aiStyleOverride: (campaign as any).aiStyleOverride ?? (campaign as any).ai_style_override ?? null,
                  description: (campaign as any).description ?? null,
                  aiRole: (campaign as any).aiRole ?? (campaign as any).ai_role ?? null,
                  typoCount: (campaign as any).typoCount ?? (campaign as any).typo_count ?? null,
                  kb: (campaign as any).kb ?? null,
                }]}
                previewOpen={promptPreviewOpen}
                setPreviewOpen={setPromptPreviewOpen}
                editorFontSize={13}
                splitPreview={false}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[13px] text-muted-foreground italic">
                {t("config.noPromptLinked", "No prompt linked to this campaign")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
