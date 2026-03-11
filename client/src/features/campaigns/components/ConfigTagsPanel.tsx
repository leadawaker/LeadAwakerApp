/* ════════════════════════════════════════════════════════════════════════════
   ConfigTagsPanel — compact tags panel for the Configurations tab (col 3)
   ════════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { Plus, Trash2, LayoutTemplate, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ColorPicker } from "@/features/tags/components/ColorPicker";
import { resolveColor } from "@/features/tags/types";
import { useCampaignTags } from "../hooks/useCampaignTags";
import { usePersistedState } from "@/hooks/usePersistedState";

/* ── Types ───────────────────────────────────────────────────────────────── */

type SavedTemplate = { name: string; tags: { name: string; color: string; category: string }[] };

interface EnrichedTagLocal {
  id: number;
  name: string;
  color: string | null;
  category: string | null;
  description: string | null;
  hexColor: string;
  leadCount: number;
}

/* ── Built-in template ───────────────────────────────────────────────────── */

const REACTIVATION_TAG_TEMPLATE: { name: string; color: string; category: string }[] = [
  { name: "First Message Sent",              color: "gray",   category: "automation" },
  { name: "ai stop",                         color: "red",    category: "Automation" },
  { name: "bump 2.1",                        color: "blue",   category: "Automation" },
  { name: "bump 3.1",                        color: "blue",   category: "Automation" },
  { name: "no bump",                         color: "gray",   category: "Automation" },
  { name: "reply generating",                color: "yellow", category: "Automation" },
  { name: "dnd",                             color: "red",    category: "Behavior" },
  { name: "manual takeover",                 color: "orange", category: "Behavior" },
  { name: "appointment booked",              color: "green",  category: "Outcome" },
  { name: "goodbye",                         color: "gray",   category: "Outcome" },
  { name: "no response",                     color: "gray",   category: "Outcome" },
  { name: "schedule",                        color: "green",  category: "Outcome" },
  { name: "high priority",                   color: "red",    category: "Priority" },
  { name: "warm lead",                       color: "orange", category: "Priority" },
  { name: "dbr android",                     color: "purple", category: "Source" },
  { name: "fb lead",                         color: "purple", category: "Source" },
  { name: "sleeping beauty android optin",   color: "purple", category: "Source" },
  { name: "bump 2 reply",                    color: "blue",   category: "Status" },
  { name: "bump 3 reply",                    color: "blue",   category: "Status" },
  { name: "bump response",                   color: "blue",   category: "Status" },
  { name: "first message",                   color: "yellow", category: "Status" },
  { name: "follow-up",                       color: "orange", category: "Status" },
  { name: "lead",                            color: "blue",   category: "Status" },
  { name: "multiple messages",               color: "blue",   category: "Status" },
  { name: "qualify",                         color: "green",  category: "Status" },
  { name: "responded",                       color: "green",  category: "Status" },
  { name: "second message",                  color: "yellow", category: "Status" },
];

/* ── Button style tokens ─────────────────────────────────────────────────── */

const circleBtnBase = "h-7 w-7 rounded-full flex items-center justify-center border transition-colors shrink-0 focus:outline-none";
const circleBtnDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground hover:bg-muted/50";
const circleBtnDestructive = "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20";

/* ── TagChip ─────────────────────────────────────────────────────────────── */

function TagChip({
  tag,
  selected,
  onToggle,
}: {
  tag: EnrichedTagLocal;
  selected: boolean;
  onToggle: (id: number) => void;
}) {
  const tooltipLines: string[] = [];
  if (tag.description) tooltipLines.push(tag.description);
  tooltipLines.push(`${tag.leadCount} Leads`);

  return (
    <div
      role="button"
      title={tooltipLines.join("\n")}
      onClick={() => onToggle(tag.id)}
      className={cn(
        "flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg border cursor-pointer text-[11px] font-medium select-none transition-colors",
        selected
          ? "border-brand-indigo bg-brand-indigo/10 text-brand-indigo"
          : "border-border/50 bg-white/60 dark:bg-white/[0.04] hover:bg-white dark:hover:bg-white/[0.07] text-foreground",
      )}
    >
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.hexColor }} />
      <span className="truncate flex-1">{tag.name}</span>
    </div>
  );
}

