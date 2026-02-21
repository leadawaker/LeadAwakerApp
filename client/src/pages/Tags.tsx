import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { apiFetch } from "@/lib/apiUtils";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkeletonCardGrid } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Check, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Map color name strings (from DB) to hex values
const COLOR_MAP: Record<string, string> = {
  blue:   "#3B82F6",
  green:  "#22C55E",
  red:    "#EF4444",
  yellow: "#EAB308",
  orange: "#F97316",
  purple: "#A855F7",
  gray:   "#64748B",
  grey:   "#64748B",
  pink:   "#EC4899",
  teal:   "#14B8A6",
  cyan:   "#06B6D4",
  indigo: "#6366F1",
};

function resolveColor(color: string | null | undefined): string {
  if (!color) return "#64748B";
  // Already a hex value
  if (color.startsWith("#")) return color;
  // Named color
  return COLOR_MAP[color.toLowerCase()] ?? "#64748B";
}

// Visual color picker component — a popover grid of colored swatches
const COLOR_PALETTE = Object.entries(COLOR_MAP).filter(([k]) => k !== "grey");

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  "data-testid"?: string;
}

function ColorPicker({ value, onChange, "data-testid": testId }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const hex = resolveColor(value);
  const label = value.charAt(0).toUpperCase() + value.slice(1);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testId}
          className="flex items-center gap-2 w-full h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label={`Selected color: ${label}`}
        >
          <span
            className="inline-block h-4 w-4 rounded-full shrink-0 shadow-sm ring-1 ring-black/10"
            style={{ backgroundColor: hex }}
          />
          <span className="flex-1 text-left">{label}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-3"
        align="start"
        data-testid={testId ? `${testId}-popover` : undefined}
      >
        <div className="mb-2 text-xs font-medium text-muted-foreground">Choose a color</div>
        <div className="grid grid-cols-5 gap-2">
          {COLOR_PALETTE.map(([colorName, colorHex]) => {
            const isSelected = value === colorName;
            return (
              <button
                key={colorName}
                type="button"
                title={colorName.charAt(0).toUpperCase() + colorName.slice(1)}
                data-testid={testId ? `${testId}-swatch-${colorName}` : undefined}
                onClick={() => {
                  onChange(colorName);
                  setOpen(false);
                }}
                className={cn(
                  "relative h-8 w-8 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1",
                  isSelected && "ring-2 ring-offset-2 ring-foreground scale-110"
                )}
                style={{ backgroundColor: colorHex }}
              >
                {isSelected && (
                  <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-sm" />
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-xs text-center text-muted-foreground capitalize font-medium">
          {label}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface Tag {
  id: number;
  name: string;
  color: string | null;
  category: string | null;
  description: string | null;
  auto_applied?: boolean;
  account_id?: number | null;
  Accounts_id?: number | null;
  count?: number;
}

interface GroupedCategory {
  type: string;
  tags: (Tag & { count: number; hexColor: string })[];
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [q, setQ] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [campaignId, setCampaignId] = useState<string>("all");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");

  // Create Tag dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createColor, setCreateColor] = useState("blue");
  const [createCategory, setCreateCategory] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit Tag dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("blue");
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tagsRes, leadsRes, campaignsRes, accountsRes] = await Promise.all([
        apiFetch("/api/tags"),
        apiFetch("/api/leads"),
        apiFetch("/api/campaigns"),
        apiFetch("/api/accounts"),
      ]);

      if (!tagsRes.ok) {
        throw new Error(`${tagsRes.status}: Failed to fetch tags`);
      }

      const tagsData = await tagsRes.json();
      const leadsData = leadsRes.ok ? await leadsRes.json() : [];
      const campaignsData = campaignsRes.ok ? await campaignsRes.json() : [];
      const accountsData = accountsRes.ok ? await accountsRes.json() : [];

      setTags(Array.isArray(tagsData) ? tagsData.filter((t: Tag) => t.name) : []);
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setCampaigns(Array.isArray(campaignsData) ? campaignsData : []);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
    } catch (err) {
      console.error("Failed to fetch tags data:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter leads by account and campaign
  const filteredLeads = useMemo(() => {
    return leads
      .filter((l: any) => {
        if (selectedAccountId === "all") return true;
        const accountId = l.account_id ?? l.accounts_id ?? l.Accounts_id;
        return String(accountId) === selectedAccountId;
      })
      .filter((l: any) => {
        if (campaignId === "all") return true;
        const cId = l.campaign_id ?? l.campaigns_id ?? l.Campaigns_id;
        return String(cId) === campaignId;
      });
  }, [leads, selectedAccountId, campaignId]);

  // Campaign options scoped to selected account
  const campaignOptions = useMemo(() => {
    return campaigns.filter((c: any) => {
      if (selectedAccountId === "all") return true;
      const accountId = c.account_id ?? c.accounts_id ?? c.Accounts_id;
      return String(accountId) === selectedAccountId;
    });
  }, [campaigns, selectedAccountId]);

  // Count leads per tag name
  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    filteredLeads.forEach((l: any) => {
      const rawTags = l.tags ?? l.Tags ?? [];
      if (Array.isArray(rawTags)) {
        rawTags.forEach((t: string) => {
          if (t) map.set(t, (map.get(t) ?? 0) + 1);
        });
      }
    });
    return map;
  }, [filteredLeads]);

  // Group real API tags by category
  const groupedCategories = useMemo((): GroupedCategory[] => {
    const categoryMap = new Map<string, (Tag & { count: number; hexColor: string })[]>();

    tags.forEach((tag) => {
      const categoryKey = tag.category
        ? tag.category.charAt(0).toUpperCase() + tag.category.slice(1)
        : "Uncategorized";

      // Apply search filter
      if (q && !tag.name!.toLowerCase().includes(q.toLowerCase())) return;

      const enriched = {
        ...tag,
        count: tagCounts.get(tag.name!) ?? 0,
        hexColor: resolveColor(tag.color),
      };

      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, []);
      }
      categoryMap.get(categoryKey)!.push(enriched);
    });

    // Sort categories alphabetically, tags within each by name
    return Array.from(categoryMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, catTags]) => ({
        type,
        tags: catTags.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
      }));
  }, [tags, tagCounts, q]);

  const selectedTag = useMemo(
    () => (selectedTagId != null ? tags.find((t) => t.id === selectedTagId) ?? null : null),
    [selectedTagId, tags]
  );

  const selectedLeads = useMemo(() => {
    if (!selectedTag) return [];
    return filteredLeads.filter((l: any) => {
      const rawTags = l.tags ?? l.Tags ?? [];
      return Array.isArray(rawTags) && rawTags.includes(selectedTag.name!);
    });
  }, [selectedTag, filteredLeads]);

  const handleCreateTag = useCallback(async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const payload: Record<string, any> = {
        name: createName.trim(),
        color: createColor,
      };
      if (createCategory.trim()) payload.category = createCategory.trim();
      if (createDescription.trim()) payload.description = createDescription.trim();

      const res = await apiFetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${res.status}: ${errText}`);
      }

      const newTag = await res.json();
      // Optimistically add to local tags list
      setTags((prev) => [...prev, newTag]);
      toast({ title: "Tag created", description: `"${newTag.name ?? createName}" was added successfully.` });

      // Reset form and close dialog
      setCreateName("");
      setCreateColor("blue");
      setCreateCategory("");
      setCreateDescription("");
      setCreateDialogOpen(false);
    } catch (err) {
      console.error("Failed to create tag:", err);
      toast({ title: "Error", description: `Failed to create tag: ${err instanceof Error ? err.message : String(err)}`, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }, [createName, createColor, createCategory, createDescription, toast]);

  // Open edit dialog pre-populated with tag data
  const openEditDialog = useCallback((tag: Tag, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't select tag when clicking edit
    setEditingTag(tag);
    setEditName(tag.name ?? "");
    setEditColor(tag.color ?? "blue");
    setEditCategory(tag.category ?? "");
    setEditDescription(tag.description ?? "");
    setEditDialogOpen(true);
  }, []);

  const handleEditTag = useCallback(async () => {
    if (!editingTag || !editName.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: editName.trim(),
        color: editColor,
        category: editCategory.trim() || null,
        description: editDescription.trim() || null,
      };

      const res = await apiFetch(`/api/tags/${editingTag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${res.status}: ${errText}`);
      }

      const updatedTag = await res.json();
      // Update local tags list optimistically
      setTags((prev) =>
        prev.map((t) => (t.id === editingTag.id ? { ...t, ...updatedTag } : t))
      );
      toast({ title: "Tag updated", description: `"${updatedTag.name ?? editName}" was updated successfully.` });
      setEditDialogOpen(false);
      setEditingTag(null);
    } catch (err) {
      console.error("Failed to update tag:", err);
      toast({ title: "Error", description: `Failed to update tag: ${err instanceof Error ? err.message : String(err)}`, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [editingTag, editName, editColor, editCategory, editDescription, toast]);

  if (error && tags.length === 0 && !loading) {
    return (
      <CrmShell>
        <ApiErrorFallback error={error} onRetry={fetchData} isRetrying={loading} />
      </CrmShell>
    );
  }

  if (loading) {
    return (
      <CrmShell>
        <div className="py-4 px-1">
          <SkeletonCardGrid count={9} columns="grid-cols-1 md:grid-cols-2 xl:grid-cols-3" />
        </div>
      </CrmShell>
    );
  }

  return (
    <CrmShell>
      <div className="py-4" data-testid="tags-page">
        <div className="flex flex-col gap-4">
          {/* TOP SEARCH & FILTERS */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-1 gap-2 items-center w-full">
              <input
                data-testid="input-search-tags"
                className="h-10 flex-1 max-w-md rounded-xl border border-border bg-card px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="Search tags…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Select
                value={selectedAccountId}
                onValueChange={(v) => {
                  setSelectedAccountId(v);
                  setCampaignId("all");
                }}
              >
                <SelectTrigger
                  data-testid="select-account-filter"
                  className="w-[180px] h-10 rounded-xl bg-card"
                >
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map((acc: any) => (
                    <SelectItem key={acc.id} value={String(acc.id)}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger
                  data-testid="select-campaign-filter"
                  className="w-[180px] h-10 rounded-xl bg-card"
                >
                  <SelectValue placeholder="All Campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  {campaignOptions.map((c: any) => (
                    <SelectItem key={c.id ?? c.Id} value={String(c.id ?? c.Id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {tags.filter((t) => t.name).length} tags in {groupedCategories.length} categories
              </div>
              <Button
                data-testid="button-create-tag"
                size="sm"
                className="gap-1.5"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Create Tag
              </Button>
            </div>
          </div>

          {/* ─── CREATE TAG DIALOG ─── */}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent data-testid="dialog-create-tag" className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Tag</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tag-name">Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="tag-name"
                    data-testid="input-tag-name"
                    placeholder="e.g. hot-lead"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !creating) handleCreateTag(); }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tag-color">Color</Label>
                  <ColorPicker
                    value={createColor}
                    onChange={setCreateColor}
                    data-testid="color-picker-create"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tag-category">Category</Label>
                  <Input
                    id="tag-category"
                    data-testid="input-tag-category"
                    placeholder="e.g. Status, Behavior, Source"
                    value={createCategory}
                    onChange={(e) => setCreateCategory(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tag-description">Description</Label>
                  <Textarea
                    id="tag-description"
                    data-testid="input-tag-description"
                    placeholder="Brief description of this tag…"
                    rows={3}
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                  />
                </div>
                {/* Live color preview */}
                {createName.trim() && (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/10">
                    <div
                      className="h-8 w-8 rounded-full text-[11px] font-bold flex items-center justify-center text-white shrink-0 shadow-sm"
                      style={{ backgroundColor: resolveColor(createColor) }}
                    >
                      0
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{createName}</div>
                      {createCategory && (
                        <div className="text-xs text-muted-foreground capitalize">{createCategory}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={creating}>
                  Cancel
                </Button>
                <Button
                  data-testid="button-submit-create-tag"
                  onClick={handleCreateTag}
                  disabled={!createName.trim() || creating}
                >
                  {creating ? "Creating…" : "Create Tag"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ─── EDIT TAG DIALOG ─── */}
          <Dialog open={editDialogOpen} onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditingTag(null);
          }}>
            <DialogContent data-testid="dialog-edit-tag" className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Tag</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-tag-name">Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="edit-tag-name"
                    data-testid="input-edit-tag-name"
                    placeholder="e.g. hot-lead"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !saving) handleEditTag(); }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-tag-color">Color</Label>
                  <ColorPicker
                    value={editColor}
                    onChange={setEditColor}
                    data-testid="color-picker-edit"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-tag-category">Category</Label>
                  <Input
                    id="edit-tag-category"
                    data-testid="input-edit-tag-category"
                    placeholder="e.g. Status, Behavior, Source"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-tag-description">Description</Label>
                  <Textarea
                    id="edit-tag-description"
                    data-testid="input-edit-tag-description"
                    placeholder="Brief description of this tag…"
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>
                {/* Live color preview */}
                {editName.trim() && (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/10">
                    <div
                      className="h-8 w-8 rounded-full text-[11px] font-bold flex items-center justify-center text-white shrink-0 shadow-sm"
                      style={{ backgroundColor: resolveColor(editColor) }}
                    >
                      {editingTag ? (tagCounts.get(editingTag.name!) ?? 0) : 0}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{editName}</div>
                      {editCategory && (
                        <div className="text-xs text-muted-foreground capitalize">{editCategory}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  data-testid="button-submit-edit-tag"
                  onClick={handleEditTag}
                  disabled={!editName.trim() || saving}
                >
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {groupedCategories.length === 0 ? (
            <DataEmptyState
              variant="search"
              title="No tags found"
              description={q ? `No tags match "${q}"` : "No tags available."}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 items-start">
              {/* LEFT — TAG GROUPS */}
              <div className="space-y-8">
                {groupedCategories.map((cat) => (
                  <div
                    key={cat.type}
                    className="space-y-3"
                    data-testid={`tag-category-${cat.type.toLowerCase()}`}
                  >
                    <h3 className="inline-flex items-center px-3 py-1.5 rounded-lg bg-muted/15 dark:bg-muted/8 glass-surface text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {cat.type}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 bg-card p-4 rounded-2xl shadow-sm border border-border">
                      {cat.tags.map((t) => (
                        <div
                          key={t.id}
                          className={cn(
                            "relative group flex items-center gap-3 px-3 py-2 rounded-xl transition text-left border border-transparent cursor-pointer",
                            selectedTagId === t.id
                              ? "ring-2 ring-primary bg-card"
                              : "hover:bg-muted/5"
                          )}
                          style={{ backgroundColor: `${t.hexColor}08` }}
                          data-testid={`tag-item-${t.id}`}
                          onClick={() => setSelectedTagId(t.id === selectedTagId ? null : t.id)}
                          title={t.description ?? t.name ?? undefined}
                        >
                          {/* Color dot + count badge */}
                          <div
                            className="h-7 w-7 rounded-full text-[11px] font-bold flex items-center justify-center text-white shrink-0 shadow-sm"
                            style={{ backgroundColor: t.hexColor }}
                          >
                            {t.count}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div
                              data-testid={`tag-name-${t.id}`}
                              className="truncate font-semibold text-[13px] text-foreground leading-tight"
                            >
                              {t.name}
                            </div>
                            {t.description && (
                              <div className="truncate text-[10px] text-muted-foreground mt-0.5">
                                {t.description}
                              </div>
                            )}
                          </div>

                          {/* Edit button — visible on hover */}
                          <button
                            data-testid={`button-edit-tag-${t.id}`}
                            onClick={(e) => openEditDialog(t, e)}
                            className="opacity-0 group-hover:opacity-100 absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-opacity"
                            title={`Edit tag "${t.name}"`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* RIGHT — STICKY SIDE PANEL */}
              <div className="space-y-4 sticky top-6">
                <div className="bg-card rounded-2xl shadow-sm border border-border flex flex-col max-h-[calc(100vh-200px)]">
                  <div className="p-4 border-b space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm" data-testid="side-panel-title">
                        {selectedTag ? `Leads: ${selectedTag.name}` : "Tag Insights"}
                      </div>
                      {selectedTag && (
                        <button
                          data-testid="button-edit-selected-tag"
                          onClick={(e) => openEditDialog(selectedTag, e)}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
                          title={`Edit tag "${selectedTag.name}"`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {selectedTag?.description && (
                      <div
                        className="text-xs text-muted-foreground"
                        data-testid="side-panel-description"
                      >
                        {selectedTag.description}
                      </div>
                    )}
                    {selectedTag && (
                      <div className="flex items-center gap-2 pt-1">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: resolveColor(selectedTag.color) }}
                        />
                        <span className="text-[11px] font-medium text-muted-foreground capitalize">
                          {selectedTag.category ?? "Uncategorized"}
                        </span>
                        {selectedTag.auto_applied && (
                          <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                            Auto
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="overflow-y-auto divide-y" data-testid="side-panel-leads">
                    {!selectedTag ? (
                      <DataEmptyState
                        variant="tags"
                        title="Tag Insights"
                        description="Click a tag to see associated leads and their details."
                        compact
                      />
                    ) : selectedLeads.length === 0 ? (
                      <DataEmptyState
                        variant="search"
                        title="No leads found"
                        description="No leads are associated with this tag yet."
                        compact
                      />
                    ) : (
                      selectedLeads.map((l: any) => {
                        const leadName =
                          l.full_name_1 ?? l.full_name ?? l.name ?? l.Name ?? "Unnamed Lead";
                        const lastMsg =
                          l.last_message_sent_at ?? l.Last_Message_Sent_At;
                        return (
                          <div
                            key={l.id ?? l.Id}
                            className="p-4 hover:bg-muted/10"
                            data-testid={`lead-item-${l.id ?? l.Id}`}
                          >
                            <div className="font-semibold text-sm truncate">{leadName}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {l.phone ?? l.Phone ?? l.whatsapp_number ?? ""}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Last message:{" "}
                              {lastMsg
                                ? new Date(lastMsg).toLocaleDateString()
                                : "No messages yet"}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </CrmShell>
  );
}
