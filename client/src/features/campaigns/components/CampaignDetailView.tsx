/**
 * CampaignDetailView — main shell
 *
 * Handles: header, toolbar, avatar/sticker, tab routing, background gradients,
 * tag template dialogs, gradient tester (agency), and delegates content to:
 *   - CampaignMetricsPanel  (summary tab)
 *   - CampaignStageEditor   (configurations tab)
 *   - useCampaignDetail     (data fetching + edit mutations)
 */
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Zap,
  ChevronLeft,
  Pencil,
  PauseCircle,
  PlayCircle,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Megaphone,
  X,
  Plus,
  ArrowUpDown,
  Filter,
  LayoutTemplate,
  Layers,
  Save,
  ImageIcon,
  Search,
  Camera,
  Tag,
  Palette,
} from "lucide-react";
import { GradientTester, GradientControlPoints, DEFAULT_LAYERS, layerToStyle, type GradientLayer } from "@/components/ui/gradient-tester";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { getDefaultDateRange, isWithinDateRange, type DateRangeValue } from "@/components/crm/DateRangeFilter";
import { CAMPAIGN_STATUS_HEX, getCampaignAvatarColor, getInitials } from "@/lib/avatarUtils";
import type { CampaignSortBy, CampaignGroupBy } from "../pages/CampaignsPage";
import { SearchPill } from "@/components/ui/search-pill";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/features/tags/components/ColorPicker";
import type { Tag as TagType, TagSortOption, TagAutoAppliedFilter } from "@/features/tags/types";
import type { TagGroupOption } from "@/features/tags/types";
import { usePersistedState } from "@/hooks/usePersistedState";

import { useCampaignDetail, getCampaignMetrics } from "./useCampaignDetail";
import { CampaignMetricsPanel } from "./CampaignMetricsPanel";
import { CampaignStageEditor } from "./CampaignStageEditor";

/* ── Saved template type ─────────────────────────────────────────────────── */
type SavedTemplate = { name: string; tags: { name: string; color: string; category: string }[] };

/* ── Reactivation tag template (source: campaign_id=1) ────────────────────── */
const REACTIVATION_TAG_TEMPLATE: { name: string; color: string; category: string }[] = [
  { name: "First Message Sent", color: "gray", category: "automation" },
  { name: "ai stop", color: "red", category: "Automation" },
  { name: "bump 2.1", color: "blue", category: "Automation" },
  { name: "bump 3.1", color: "blue", category: "Automation" },
  { name: "no bump", color: "gray", category: "Automation" },
  { name: "reply generating", color: "yellow", category: "Automation" },
  { name: "dnd", color: "red", category: "Behavior" },
  { name: "manual takeover", color: "orange", category: "Behavior" },
  { name: "appointment booked", color: "green", category: "Outcome" },
  { name: "goodbye", color: "gray", category: "Outcome" },
  { name: "no response", color: "gray", category: "Outcome" },
  { name: "schedule", color: "green", category: "Outcome" },
  { name: "high priority", color: "red", category: "Priority" },
  { name: "warm lead", color: "orange", category: "Priority" },
  { name: "dbr android", color: "purple", category: "Source" },
  { name: "fb lead", color: "purple", category: "Source" },
  { name: "sleeping beauty android optin", color: "purple", category: "Source" },
  { name: "bump 2 reply", color: "blue", category: "Status" },
  { name: "bump 3 reply", color: "blue", category: "Status" },
  { name: "bump response", color: "blue", category: "Status" },
  { name: "first message", color: "yellow", category: "Status" },
  { name: "follow-up", color: "orange", category: "Status" },
  { name: "lead", color: "blue", category: "Status" },
  { name: "multiple messages", color: "blue", category: "Status" },
  { name: "qualify", color: "green", category: "Status" },
  { name: "responded", color: "green", category: "Status" },
  { name: "second message", color: "yellow", category: "Status" },
];

// ── Toolbar button tokens ─────────────────────────────────────────────────────
const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
const xActive  = "border-brand-indigo text-brand-indigo";
const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

