import { useState } from "react";
import { Lightbulb, RefreshCw, Plus, Sparkles, Loader2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";

interface Offer {
  text: string;
  checked?: boolean;
}

interface ProspectBusinessIdeasProps {
  offerIdeas: string | null | undefined;
  compact?: boolean;
  prospectId?: number;
  onRefresh?: () => void;
  onCheckedChange?: (checked: Offer[]) => void;
}

/** Parse offer_ideas from DB. Handles both old string[] and new {text,checked}[] formats. */
function parseOffers(raw: string | null | undefined): Offer[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 10).map((item: any) =>
      typeof item === "string" ? { text: item, checked: false } : { text: item.text, checked: !!item.checked }
    );
  } catch {
    return raw.split("\n").filter(Boolean).slice(0, 10).map(t => ({ text: t, checked: false }));
  }
}

function serializeOffers(offers: Offer[]): string {
  return JSON.stringify(offers.map(o => ({ text: o.text, checked: o.checked || false })));
}

export function ProspectBusinessIdeas({ offerIdeas, compact, prospectId, onRefresh, onCheckedChange }: ProspectBusinessIdeasProps) {
  const [addingManual, setAddingManual] = useState(false);
  const [newIdea, setNewIdea] = useState("");
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);

  const offers = parseOffers(offerIdeas);

  async function saveOffers(updated: Offer[]) {
    if (!prospectId) return;
    await apiFetch(`/api/prospects/${prospectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offer_ideas: serializeOffers(updated) }),
    });
    onRefresh?.();
  }

  async function toggleCheck(index: number) {
    const updated = offers.map((o, i) => i === index ? { ...o, checked: !o.checked } : o);
    await saveOffers(updated);
    onCheckedChange?.(updated.filter(o => o.checked));
  }

  async function handleRefresh() {
    if (!prospectId || loadingRefresh) return;
    setLoadingRefresh(true);
    try {
      const checked = offers.filter(o => o.checked);
      const uncheckedCount = offers.filter(o => !o.checked).length;
      const countToGenerate = Math.max(uncheckedCount, checked.length === 0 ? 5 : uncheckedCount);
      // Save only checked offers, then generate replacements
      await saveOffers(checked);
      if (countToGenerate > 0) {
        await apiFetch(`/api/prospects/${prospectId}/append-offer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: countToGenerate }),
        });
      }
      onRefresh?.();
    } catch {
      // silent
    } finally {
      setLoadingRefresh(false);
    }
  }

  async function handleDelete(index: number) {
    try {
      await saveOffers(offers.filter((_, i) => i !== index));
    } catch {
      // silent
    }
  }

  async function handleAddManual() {
    if (!prospectId || !newIdea.trim()) return;
    try {
      await saveOffers([...offers, { text: newIdea.trim(), checked: false }]);
      setNewIdea("");
      setAddingManual(false);
    } catch {
      // silent
    }
  }

  async function handleAddAi() {
    if (!prospectId || loadingAi) return;
    setLoadingAi(true);
    try {
      await apiFetch(`/api/prospects/${prospectId}/append-offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: offers.length === 0 ? 5 : 1 }),
      });
      onRefresh?.();
    } catch {
      // silent
    } finally {
      setLoadingAi(false);
    }
  }

  if (offers.length === 0 && !prospectId) {
    return (
      <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-4 px-2" : "py-16 px-5")}>
        <Lightbulb className={cn("text-muted-foreground/20", compact ? "h-6 w-6 mb-1.5" : "h-10 w-10 mb-3")} />
        <p className={cn("font-medium text-foreground/50", compact ? "text-[11px]" : "text-[13px]")}>
          No business ideas yet
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", compact ? "py-1" : "px-5 py-3")}>
      {/* Header buttons */}
      {prospectId && (
        <div className="flex items-center gap-1 mb-2">
          <button
            onClick={handleRefresh}
            disabled={loadingRefresh}
            className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title={offers.some(o => o.checked) ? "Regenerate unchecked offers" : "Regenerate all offers"}
          >
            {loadingRefresh ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => setAddingManual(!addingManual)}
            className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Add manually"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleAddAi}
            disabled={loadingAi}
            className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title={offers.length === 0 ? "Generate 5 AI offers" : "Add 1 AI offer"}
          >
            {loadingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {/* Inline add input */}
      {addingManual && (
        <div className="flex items-center gap-1.5 mb-2">
          <input
            type="text"
            value={newIdea}
            onChange={(e) => setNewIdea(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddManual(); if (e.key === "Escape") setAddingManual(false); }}
            placeholder="Title: description..."
            className="flex-1 h-7 px-2 rounded border border-border bg-background text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          <button
            onClick={handleAddManual}
            disabled={!newIdea.trim()}
            className="h-7 px-2 rounded bg-primary text-primary-foreground text-[11px] font-medium disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}

      {/* Ideas list */}
      {offers.length === 0 ? (
        <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-4 px-2" : "py-8 px-5")}>
          <Lightbulb className={cn("text-muted-foreground/20", compact ? "h-6 w-6 mb-1.5" : "h-10 w-10 mb-3")} />
          <p className={cn("font-medium text-foreground/50", compact ? "text-[11px]" : "text-[13px]")}>
            No business ideas yet
          </p>
        </div>
      ) : (
        offers.map((offer, i) => {
          const [title, ...rest] = offer.text.split(": ");
          const description = rest.join(": ");
          return (
            <div
              key={i}
              className={cn(
                "group relative flex items-start gap-2 w-full p-2 rounded-lg transition-colors",
                offer.checked
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : "bg-muted/40 hover:bg-amber-500/10"
              )}
            >
              {/* Check button */}
              {prospectId && (
                <button
                  onClick={() => toggleCheck(i)}
                  className={cn(
                    "shrink-0 mt-0.5 h-4 w-4 rounded border flex items-center justify-center transition-colors",
                    offer.checked
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "border-border/60 hover:border-foreground/40"
                  )}
                >
                  {offer.checked && <Check className="h-2.5 w-2.5" />}
                </button>
              )}

              {/* Content (click to copy) */}
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => navigator.clipboard.writeText(offer.text)}
              >
                {description ? (
                  <>
                    <span className="text-[12px] font-semibold text-foreground block pr-5">
                      {i + 1}. {title}
                    </span>
                    <span className="text-[11px] text-muted-foreground leading-relaxed">{description}</span>
                  </>
                ) : (
                  <span className="text-[12px] text-foreground leading-relaxed pr-5">{i + 1}. {offer.text}</span>
                )}
              </div>

              {/* Delete */}
              {prospectId && (
                <button
                  onClick={() => handleDelete(i)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all"
                  title="Remove offer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
