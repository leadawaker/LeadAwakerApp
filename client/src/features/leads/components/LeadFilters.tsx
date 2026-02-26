import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Filter,
  X,
  CalendarIcon,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";

/* ─────────── Types ─────────── */

export interface LeadFilterState {
  pipelineStage: string; // Conversion_Status value or "" for all
  campaignId: string;    // Campaign id as string or "" for all
  tags: number[];        // Array of tag IDs
  scoreMin: number;      // 0–100
  scoreMax: number;      // 0–100
  priority: string;      // priority value or "" for all
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

export const EMPTY_FILTERS: LeadFilterState = {
  pipelineStage: "",
  campaignId: "",
  tags: [],
  scoreMin: 0,
  scoreMax: 100,
  priority: "",
  dateFrom: undefined,
  dateTo: undefined,
};

const PIPELINE_STAGES = [
  "New",
  "Contacted",
  "Responded",
  "Multiple Responses",
  "Qualified",
  "Booked",
  "Lost",
  "DND",
];

const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

/* ─────────── Helpers ─────────── */

function countActive(f: LeadFilterState): number {
  let n = 0;
  if (f.pipelineStage) n++;
  if (f.campaignId) n++;
  if (f.tags.length > 0) n++;
  if (f.scoreMin > 0 || f.scoreMax < 100) n++;
  if (f.priority) n++;
  if (f.dateFrom || f.dateTo) n++;
  return n;
}

function formatDate(d: Date | undefined): string {
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/* ─────────── Component ─────────── */

interface LeadFiltersProps {
  filters: LeadFilterState;
  onFiltersChange: (next: LeadFilterState) => void;
}

export function LeadFilters({ filters, onFiltersChange }: LeadFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<{ id: number; name: string }[]>(
    []
  );
  const [allTags, setAllTags] = useState<
    { id: number; name: string; color: string; category: string }[]
  >([]);

  // Fetch campaigns and tags for dropdown options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [campRes, tagsRes] = await Promise.all([
          apiFetch("/api/campaigns"),
          apiFetch("/api/tags"),
        ]);
        if (campRes.ok) {
          const campData = await campRes.json();
          const list = Array.isArray(campData)
            ? campData
            : campData?.list || [];
          setCampaigns(
            list.map((c: any) => ({ id: c.id, name: c.name || `Campaign ${c.id}` }))
          );
        }
        if (tagsRes.ok) {
          const tagsData = await tagsRes.json();
          const list = Array.isArray(tagsData)
            ? tagsData
            : tagsData?.list || [];
          setAllTags(
            list.map((t: any) => ({
              id: t.id,
              name: t.name || `Tag ${t.id}`,
              color: t.color || "gray",
              category: t.category || "",
            }))
          );
        }
      } catch (err) {
        console.error("Failed to fetch filter options", err);
      }
    };
    fetchOptions();
  }, []);

  const activeCount = countActive(filters);

  const update = (patch: Partial<LeadFilterState>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  const clearAll = () => {
    onFiltersChange({ ...EMPTY_FILTERS });
  };

  const toggleTag = (tagId: number) => {
    const next = filters.tags.includes(tagId)
      ? filters.tags.filter((id) => id !== tagId)
      : [...filters.tags, tagId];
    update({ tags: next });
  };

  // Group tags by category for better UX
  const tagsByCategory = useMemo(() => {
    const grouped: Record<string, typeof allTags> = {};
    allTags.forEach((tag) => {
      const cat = tag.category || "Other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(tag);
    });
    return grouped;
  }, [allTags]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 rounded-xl gap-2 font-semibold bg-card border-border shadow-none relative"
          data-testid="lead-filters-btn"
        >
          <Filter className="h-4 w-4" />
          <span>Filter</span>
          {activeCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-4 w-4 flex items-center justify-center p-0 bg-brand-indigo">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0"
        align="start"
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="font-semibold text-sm">Lead Filters</h4>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-7 text-xs text-muted-foreground hover:text-red-600"
              >
                Clear all
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[440px]">
          <div className="p-4 space-y-5">
            {/* ── Pipeline Stage ── */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                Pipeline Stage
              </Label>
              <Select
                value={filters.pipelineStage || "__all__"}
                onValueChange={(v) =>
                  update({ pipelineStage: v === "__all__" ? "" : v })
                }
              >
                <SelectTrigger className="h-10 text-sm bg-card border-border">
                  <SelectValue placeholder="All stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All stages</SelectItem>
                  {PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Campaign ── */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                Campaign
              </Label>
              <Select
                value={filters.campaignId || "__all__"}
                onValueChange={(v) =>
                  update({ campaignId: v === "__all__" ? "" : v })
                }
              >
                <SelectTrigger className="h-10 text-sm bg-card border-border">
                  <SelectValue placeholder="All campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All campaigns</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Tags ── */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                Tags{" "}
                {filters.tags.length > 0 && (
                  <span className="text-brand-indigo ml-1">
                    ({filters.tags.length})
                  </span>
                )}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-10 justify-between text-sm font-normal border-border"
                  >
                    <span className="truncate">
                      {filters.tags.length === 0
                        ? "Select tags..."
                        : `${filters.tags.length} tag${filters.tags.length > 1 ? "s" : ""} selected`}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <ScrollArea className="max-h-[260px]">
                    <div className="p-2 space-y-3">
                      {Object.entries(tagsByCategory).map(
                        ([category, categoryTags]) => (
                          <div key={category}>
                            <div className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest px-2 py-1">
                              {category}
                            </div>
                            <div className="space-y-0.5">
                              {categoryTags.map((tag) => (
                                <div
                                  key={tag.id}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer"
                                  onClick={() => toggleTag(tag.id)}
                                >
                                  <Checkbox
                                    checked={filters.tags.includes(tag.id)}
                                    className="h-3.5 w-3.5"
                                  />
                                  <div
                                    className="h-2.5 w-2.5 rounded-full shrink-0"
                                    style={{
                                      backgroundColor:
                                        tag.color.startsWith("#")
                                          ? tag.color
                                          : `var(--${tag.color}-500, ${tag.color})`,
                                    }}
                                  />
                                  <span className="text-xs font-medium text-foreground truncate">
                                    {tag.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              {/* Show selected tags as badges */}
              {filters.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {filters.tags.map((tagId) => {
                    const tag = allTags.find((t) => t.id === tagId);
                    return (
                      <Badge
                        key={tagId}
                        variant="secondary"
                        className="text-[10px] gap-1 pr-1 cursor-pointer hover:bg-red-100"
                        onClick={() => toggleTag(tagId)}
                      >
                        {tag?.name || `Tag ${tagId}`}
                        <X className="h-2.5 w-2.5" />
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Score Range ── */}
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                Lead Score Range
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={filters.scoreMin}
                  onChange={(e) =>
                    update({
                      scoreMin: Math.max(
                        0,
                        Math.min(100, Number(e.target.value) || 0)
                      ),
                    })
                  }
                  className="h-8 w-16 text-center text-sm"
                />
                <div className="flex-1 px-1">
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[filters.scoreMin, filters.scoreMax]}
                    onValueChange={([min, max]) =>
                      update({ scoreMin: min, scoreMax: max })
                    }
                    className="cursor-pointer"
                  />
                </div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={filters.scoreMax}
                  onChange={(e) =>
                    update({
                      scoreMax: Math.max(
                        0,
                        Math.min(100, Number(e.target.value) || 0)
                      ),
                    })
                  }
                  className="h-8 w-16 text-center text-sm"
                />
              </div>
            </div>

            {/* ── Priority ── */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                Priority
              </Label>
              <Select
                value={filters.priority || "__all__"}
                onValueChange={(v) =>
                  update({ priority: v === "__all__" ? "" : v })
                }
              >
                <SelectTrigger className="h-10 text-sm bg-card border-border">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All priorities</SelectItem>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Date Range ── */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                Created Date Range
              </Label>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 h-10 justify-start text-sm font-normal border-border",
                        !filters.dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {filters.dateFrom
                        ? formatDate(filters.dateFrom)
                        : "From"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dateFrom}
                      onSelect={(d) => update({ dateFrom: d || undefined })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground text-xs">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 h-10 justify-start text-sm font-normal border-border",
                        !filters.dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {filters.dateTo ? formatDate(filters.dateTo) : "To"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dateTo}
                      onSelect={(d) => update({ dateTo: d || undefined })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {(filters.dateFrom || filters.dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-muted-foreground hover:text-red-500 px-1"
                  onClick={() =>
                    update({ dateFrom: undefined, dateTo: undefined })
                  }
                >
                  Clear dates
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        {activeCount > 0 && (
          <div className="border-t border-border px-4 py-2.5 bg-muted/30">
            <div className="text-[10px] text-muted-foreground font-medium">
              {activeCount} filter{activeCount > 1 ? "s" : ""} active
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ─────────── Filter application logic ─────────── */

/**
 * Apply filter state to an array of lead rows (client-side).
 * The lead rows are expected to have the normalized field names from useLeadsData.
 */
export function applyLeadFilters(
  leads: any[],
  filters: LeadFilterState,
  leadTagMap?: Map<number, number[]>
): any[] {
  const { pipelineStage, campaignId, tags, scoreMin, scoreMax, priority, dateFrom, dateTo } = filters;

  // Check if any filter is active
  const hasFilters =
    pipelineStage ||
    campaignId ||
    tags.length > 0 ||
    scoreMin > 0 ||
    scoreMax < 100 ||
    priority ||
    dateFrom ||
    dateTo;

  if (!hasFilters) return leads;

  return leads.filter((lead) => {
    // Pipeline stage (Conversion_Status)
    if (pipelineStage) {
      const status = lead.conversion_status || lead.Conversion_Status || "";
      if (status !== pipelineStage) return false;
    }

    // Campaign
    if (campaignId) {
      const leadCampaignId =
        lead.Campaigns_id ?? lead.campaign_id ?? lead.campaignsId;
      if (String(leadCampaignId) !== campaignId) return false;
    }

    // Tags (if lead has any of the selected tags)
    if (tags.length > 0 && leadTagMap) {
      const leadTagIds = leadTagMap.get(lead.Id || lead.id) || [];
      const hasAnyTag = tags.some((tagId) => leadTagIds.includes(tagId));
      if (!hasAnyTag) return false;
    }

    // Score range
    if (scoreMin > 0 || scoreMax < 100) {
      const score = Number(lead.lead_score ?? lead.leadScore ?? 0);
      if (score < scoreMin || score > scoreMax) return false;
    }

    // Priority
    if (priority) {
      const leadPriority = (lead.priority || "").toLowerCase();
      if (leadPriority !== priority.toLowerCase()) return false;
    }

    // Date range (created_at)
    if (dateFrom || dateTo) {
      const createdStr = lead.created_at || lead.CreatedAt;
      if (!createdStr) return false;
      const created = new Date(createdStr);
      if (isNaN(created.getTime())) return false;

      if (dateFrom) {
        const fromStart = new Date(dateFrom);
        fromStart.setHours(0, 0, 0, 0);
        if (created < fromStart) return false;
      }
      if (dateTo) {
        const toEnd = new Date(dateTo);
        toEnd.setHours(23, 59, 59, 999);
        if (created > toEnd) return false;
      }
    }

    return true;
  });
}