// ── Sort / Group / Filter labels ──────────────────────────────────────────────
const DETAIL_SORT_LABEL_KEYS: Record<CampaignSortBy, string> = {
  recent:        "sortOptions.recent",
  name_asc:      "sortOptions.nameAsc",
  name_desc:     "sortOptions.nameDesc",
  leads_desc:    "sortOptions.leadsDesc",
  response_desc: "sortOptions.responseDesc",
};
const DETAIL_GROUP_LABEL_KEYS: Record<CampaignGroupBy, string> = {
  none:    "groupBy.none",
  status:  "groupBy.status",
  account: "groupBy.account",
  type:    "groupBy.type",
};
const DETAIL_STATUS_FILTER_OPTIONS = ["Active", "Paused", "Completed", "Inactive", "Draft"];
const DETAIL_STATUS_HEX: Record<string, string> = {
  Active:    "#22C55E",
  Paused:    "#F59E0B",
  Completed: "#3B82F6",
  Finished:  "#3B82F6",
  Inactive:  "#94A3B8",
  Archived:  "#94A3B8",
  Draft:     "#6B7280",
};

function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}

// ── Duplicate button (inline confirm) ─────────────────────────────────────────
function DuplicateButton({
  campaign, onDuplicate, t,
}: {
  campaign: Campaign;
  onDuplicate: (campaign: Campaign) => Promise<void>;
  t: (key: string) => string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  if (confirming) {
    return (
      <div className="inline-flex items-center gap-1.5 h-9 rounded-full border border-black/[0.125] bg-card px-2.5 text-[12px] shrink-0">
        <span className="text-foreground/60 mr-0.5 whitespace-nowrap">{t("toolbar.duplicate")}?</span>
        <button
          className="h-7 px-3 rounded-full bg-brand-indigo text-white font-semibold text-[11px] hover:opacity-90 disabled:opacity-50 transition-opacity"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try { await onDuplicate(campaign); } finally { setLoading(false); setConfirming(false); }
          }}
        >
          {loading ? "…" : t("confirm.yes")}
        </button>
        <button
          className="h-7 px-3 rounded-full text-muted-foreground text-[11px] hover:text-foreground transition-colors"
          onClick={() => setConfirming(false)}
        >
          {t("confirm.no")}
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      className={cn(xBase, "hover:max-w-[110px]", xDefault)}
    >
      <Copy className="h-4 w-4 shrink-0" />
      <span className={xSpan}>{t("toolbar.duplicate")}</span>
    </button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function CampaignDetailViewEmpty({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("campaigns");
  return (
    <div className="relative h-full flex flex-col items-center justify-center gap-5 p-8 text-center overflow-hidden">
      <div className="absolute inset-0 bg-popover dark:bg-background" />
      <>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_6%_5%,#fff8c6_0%,transparent_30%)] dark:opacity-[0.08]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_103%_130%_at_35%_85%,rgba(255,134,134,0.4)_0%,transparent_69%)] dark:opacity-[0.08]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_52%_48%_at_0%_0%,#fff6ba_5%,transparent_30%)] dark:opacity-[0.08]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_102%_at_78%_50%,rgba(255,194,165,0.6)_0%,transparent_66%)] dark:opacity-[0.08]" />
      </>
      <div className="relative z-10">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 flex items-center justify-center ring-1 ring-amber-200/50 dark:ring-amber-700/30">
          <Megaphone className="h-10 w-10 text-amber-400" />
        </div>
      </div>
      <div className="relative z-10 space-y-1.5">
        <p className="text-sm font-semibold text-foreground/70">{t("empty.selectCampaign")}</p>
        <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">{t("empty.selectCampaignDesc")}</p>
      </div>
      <div className="relative z-10 flex items-center gap-1.5 text-[11px] text-amber-500 font-medium">
        <span>{t("empty.chooseFromList")}</span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface CampaignDetailViewProps {
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
  groupBy?: CampaignGroupBy;
  onGroupByChange?: (v: CampaignGroupBy) => void;
  isGroupNonDefault?: boolean;
  availableAccounts?: string[];
  onResetControls?: () => void;
  onBack?: () => void;
}

export function CampaignDetailView({
  campaign, metrics, allCampaigns, onToggleStatus, onSave, onRefresh, onDelete, onDuplicate, compact = false,
  onCreateCampaign, activeTab: activeTabProp, onActiveTabChange, listSearch, onListSearchChange, searchOpen, onSearchOpenChange,
  sortBy, onSortByChange, isSortNonDefault, filterStatus, onToggleFilterStatus,
  filterAccount, onFilterAccountChange, isFilterActive, groupBy, onGroupByChange,
  isGroupNonDefault, availableAccounts, onResetControls, onBack,
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

  const tagPill = "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-medium border border-black/[0.125] bg-transparent text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors";
  const tagPillActive = "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-medium border border-brand-indigo/50 bg-brand-indigo/10 text-brand-indigo transition-colors";

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
  const [gradientLayers, setGradientLayers] = useState<GradientLayer[]>(DEFAULT_LAYERS);
  const [gradientDragMode, setGradientDragMode] = useState(false);
  const updateGradientLayer = useCallback((id: number, patch: Partial<GradientLayer>) => {
    if (id === -1) { setGradientLayers(prev => [...prev, patch as GradientLayer]); return; }
    if (id === -2) { setGradientLayers(prev => prev.filter(l => l.id !== (patch as GradientLayer).id)); return; }
    setGradientLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);
  const handleApplyGradient = useCallback(() => {
    localStorage.setItem(GRADIENT_KEY, JSON.stringify(gradientLayers));
    setSavedGradient(gradientLayers);
    setGradientTesterOpen(false);
  }, [gradientLayers]);
  const toggleGradientTester = useCallback(() => {
    setGradientTesterOpen(prev => {
      if (!prev && savedGradient) setGradientLayers(savedGradient);
      return !prev;
    });
  }, [savedGradient]);

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
    <div className="relative flex flex-col h-full overflow-hidden" data-testid="campaign-detail-view" data-onboarding="campaign-detail">

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

      {/* ── Header ── */}
      <div className="shrink-0 relative z-10">
        <div className="relative px-4 pt-6 pb-5 space-y-3 max-w-[1386px] w-full mr-auto">

          {/* Row 1: Toolbar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {onBack && (
              <button onClick={onBack} className="md:hidden h-9 w-9 rounded-full border border-black/[0.125] bg-background grid place-items-center shrink-0 mr-2">
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {detail.isEditing ? (
              <>
                <button
                  onClick={detail.handleSave}
                  disabled={detail.saving || !detail.hasChanges}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[12px] font-medium transition-colors",
                    (detail.hasChanges && !detail.saving)
                      ? "bg-brand-indigo text-white hover:opacity-90 transition-opacity"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {detail.saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {detail.saving ? t("toolbar.saving") : t("toolbar.save")}
                </button>
                <button
                  onClick={detail.cancelEdit}
                  disabled={detail.saving}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[12px] font-medium border border-black/[0.125] bg-transparent text-foreground hover:bg-muted/50 transition-colors"
                >
                  <X className="h-4 w-4" />
                  {t("toolbar.close")}
                </button>
              </>
            ) : (
              <>
                {activeTab === "configurations" && (
                  <button onClick={() => detail.startEdit(detail.linkedPrompt)} className={cn(xBase, "hover:max-w-[80px]", xDefault)}>
                    <Pencil className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.edit")}</span>
                  </button>
                )}

                {onCreateCampaign && (
                  <>
                    <button onClick={onCreateCampaign} className={cn(xBase, "hover:max-w-[80px]", xDefault)}>
                      <Plus className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.add")}</span>
                    </button>

                    <SearchPill value={listSearch ?? ""} onChange={(v) => onListSearchChange?.(v)} open={true} onOpenChange={() => {}} placeholder="Search campaigns..." />

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={cn(xBase, "hover:max-w-[100px]", isSortNonDefault ? xActive : xDefault)}>
                          <ArrowUpDown className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.sort")}</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-44">
                        {(Object.keys(DETAIL_SORT_LABEL_KEYS) as CampaignSortBy[]).map((s) => (
                          <DropdownMenuItem key={s} onClick={() => onSortByChange?.(s)} className={cn("text-[12px]", sortBy === s && "font-semibold text-brand-indigo")}>
                            {t(DETAIL_SORT_LABEL_KEYS[s])}
                            {sortBy === s && <Check className="h-3 w-3 ml-auto" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={cn(xBase, "hover:max-w-[100px]", isFilterActive ? xActive : xDefault)}>
                          <Filter className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.filter")}</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-52 max-h-80 overflow-y-auto">
                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("filter.status")}</div>
                        <DropdownMenuSeparator />
                        {DETAIL_STATUS_FILTER_OPTIONS.map((s) => (
                          <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); onToggleFilterStatus?.(s); }} className="flex items-center gap-2 text-[12px]">
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: DETAIL_STATUS_HEX[s] || "#6B7280" }} />
                            <span className={cn("flex-1", filterStatus?.includes(s) && "font-bold text-brand-indigo")}>{t(`statusLabels.${s}`, s)}</span>
                            {filterStatus?.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                          </DropdownMenuItem>
                        ))}
                        {(availableAccounts?.length ?? 0) > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("filter.account")}</div>
                            <DropdownMenuItem onClick={(e) => { e.preventDefault(); onFilterAccountChange?.(""); }} className={cn("flex items-center gap-2 text-[12px]", !filterAccount && "font-bold text-brand-indigo")}>
                              <span className="flex-1">{t("filter.allAccounts")}</span>
                              {!filterAccount && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {availableAccounts?.map((a) => (
                              <DropdownMenuItem key={a} onClick={(e) => { e.preventDefault(); onFilterAccountChange?.(filterAccount === a ? "" : a); }} className={cn("flex items-center gap-2 text-[12px]", filterAccount === a && "font-bold text-brand-indigo")}>
                                <span className="flex-1 truncate">{a}</span>
                                {filterAccount === a && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                        {isFilterActive && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={onResetControls} className="text-[12px] text-destructive">{t("filter.clearAllFilters")}</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={cn(xBase, "hover:max-w-[100px]", isGroupNonDefault ? xActive : xDefault)}>
                          <Layers className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.group")}</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-40">
                        {(Object.keys(DETAIL_GROUP_LABEL_KEYS) as CampaignGroupBy[]).map((g) => (
                          <DropdownMenuItem key={g} onClick={() => onGroupByChange?.(g)} className={cn("text-[12px]", groupBy === g && "font-semibold text-brand-indigo")}>
                            {t(DETAIL_GROUP_LABEL_KEYS[g])}
                            {groupBy === g && <Check className="h-3 w-3 ml-auto" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}

                <div className="ml-auto" />
                {canToggle && (
                  <button onClick={() => onToggleStatus(campaign)} className={cn(xBase, isActive ? "hover:max-w-[100px]" : "hover:max-w-[110px]", xDefault)}>
                    {isActive
                      ? <><PauseCircle className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.pause")}</span></>
                      : <><PlayCircle className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.activate")}</span></>
                    }
                  </button>
                )}
                <button onClick={onRefresh} className={cn(xBase, "hover:max-w-[110px]", xDefault)}>
                  <RefreshCw className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.refresh")}</span>
                </button>
                {isAgencyUser && (
                  <button onClick={toggleGradientTester} className={cn(xBase, "hover:max-w-[120px]", gradientTesterOpen ? xActive : xDefault)}>
                    <Palette className="h-4 w-4 shrink-0" /><span className={xSpan}>Gradient</span>
                  </button>
                )}
                {onDuplicate && <DuplicateButton campaign={campaign} onDuplicate={onDuplicate} t={t} />}
                {onDelete && (detail.deleteConfirm ? (
                  <div className="inline-flex items-center gap-1.5 h-9 rounded-full border border-red-300/50 bg-card px-4 text-[12px]">
                    <span className="text-foreground/60">{t("confirm.deleteConfirm")}</span>
                    <button
                      className="h-7 px-3 rounded-full bg-red-600 text-white font-semibold text-[11px] hover:opacity-90 disabled:opacity-50 transition-opacity"
                      disabled={detail.deleting}
                      onClick={async () => {
                        detail.setDeleting(true);
                        try { await onDelete?.(campaign.id || campaign.Id); }
                        finally { detail.setDeleting(false); detail.setDeleteConfirm(false); }
                      }}
                    >
                      {detail.deleting ? "..." : t("confirm.yes")}
                    </button>
                    <button className="h-7 px-3 rounded-full text-muted-foreground text-[11px] hover:text-foreground transition-colors" onClick={() => detail.setDeleteConfirm(false)}>{t("confirm.no")}</button>
                  </div>
                ) : (
                  <button onClick={() => detail.setDeleteConfirm(true)} className={cn(xBase, "hover:max-w-[100px]", "border-black/[0.125] text-red-500 hover:text-red-600")}>
                    <Trash2 className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.delete")}</span>
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Row 2: Avatar + Name + Meta chips */}
          <div className="relative flex items-center gap-3">
            <div className="relative group shrink-0">
              <div
                className={cn(
                  "relative flex items-center justify-center text-xl font-bold",
                  !selectedSticker && "rounded-full overflow-hidden",
                  isAdmin ? "cursor-pointer" : "cursor-default"
                )}
                style={{
                  width: selectedSticker ? Math.min(stickerSize, 130) : 72,
                  height: selectedSticker ? Math.min(stickerSize, 130) : 72,
                  ...(campaign.logo_url || selectedSticker ? {} : isDraft
                    ? { backgroundColor: "#B8C8E8", color: "#2D3F6E" }
                    : isPaused
                    ? { backgroundColor: "#C8B86A", color: "#5A4A1A" }
                    : { backgroundColor: avatarColor.bg, color: avatarColor.text }),
                }}
                onClick={() => {
                  if (!isAdmin) return;
                  setPendingSlug(selectedStickerSlug);
                  setPendingHue(hueValue);
                  setPhotoDialogOpen(true);
                }}
                title={isAdmin ? t("photo.clickToChange") : undefined}
              >
                {selectedSticker ? (
                  <img src={selectedSticker.url} alt={selectedSticker.label} className="object-contain w-full h-full"
                    style={{ filter:
                      isInactive ? "grayscale(1) opacity(0.8)"
                      : isDraft ? "grayscale(1) sepia(1) hue-rotate(185deg) saturate(4) brightness(0.9) opacity(0.8)"
                      : isPaused ? "sepia(1) saturate(2) hue-rotate(-5deg) brightness(0.85) opacity(0.8)"
                      : `hue-rotate(${hueValue}deg)`
                    }}
                  />
                ) : campaign.logo_url ? (
                  <img src={campaign.logo_url} alt="logo" className="h-full w-full object-cover"
                    style={{ filter:
                      isInactive ? "grayscale(1) opacity(0.5)"
                      : isDraft ? "grayscale(1) sepia(1) hue-rotate(185deg) saturate(4) brightness(0.9) opacity(0.5)"
                      : isPaused ? "sepia(1) saturate(2) hue-rotate(-5deg) brightness(0.85) opacity(0.5)"
                      : undefined
                    }}
                  />
                ) : (
                  initials || <Zap className="w-6 h-6" />
                )}
              </div>
              {isAdmin && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer pointer-events-none">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              )}
              {isAdmin && campaign.logo_url && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
                  title={t("photo.removeLogo")}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-white dark:bg-card border border-black/[0.125] flex items-center justify-center text-foreground/50 hover:text-red-500 hover:border-red-300 transition-colors z-10 opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />

            {/* Photo / Sticker dialog */}
            <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>{t("photo.dialogTitle")}</DialogTitle></DialogHeader>
                <div className="flex justify-center py-2">
                  {(() => {
                    const previewSticker = CAMPAIGN_STICKERS.find(s => s.slug === pendingSlug) ?? null;
                    return previewSticker ? (
                      <img src={previewSticker.url} alt={previewSticker.label} className="object-contain" style={{ width: 80, height: 80, filter: `hue-rotate(${pendingHue}deg)` }} />
                    ) : (
                      <div className="h-[72px] w-[72px] rounded-full flex items-center justify-center bg-muted/30 text-muted-foreground/40">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    );
                  })()}
                </div>
                {pendingSlug && (
                  <div className="space-y-1.5 px-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold">{t("photo.hue")}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">{pendingHue}°</p>
                    </div>
                    <input type="range" min={0} max={360} value={pendingHue} onChange={(e) => setPendingHue(Number(e.target.value))} className="w-full accent-brand-indigo cursor-pointer" />
                  </div>
                )}
                <button type="button" onClick={() => logoInputRef.current?.click()}
                  className="w-full h-9 rounded-lg border border-black/[0.125] text-[12px] font-medium text-foreground/60 hover:text-foreground hover:border-black/[0.175] transition-colors flex items-center justify-center gap-1.5"
                >
                  <Camera className="h-4 w-4" />{t("photo.uploadLogo")}
                </button>
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold">{t("photo.chooseSticker")}</p>
                  <div className="grid grid-cols-5 gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                    <button type="button"
                      className={cn("h-10 w-10 rounded-lg flex items-center justify-center border transition-colors", !pendingSlug ? "border-brand-indigo bg-indigo-50" : "border-black/[0.125] hover:border-black/[0.175]")}
                      onClick={() => setPendingSlug(null)} title={t("photo.noSticker")}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                    {CAMPAIGN_STICKERS.map((s) => (
                      <button key={s.slug} type="button"
                        className={cn("h-10 w-10 rounded-lg flex items-center justify-center border transition-colors p-1", pendingSlug === s.slug ? "border-brand-indigo bg-indigo-50" : "border-black/[0.125] hover:border-black/[0.175]")}
                        onClick={() => setPendingSlug(s.slug)} title={s.label}
                      >
                        <img src={s.url} alt={s.label} className="h-full w-full object-contain" style={{ filter: `hue-rotate(${pendingHue}deg)` }} />
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button"
                  onClick={() => { setSelectedStickerSlug(pendingSlug); setHueValue(pendingHue); saveSticker(pendingSlug, pendingHue, stickerSize); setPhotoDialogOpen(false); }}
                  className="w-full h-9 rounded-lg bg-brand-indigo text-white text-[13px] font-semibold hover:bg-brand-indigo/90 transition-colors"
                >
                  {t("toolbar.save")}
                </button>
              </DialogContent>
            </Dialog>

            <div className="flex-1 min-w-0">
              <h2 className="text-[18px] md:text-[27px] font-semibold font-heading text-foreground leading-tight truncate" data-testid="campaign-detail-view-name">
                {campaign.name || t("detail.unnamed")}
              </h2>
              <div className="mt-1 flex items-center gap-1.5" data-testid="campaign-detail-view-status">
                {status && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold self-start"
                    style={{ backgroundColor: `${CAMPAIGN_STATUS_HEX[status]}20`, color: CAMPAIGN_STATUS_HEX[status] || "#6B7280" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: CAMPAIGN_STATUS_HEX[status] || "#6B7280" }} />
                    {t(`statusLabels.${status}`, status)}
                  </span>
                )}
                <span className="text-[11px] font-semibold text-foreground/40">#{campaignNumber}</span>
              </div>
            </div>

            {/* Meta chips — desktop, non-compact */}
            {!compact && (
              <div className="shrink-0 hidden md:flex items-center gap-7 whitespace-nowrap">
                {(campaign as any).channel && (
                  <div className="flex items-center gap-1.5">
                    <img src={`/logos/${(({ whatsapp: "whatsapp-svgrepo-com", instagram: "instagram-svgrepo-com", email: "email-address-svgrepo-com", sms: "sms-svgrepo-com", phone: "phone-call-svgrepo-com" } as Record<string, string>)[(campaign as any).channel?.toLowerCase()] ?? "sms-svgrepo-com")}.svg`} alt={(campaign as any).channel} className="h-[26px] w-[26px] object-contain shrink-0" />
                    <div>
                      <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.channel")}</div>
                      <div className="text-[11px] font-bold text-foreground leading-none capitalize">{(campaign as any).channel}</div>
                    </div>
                  </div>
                )}
                {campaignCreatedAt && (
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.started")}</div>
                    <div className="text-[11px] font-bold text-foreground leading-none">{formatDate(campaignCreatedAt)}</div>
                  </div>
                )}
                {campaign.type && (
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.type")}</div>
                    <div className="text-[11px] font-bold text-foreground leading-none">{campaign.type}</div>
                  </div>
                )}
                {campaign.daily_lead_limit != null && (
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.dailyLimit")}</div>
                    <div className="text-[11px] font-bold text-foreground leading-none tabular-nums">
                      {detail.dailyStats != null ? `${detail.dailyStats.sentToday} / ${campaign.daily_lead_limit}` : `${campaign.daily_lead_limit}`}
                    </div>
                  </div>
                )}
                {(campaign.active_hours_start || (campaign as any).activeHoursStart) && (
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.activeHours")}</div>
                    <div className="text-[11px] font-bold text-foreground leading-none">
                      {((campaign.active_hours_start || (campaign as any).activeHoursStart) as string).slice(0, 5)}
                      {" – "}
                      {((campaign.active_hours_end || (campaign as any).activeHoursEnd) as string)?.slice(0, 5) ?? "—"}
                    </div>
                  </div>
                )}
                {campaign.account_name && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-[30px] w-[30px] rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={(campaign as any).account_logo_url ? {} : { backgroundColor: "rgba(0,0,0,0.08)", color: "#374151" }}>
                      {(campaign as any).account_logo_url ? <img src={(campaign as any).account_logo_url} alt="account" className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold">{getInitials(campaign.account_name)}</span>}
                    </div>
                    <div>
                      <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.owner")}</div>
                      <div className="text-[11px] font-bold text-foreground leading-none">{campaign.account_name}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile / compact meta chips */}
          <div className={cn("flex flex-wrap items-center gap-7", compact ? "flex" : "flex md:hidden")}>
            {campaign.account_name && (
              <div className="flex items-center gap-1.5">
                <div className="h-[24px] w-[24px] rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={(campaign as any).account_logo_url ? {} : { backgroundColor: "rgba(0,0,0,0.08)", color: "#374151" }}>
                  {(campaign as any).account_logo_url ? <img src={(campaign as any).account_logo_url} alt="account" className="h-full w-full object-cover" /> : <span className="text-[9px] font-bold">{getInitials(campaign.account_name)}</span>}
                </div>
                <div>
                  <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.owner")}</div>
                  <div className="text-[11px] font-bold text-foreground leading-none">{campaign.account_name}</div>
                </div>
              </div>
            )}
            {(campaign as any).channel && (
              <div className="flex items-center gap-1.5">
                <img src={`/logos/${(({ whatsapp: "whatsapp-svgrepo-com", instagram: "instagram-svgrepo-com", email: "email-address-svgrepo-com", sms: "sms-svgrepo-com", phone: "phone-call-svgrepo-com" } as Record<string, string>)[(campaign as any).channel?.toLowerCase()] ?? "sms-svgrepo-com")}.svg`} alt={(campaign as any).channel} className="h-[24px] w-[24px] object-contain shrink-0" />
                <div>
                  <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.channel")}</div>
                  <div className="text-[11px] font-bold text-foreground leading-none capitalize">{(campaign as any).channel}</div>
                </div>
              </div>
            )}
            {campaignCreatedAt && (
              <div>
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.started")}</div>
                <div className="text-[11px] font-bold text-foreground leading-none">{formatDate(campaignCreatedAt)}</div>
              </div>
            )}
            {campaign.type && (
              <div>
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.type")}</div>
                <div className="text-[11px] font-bold text-foreground leading-none">{campaign.type}</div>
              </div>
            )}
            {campaign.daily_lead_limit != null && (
              <div>
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.dailyLimit")}</div>
                <div className="text-[11px] font-bold text-foreground leading-none tabular-nums">
                  {detail.dailyStats != null ? `${detail.dailyStats.sentToday} / ${campaign.daily_lead_limit}` : `${campaign.daily_lead_limit}`}
                </div>
              </div>
            )}
            {(campaign.active_hours_start || (campaign as any).activeHoursStart) && (
              <div>
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.activeHours")}</div>
                <div className="text-[11px] font-bold text-foreground leading-none">
                  {((campaign.active_hours_start || (campaign as any).activeHoursStart) as string).slice(0, 5)}
                  {" – "}
                  {((campaign.active_hours_end || (campaign as any).activeHoursEnd) as string)?.slice(0, 5) ?? "—"}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Tags toolbar placeholder (hidden by false gate for now) */}
      <div className="relative z-10 shrink-0 px-4 pt-0 pb-0 flex items-center flex-wrap gap-2" />

      {/* ── Body ── */}
      <div
        className="relative flex-1 px-[3px] pb-[3px] -mt-[80px] pt-[83px] overflow-y-auto"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0px, black 83px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0px, black 83px)",
        }}
      >
        {activeTab === "summary" && (
          <CampaignMetricsPanel
            campaign={campaign}
            filteredMetrics={filteredMetrics}
            agg={agg}
            animTrigger={animTrigger}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            campaignCreatedAt={campaignCreatedAt}
            dailyStats={detail.dailyStats}
            linkedContract={detail.linkedContract}
            contractLoading={detail.contractLoading}
            localAiSummary={detail.localAiSummary}
            localAiSummaryAt={detail.localAiSummaryAt}
            onAiSummaryRefreshed={detail.handleAiSummaryRefreshed}
            isAgencyUser={isAgencyUser}
            onGoToConfig={goToConfig}
            compact={compact}
          />
        )}

        {activeTab === "configurations" && (
          <CampaignStageEditor
            campaign={campaign}
            isEditing={detail.isEditing}
            draft={detail.draft}
            setDraft={detail.setDraft}
            linkedPrompt={detail.linkedPrompt}
            conversationPrompts={detail.conversationPrompts}
            linkedContract={detail.linkedContract}
            compact={compact}
          />
        )}
      </div>

      {/* ── Apply template confirmation dialog ── */}
      <AlertDialog open={templateDialogOpen} onOpenChange={(open) => { setTemplateDialogOpen(open); if (!open) setSelectedTemplate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply {selectedTemplate?.name} Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create {selectedTemplate?.tags.length ?? 0} tags from the {selectedTemplate?.name} template
              for <span className="font-medium text-foreground">{campaign.name}</span>.
              Existing tags with the same name will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={templateApplying}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyTemplate} disabled={templateApplying}>
              {templateApplying ? "Applying..." : "Apply Template"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Save template dialog ── */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Save Tags as Template</DialogTitle></DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            Save the {tagsDataRef.current?.length ?? 0} tags from{" "}
            <span className="font-medium text-foreground">{campaign.name}</span> as a reusable template.
          </p>
          <input
            type="text"
            placeholder="Template name"
            value={saveTemplateName}
            onChange={(e) => setSaveTemplateName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveTemplate(); }}
            className="w-full h-9 px-3 text-[12px] rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveTemplate} disabled={!saveTemplateName.trim()}>Save Template</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gradient Tester (agency-only) */}
      {isAgencyUser && (
        <GradientTester
          open={gradientTesterOpen}
          onClose={() => setGradientTesterOpen(false)}
          layers={gradientLayers}
          onUpdateLayer={updateGradientLayer}
          onResetLayers={() => setGradientLayers(DEFAULT_LAYERS)}
          dragMode={gradientDragMode}
          onToggleDragMode={() => setGradientDragMode(prev => !prev)}
          onApply={handleApplyGradient}
        />
      )}

    </div>
  );
}
