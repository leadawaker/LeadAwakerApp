import React, { useState, useRef } from "react";
import { ChevronLeft, RefreshCw, FileText, Sparkles } from "lucide-react";
import { ListPanelToggleButton } from "@/components/crm/ListPanelToggleButton";
import type { Campaign } from "@/types/models";
import { cn } from "@/lib/utils";
import { useCampaignDetail } from "../useCampaignDetail";
import { ShareButton } from "./atoms";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiUtils";

interface DetailViewToolbarProps {
  detail: ReturnType<typeof useCampaignDetail>;
  campaign: Campaign;
  activeTab: "summary" | "configurations";
  isEditing: boolean;
  canToggle: boolean;
  isActive: boolean;
  isAgencyUser: boolean;
  gradientTesterOpen: boolean;
  onToggleGradientTester: () => void;
  onBack?: () => void;
  onToggleStatus: (campaign: Campaign) => void;
  onRefresh?: () => void;
  onDuplicate?: (campaign: Campaign) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  promptPanelOpen?: boolean;
  onTogglePromptPanel?: () => void;
  t: any;
  // Legacy props still passed by parent (list controls moved to left panel)
  [key: string]: any;
}

export function DetailViewToolbar({
  detail,
  campaign,
  activeTab,
  onBack,
  onRefresh,
  promptPanelOpen,
  onTogglePromptPanel,
  t,
}: DetailViewToolbarProps) {
  const { toast } = useToast();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [niche, setNiche] = useState("");
  const [generating, setGenerating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    if (!niche.trim() || generating) return;
    setGenerating(true);
    try {
      const id = campaign.id || (campaign as any).Id;
      const res = await apiFetch(`/api/campaigns/${id}/generate-demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: niche.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Generation failed");
      }
      const data = await res.json();
      const filledFields: string[] = data.filledFields ?? [];
      setPopoverOpen(false);
      setNiche("");
      onRefresh?.();
      if (filledFields.length === 0) {
        toast({ title: "Nothing to fill", description: "All fields already have values — clear them first to regenerate." });
      } else {
        toast({ title: "Fields filled", description: filledFields.join(", ") });
      }
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const isDemo = (campaign as any).is_demo || (campaign as any).isDemo;

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {onBack && (
        <button onClick={onBack} className="md:hidden h-9 w-9 rounded-full border border-black/[0.125] bg-background grid place-items-center shrink-0 mr-1">
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {/* Utility icons — kept small, left of the prominent actions */}
      <ListPanelToggleButton />

      {onTogglePromptPanel && (
        <button
          onClick={onTogglePromptPanel}
          className={cn("h-9 w-9 rounded-full border grid place-items-center shrink-0 transition-colors", promptPanelOpen ? "border-brand-indigo text-brand-indigo" : "border-black/[0.125] text-foreground/60 hover:text-foreground")}
          title="Prompt Editor"
        >
          <FileText className="h-4 w-4" />
        </button>
      )}

      {detail.saving && (
        <span className="inline-flex items-center gap-1.5 h-9 px-2 text-[12px] text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          {t("toolbar.saving")}
        </span>
      )}

      {/* Share — WhatsApp / Telegram demo links (demo campaigns only) */}
      {isDemo && <ShareButton campaign={campaign} />}

      {/* Generate — fills only empty fields. Settings (configurations) tab only. */}
      {activeTab === "configurations" && (
      <Popover open={popoverOpen} onOpenChange={(v) => { setPopoverOpen(v); if (v) setTimeout(() => inputRef.current?.focus(), 50); }}>
        <PopoverTrigger asChild>
          <button className="btn-wine" style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", fontSize: 13, fontWeight: 600 }}>
            <Sparkles className="h-4 w-4 shrink-0" />
            {t("toolbar.generate", "Generate")}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          <p className="text-[11px] text-muted-foreground mb-2">{t("toolbar.generateHint", "Type a niche and AI fills only the empty fields.")}</p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={niche}
              onChange={e => setNiche(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleGenerate(); }}
              placeholder="e.g. dental clinic, solar, gym"
              className="flex-1 h-8 rounded-md border border-black/[0.125] bg-background px-2.5 text-[12px] outline-none focus:border-brand-indigo transition-colors"
            />
            <button
              onClick={handleGenerate}
              disabled={!niche.trim() || generating}
              className="h-8 w-8 rounded-full bg-brand-indigo text-white disabled:opacity-50 hover:bg-brand-indigo/90 transition-colors flex items-center justify-center shrink-0"
              title="Generate"
            >
              {generating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            </button>
          </div>
        </PopoverContent>
      </Popover>
      )}
    </div>
  );
}
