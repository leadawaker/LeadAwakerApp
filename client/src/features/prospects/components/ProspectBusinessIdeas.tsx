import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { Lightbulb, RefreshCw, Loader2, X, Check, Pencil, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";

interface Offer {
  text: string;
  checked?: boolean;
}

export interface ProspectBusinessIdeasHandle {
  triggerRefresh: () => void;
  triggerAdd: () => void;
  loadingRefresh: boolean;
  loadingAdd: boolean;
}

interface ProspectBusinessIdeasProps {
  offerIdeas: string | null | undefined;
  compact?: boolean;
  hideHeader?: boolean;
  prospectId?: number;
  onRefresh?: () => void;
  onCheckedChange?: (checked: Offer[]) => void;
}

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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea"); ta.value = text;
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors" title="Copy">
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function ProspectBusinessIdeasInner(
  { offerIdeas, compact, hideHeader, prospectId, onRefresh, onCheckedChange }: ProspectBusinessIdeasProps,
  ref: React.Ref<ProspectBusinessIdeasHandle>
) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [localOffers, setLocalOffers] = useState<Offer[] | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Record<number, boolean>>({});

  useEffect(() => { setLocalOffers(null); }, [offerIdeas]);

  const offers = localOffers ?? parseOffers(offerIdeas);

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
    setLocalOffers(updated);
    onCheckedChange?.(updated.filter(o => o.checked));
    await saveOffers(updated);
  }

  async function handleRefresh() {
    if (!prospectId || loadingRefresh) return;
    setLoadingRefresh(true);
    try {
      const checked = offers.filter(o => o.checked);
      const uncheckedCount = offers.filter(o => !o.checked).length;
      const countToGenerate = Math.max(uncheckedCount, checked.length === 0 ? 5 : uncheckedCount);
      setLocalOffers(checked);
      await apiFetch(`/api/prospects/${prospectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_ideas: serializeOffers(checked) }),
      });
      if (countToGenerate > 0) {
        await apiFetch(`/api/prospects/${prospectId}/append-offer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: countToGenerate }),
        });
      }
      onRefresh?.();
    } catch {} finally { setLoadingRefresh(false); }
  }

  async function handleAdd() {
    if (!prospectId || loadingAdd) return;
    setLoadingAdd(true);
    try {
      await apiFetch(`/api/prospects/${prospectId}/append-offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: offers.length === 0 ? 5 : 1 }),
      });
      onRefresh?.();
    } catch {} finally { setLoadingAdd(false); }
  }

  useImperativeHandle(ref, () => ({
    triggerRefresh: handleRefresh,
    triggerAdd: handleAdd,
    get loadingRefresh() { return loadingRefresh; },
    get loadingAdd() { return loadingAdd; },
  }));

  async function handleDelete(index: number) {
    if (!deleteConfirm[index]) {
      setDeleteConfirm(prev => ({ ...prev, [index]: true }));
      setTimeout(() => setDeleteConfirm(prev => ({ ...prev, [index]: false })), 2000);
      return;
    }
    const updated = offers.filter((_, i) => i !== index);
    setLocalOffers(updated);
    setDeleteConfirm(prev => ({ ...prev, [index]: false }));
    await saveOffers(updated);
  }

  async function handleEditSave(index: number, newText: string) {
    if (!newText.trim()) return;
    const updated = offers.map((o, i) => i === index ? { ...o, text: newText.trim() } : o);
    setLocalOffers(updated);
    setEditingIndex(null);
    await saveOffers(updated);
  }

  if (offers.length === 0 && !prospectId) {
    return (
      <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-4 px-2" : "py-16 px-5")}>
        <Lightbulb className={cn("text-muted-foreground/20", compact ? "h-6 w-6 mb-1.5" : "h-10 w-10 mb-3")} />
        <p className={cn("font-medium text-foreground/50", compact ? "text-[11px]" : "text-[13px]")}>No business ideas yet</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", compact ? "py-1" : "px-5 py-3")}>
      {/* Header: Refresh + Add */}
      {prospectId && !hideHeader && (
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
            onClick={handleAdd}
            disabled={loadingAdd}
            className="inline-flex items-center gap-1 h-6 px-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 text-[11px]"
            title={offers.length === 0 ? "Generate 5 AI offers" : "Add 1 AI offer"}
          >
            {loadingAdd ? <Loader2 className="h-3 w-3 animate-spin" /> : "+ Add"}
          </button>
        </div>
      )}

      {/* Ideas list */}
      {(loadingRefresh || loadingAdd) && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-brand-indigo/5 border border-brand-indigo/20 text-brand-indigo text-[11px] font-medium">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Generating offer ideas{loadingRefresh ? " (this can take 30-60s)" : ""}...</span>
        </div>
      )}
      {offers.length === 0 && !loadingRefresh && !loadingAdd ? (
        <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-4 px-2" : "py-8 px-5")}>
          <Lightbulb className={cn("text-muted-foreground/20", compact ? "h-6 w-6 mb-1.5" : "h-10 w-10 mb-3")} />
          <p className={cn("font-medium text-foreground/50", compact ? "text-[11px]" : "text-[13px]")}>No business ideas yet</p>
        </div>
      ) : offers.length === 0 ? null : (
        offers.map((offer, i) => {
          const [title, ...rest] = offer.text.split(": ");
          const description = rest.join(": ");
          const isEditing = editingIndex === i;
          return (
            <div
              key={i}
              className="group relative w-full p-2 rounded-lg transition-colors border shadow-sm bg-white dark:bg-slate-900 border-border/60 hover:border-foreground/20"
            >
              {/* Top-right actions */}
              {prospectId && !isEditing && (
                <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-900 rounded pl-1 shadow-sm">
                  <CopyButton text={offer.text} />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(i); }}
                    className={cn("h-5 w-5 rounded flex items-center justify-center transition-colors", deleteConfirm[i] ? "bg-destructive/10" : "hover:bg-destructive/10")}
                    title={deleteConfirm[i] ? "Click again to confirm" : "Delete"}
                  >
                    <X className={cn("h-3 w-3 transition-colors", deleteConfirm[i] ? "text-destructive" : "text-muted-foreground/50 hover:text-destructive")} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingIndex(i); setEditingText(offer.text); }}
                    className="h-5 w-5 rounded flex items-center justify-center transition-colors hover:bg-muted"
                    title="Edit"
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground/50 hover:text-brand-indigo" />
                  </button>
                </div>
              )}

              {/* Content */}
              <div
                className={cn("flex items-start gap-2", prospectId && !isEditing && "cursor-pointer")}
                onClick={() => !isEditing && prospectId && toggleCheck(i)}
              >
                {prospectId && !isEditing && (
                  <span className={cn(
                    "shrink-0 mt-0.5 h-4 w-4 rounded border flex items-center justify-center transition-colors",
                    offer.checked ? "bg-brand-indigo border-brand-indigo text-white" : "border-border/60 group-hover:border-foreground/40"
                  )}>
                    {offer.checked && <Check className="h-2.5 w-2.5" />}
                  </span>
                )}
                <div className="flex-1 min-w-0 overflow-hidden" onClick={(e) => isEditing && e.stopPropagation()}>
                  {isEditing ? (
                    <div className="flex flex-col gap-1">
                      <textarea
                        autoFocus
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditingIndex(null);
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSave(i, editingText); }
                        }}
                        rows={3}
                        className="w-full resize-none bg-transparent text-[12px] text-foreground/80 leading-relaxed focus:outline-none focus:ring-1 focus:ring-brand-indigo/40 rounded px-0"
                      />
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditingIndex(null)}
                          className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted"
                          title="Cancel"
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleEditSave(i, editingText)}
                          disabled={!editingText.trim()}
                          className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted disabled:opacity-40"
                          title="Save"
                        >
                          <Check className="h-3 w-3 text-brand-indigo" />
                        </button>
                      </div>
                    </div>
                  ) : description ? (
                    <>
                      <span className="text-[11px] font-normal text-brand-indigo block">{i + 1}. {title}</span>
                      <span className="text-[12px] text-foreground/80 leading-relaxed break-words">{description}</span>
                    </>
                  ) : (
                    <span className="text-[12px] text-foreground/80 leading-relaxed break-words">{i + 1}. {offer.text}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
      {(loadingRefresh || loadingAdd) && (
        <div className="space-y-1.5">
          {Array.from({ length: loadingRefresh ? Math.max(1, 5 - offers.length) : 1 }).map((_, i) => (
            <div key={`skel-${i}`} className="w-full p-2 rounded-lg border border-dashed border-brand-indigo/30 bg-brand-indigo/5 animate-pulse">
              <div className="h-2.5 w-1/3 rounded bg-brand-indigo/20 mb-1.5" />
              <div className="h-2 w-full rounded bg-brand-indigo/10 mb-1" />
              <div className="h-2 w-2/3 rounded bg-brand-indigo/10" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const ProspectBusinessIdeas = forwardRef(ProspectBusinessIdeasInner);
