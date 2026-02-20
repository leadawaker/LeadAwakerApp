import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowRightLeft,
  Tag,
  Megaphone,
  X,
  Loader2,
  Check,
} from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { bulkUpdateLeads, bulkTagLeads } from "../api/leadsApi";
import { useToast } from "@/hooks/use-toast";

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

interface TagOption {
  id: number;
  name: string;
  color: string | null;
  category: string | null;
}

interface CampaignOption {
  id: number;
  name: string;
}

interface BulkActionsToolbarProps {
  selectedIds: number[];
  onClearSelection: () => void;
  onActionComplete: () => void;
}

export function BulkActionsToolbar({
  selectedIds,
  onClearSelection,
  onActionComplete,
}: BulkActionsToolbarProps) {
  const { toast } = useToast();
  const [tags, setTags] = useState<TagOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);

  // Fetch tags and campaigns for the dropdowns
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [tagsRes, campaignsRes] = await Promise.all([
          apiFetch("/api/tags"),
          apiFetch("/api/campaigns"),
        ]);
        if (tagsRes.ok) {
          const data = await tagsRes.json();
          const tagList = (Array.isArray(data) ? data : []).map((t: any) => ({
            id: t.id || t.Id,
            name: t.name || t.Name || t.tag_name || "Unnamed",
            color: t.color || t.Color || null,
            category: t.category || t.Category || null,
          }));
          setTags(tagList);
        }
        if (campaignsRes.ok) {
          const data = await campaignsRes.json();
          const campList = (Array.isArray(data) ? data : []).map((c: any) => ({
            id: c.id || c.Id,
            name: c.name || c.Name || c.campaign_name || "Unnamed",
          }));
          setCampaigns(campList);
        }
      } catch (err) {
        console.error("Failed to fetch bulk action options", err);
      }
    };
    fetchOptions();
  }, []);

  if (selectedIds.length === 0) return null;

  const handleMoveStage = async (stage: string) => {
    setLoadingAction("stage");
    try {
      await bulkUpdateLeads(selectedIds, { Conversion_Status: stage });
      toast({
        title: "Stage Updated",
        description: `Moved ${selectedIds.length} lead(s) to "${stage}"`,
      });
      onActionComplete();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: err.message || "Could not update leads",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleApplyTags = async () => {
    if (selectedTagIds.length === 0) return;
    setLoadingAction("tag");
    try {
      const result = await bulkTagLeads(selectedIds, selectedTagIds);
      toast({
        title: "Tags Applied",
        description: result.message || `Applied tags to ${selectedIds.length} lead(s)`,
      });
      setSelectedTagIds([]);
      setTagPopoverOpen(false);
      onActionComplete();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Tag Failed",
        description: err.message || "Could not apply tags",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAssignCampaign = async (campaignId: number) => {
    setLoadingAction("campaign");
    try {
      await bulkUpdateLeads(selectedIds, { Campaigns_id: campaignId });
      const campaignName = campaigns.find((c) => c.id === campaignId)?.name || "campaign";
      toast({
        title: "Campaign Assigned",
        description: `Assigned ${selectedIds.length} lead(s) to "${campaignName}"`,
      });
      onActionComplete();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Assignment Failed",
        description: err.message || "Could not assign campaign",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  // Group tags by category
  const tagsByCategory = tags.reduce((acc, tag) => {
    const cat = tag.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tag);
    return acc;
  }, {} as Record<string, TagOption[]>);

  const isLoading = loadingAction !== null;

  return (
    <div
      className="flex items-center gap-2 flex-wrap"
      data-testid="bulk-actions-toolbar"
    >
      {/* Selection count */}
      <Badge className="h-7 px-3 bg-brand-blue hover:bg-brand-blue/90 text-brand-blue-foreground text-sm font-semibold rounded-full">
        {selectedIds.length} selected
      </Badge>

      {/* Clear selection */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={onClearSelection}
      >
        Clear
      </Button>

      <div className="h-5 w-px bg-border mx-1" />

      {/* Move Stage dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 rounded-xl text-sm font-medium gap-1.5 shadow-none"
            disabled={isLoading}
            data-testid="bulk-move-stage"
          >
            {loadingAction === "stage" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRightLeft className="h-3.5 w-3.5" />
            )}
            Move Stage
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Move to Stage</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PIPELINE_STAGES.map((stage) => (
            <DropdownMenuItem
              key={stage}
              onClick={() => handleMoveStage(stage)}
              className="cursor-pointer"
            >
              {stage}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Tag popover */}
      <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 rounded-xl text-sm font-medium gap-1.5 shadow-none"
            disabled={isLoading}
            data-testid="bulk-tag"
          >
            {loadingAction === "tag" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Tag className="h-3.5 w-3.5" />
            )}
            Tag
            {selectedTagIds.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] rounded-full">
                {selectedTagIds.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <div className="p-3 border-b">
            <h4 className="font-semibold text-sm">Apply Tags</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select tags to apply to {selectedIds.length} lead(s)
            </p>
          </div>
          <div className="max-h-60 overflow-y-auto p-2">
            {Object.entries(tagsByCategory).map(([category, categoryTags]) => (
              <div key={category} className="mb-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
                  {category}
                </div>
                {categoryTags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={selectedTagIds.includes(tag.id)}
                      onCheckedChange={() => toggleTag(tag.id)}
                    />
                    {tag.color && (
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                    )}
                    <span className="truncate">{tag.name}</span>
                  </label>
                ))}
              </div>
            ))}
            {tags.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No tags available
              </p>
            )}
          </div>
          {selectedTagIds.length > 0 && (
            <div className="p-2 border-t flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-8 rounded-lg text-sm font-medium gap-1.5"
                onClick={handleApplyTags}
                disabled={loadingAction === "tag"}
              >
                {loadingAction === "tag" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Apply {selectedTagIds.length} Tag{selectedTagIds.length > 1 ? "s" : ""}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => setSelectedTagIds([])}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Assign Campaign dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 rounded-xl text-sm font-medium gap-1.5 shadow-none"
            disabled={isLoading}
            data-testid="bulk-assign-campaign"
          >
            {loadingAction === "campaign" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Megaphone className="h-3.5 w-3.5" />
            )}
            Assign Campaign
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Assign to Campaign</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {campaigns.map((campaign) => (
            <DropdownMenuItem
              key={campaign.id}
              onClick={() => handleAssignCampaign(campaign.id)}
              className="cursor-pointer"
            >
              {campaign.name}
            </DropdownMenuItem>
          ))}
          {campaigns.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              No campaigns available
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