/* ── Props ───────────────────────────────────────────────────────────────── */

export interface ConfigTagsPanelProps {
  campaignId: number;
  campaignName: string;
  isAgencyUser: boolean;
  accountId?: number | null;
}

/* ════════════════════════════════════════════════════════════════════════════
   ConfigTagsPanel
   ════════════════════════════════════════════════════════════════════════════ */

export function ConfigTagsPanel({ campaignId, campaignName, isAgencyUser }: ConfigTagsPanelProps) {
  const { tags, tagCounts, loading, handleCreate, handleBulkDelete } = useCampaignTags(campaignId, campaignName);
  const { toast } = useToast();

  /* ── Selection ───────────────────────────────────────────────────────── */
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleSelect = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* ── Add tag ─────────────────────────────────────────────────────────── */
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("blue");
  const [newCategory, setNewCategory] = useState("");

  const submitCreate = async () => {
    if (!newName.trim()) return;
    try {
      await handleCreate({ name: newName.trim(), color: newColor, category: newCategory.trim() || undefined });
      setNewName("");
      setNewColor("blue");
      setNewCategory("");
      setAddOpen(false);
    } catch { /* toast shown by hook */ }
  };

  /* ── Bulk delete ─────────────────────────────────────────────────────── */
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const doDelete = async () => {
    await handleBulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
    setDeleteConfirm(false);
  };

  /* ── Templates ───────────────────────────────────────────────────────── */
  const [savedTemplates, setSavedTemplates] = usePersistedState<SavedTemplate[]>("la:tag-templates", []);
  const [selectedTemplate, setSelectedTemplate] = useState<SavedTemplate | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateApplying, setTemplateApplying] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");

  const handleSelectTemplate = (tpl: SavedTemplate) => {
    setSelectedTemplate(tpl);
    setTemplateDialogOpen(true);
  };

  const applyTemplate = async () => {
    if (!selectedTemplate) return;
    setTemplateApplying(true);
    try {
      let created = 0;
      for (const tag of selectedTemplate.tags) {
        try {
          await handleCreate({ name: tag.name, color: tag.color, category: tag.category });
          created++;
        } catch { /* already exists — skip */ }
      }
      toast({ title: "Template applied", description: `${created} tag(s) created.` });
    } finally {
      setTemplateApplying(false);
      setTemplateDialogOpen(false);
      setSelectedTemplate(null);
    }
  };

  const saveTemplate = () => {
    if (!tags.length || !saveTemplateName.trim()) return;
    const newTpl: SavedTemplate = {
      name: saveTemplateName.trim(),
      tags: tags.map((t) => ({ name: t.name, color: t.color || "blue", category: t.category || "" })),
    };
    setSavedTemplates((prev) => [...prev, newTpl]);
    toast({ title: "Template saved", description: `"${newTpl.name}" saved with ${newTpl.tags.length} tags.` });
    setSaveDialogOpen(false);
    setSaveTemplateName("");
  };

  const deleteTemplate = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedTemplates((prev) => prev.filter((_, i) => i !== index));
  };

  /* ── Enriched + grouped tags ─────────────────────────────────────────── */
  const enrichedTags: EnrichedTagLocal[] = useMemo(
    () =>
      tags.map((t) => ({
        ...t,
        hexColor: resolveColor(t.color),
        leadCount: tagCounts.get(t.name) ?? 0,
      })),
    [tags, tagCounts],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, EnrichedTagLocal[]>();
    for (const tag of enrichedTags) {
      const cat = tag.category || "Uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(tag);
    }
    return Array.from(map.entries()).map(([category, tags]) => ({ category, tags }));
  }, [enrichedTags]);

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <>
      <div className="bg-card/75 rounded-xl flex flex-col overflow-hidden h-full">

        {/* Fixed header */}
        <div className="shrink-0 px-4 md:px-6 pt-4 md:pt-6 pb-3 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tags</span>
          <div className="flex items-center gap-1.5 min-w-0">

            {/* Selection count + clear + trash — shown when items are selected */}
            {selectedIds.size > 0 && (
              <>
                <span className="text-[11px] font-medium text-destructive/80 whitespace-nowrap">
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-muted-foreground/50 hover:text-foreground transition-colors"
                  title="Clear selection"
                >
                  <X className="h-3 w-3" />
                </button>
                <button
                  className={cn(circleBtnBase, circleBtnDestructive)}
                  onClick={() => setDeleteConfirm(true)}
                  title="Delete selected"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            {/* Templates dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(circleBtnBase, circleBtnDefault)} title="Tag templates">
                  <LayoutTemplate className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  className="text-[12px]"
                  disabled={!tags.length}
                  onClick={() => { setSaveTemplateName(campaignName); setSaveDialogOpen(true); }}
                >
                  <Save className="h-3.5 w-3.5 mr-2" />
                  Save as Template
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-[12px]">Apply Template</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52">
                    <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground tracking-wider px-2 py-1">Built-in</DropdownMenuLabel>
                    <DropdownMenuItem
                      className="text-[12px]"
                      onClick={() => handleSelectTemplate({ name: "Reactivation", tags: REACTIVATION_TAG_TEMPLATE })}
                    >
                      Reactivation
                      <span className="ml-auto text-[10px] text-muted-foreground">{REACTIVATION_TAG_TEMPLATE.length}</span>
                    </DropdownMenuItem>
                    {savedTemplates.length > 0 ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground tracking-wider px-2 py-1">Saved</DropdownMenuLabel>
                        {savedTemplates.map((tpl, i) => (
                          <DropdownMenuItem
                            key={`${tpl.name}-${i}`}
                            className="text-[12px]"
                            onClick={() => handleSelectTemplate(tpl)}
                          >
                            <span className="truncate flex-1">{tpl.name}</span>
                            <span className="flex items-center gap-1 ml-2 shrink-0">
                              <span className="text-[10px] text-muted-foreground">{tpl.tags.length}</span>
                              <button
                                className="text-muted-foreground/40 hover:text-red-500 p-0.5 rounded"
                                onClick={(e) => deleteTemplate(i, e)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </>
                    ) : (
                      <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5 text-[11px] text-muted-foreground italic">No saved templates</div>
                      </>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Add tag — agency users only */}
            {isAgencyUser && (
              <Popover open={addOpen} onOpenChange={setAddOpen}>
                <PopoverTrigger asChild>
                  <button className={cn(circleBtnBase, circleBtnDefault)} title="Add tag">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-4 space-y-3">
                  <p className="text-[12px] font-semibold text-foreground">New Tag</p>
                  <input
                    type="text"
                    placeholder="Tag name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitCreate(); }}
                    className="w-full h-9 px-3 text-[12px] rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                    autoFocus
                  />
                  <ColorPicker value={newColor} onChange={setNewColor} />
                  <input
                    type="text"
                    placeholder="Category (optional)"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full h-9 px-3 text-[12px] rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="ghost" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
                    <Button size="sm" onClick={submitCreate} disabled={!newName.trim()}>Create</Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* Scrollable tag list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 pb-4 space-y-3">
          {loading ? (
            <p className="text-[11px] text-muted-foreground mt-2">Loading…</p>
          ) : grouped.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic mt-2">No tags yet.</p>
          ) : (
            grouped.map(({ category, tags: groupTags }) => (
              <div key={category} className="rounded-xl bg-white/80 dark:bg-white/[0.06] p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{category}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {groupTags.map((tag) => (
                    <TagChip key={tag.id} tag={tag} selected={selectedIds.has(tag.id)} onToggle={toggleSelect} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete confirm dialog */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} tag{selectedIds.size !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Apply template confirm */}
      <AlertDialog open={templateDialogOpen} onOpenChange={(open) => { setTemplateDialogOpen(open); if (!open) setSelectedTemplate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply {selectedTemplate?.name} Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create {selectedTemplate?.tags.length ?? 0} tags from the {selectedTemplate?.name} template
              for <span className="font-medium text-foreground">{campaignName}</span>.
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

      {/* Save template dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Tags as Template</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            Save the {tags.length} tags from{" "}
            <span className="font-medium text-foreground">{campaignName}</span> as a reusable template.
          </p>
          <input
            type="text"
            placeholder="Template name"
            value={saveTemplateName}
            onChange={(e) => setSaveTemplateName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveTemplate(); }}
            className="w-full h-9 px-3 text-[12px] rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={saveTemplate} disabled={!saveTemplateName.trim()}>Save Template</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
