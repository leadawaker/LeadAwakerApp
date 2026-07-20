import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, X, Plus, Sparkles } from "lucide-react";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { apiFetch } from "@/lib/apiUtils";
import { resolveNicheIcon } from "@/features/prompts/components/niche/nicheShared";
import { useToast } from "@/hooks/use-toast";

export function NicheSelect({
  value, campaign, onChange, onNicheChange, autoFocus,
}: {
  value: string;
  campaign: any;
  onChange: (v: string) => void;
  onNicheChange?: (niche: string) => void;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation("campaigns");
  const { toast } = useToast();
  const [niches, setNiches] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [creating, setCreating] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [newNiche, setNewNiche] = useState("");

  const loadNiches = useCallback(() => {
    return apiFetch("/api/niches")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fetch failed"))))
      .then((data: string[]) => {
        setNiches(Array.isArray(data) ? data : []);
        setStatus("ready");
        return data as string[];
      })
      .catch(() => {
        setNiches([]);
        setStatus("error");
        toast({ title: t("config.nicheLoadError"), variant: "destructive" });
        return [] as string[];
      });
  }, [t, toast]);

  useEffect(() => { loadNiches(); }, [loadNiches]);

  const applyNiche = useCallback(async (niche: string) => {
    onChange(niche);
    onNicheChange?.(niche);
    // Fill empty Business/AI fields bilingually via the existing endpoint.
    try {
      const id = campaign?.id || campaign?.Id;
      const res = await apiFetch(`/api/campaigns/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche }),
      });
      if (res.ok) {
        const data = await res.json();
        const filled: string[] = data.filledFields ?? [];
        const translated: string[] = data.translatedFields ?? [];
        if (filled.length || translated.length) {
          toast({ title: t("toolbar.done", "Done"), description: [...filled, ...translated].join(", ") });
        }
      }
    } catch { /* field fill is best-effort */ }
  }, [campaign, onChange, onNicheChange, t, toast]);

  const handleCreate = useCallback(async () => {
    const name = newNiche.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await apiFetch("/api/niche-vocabulary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Generation failed");
      }
      const data = await res.json();
      await loadNiches();
      setShowInput(false);
      setNewNiche("");
      if (data.warnings?.length) {
        toast({ title: t("niche.createdWithGaps", "Niche created"), description: t("niche.someFieldsEmpty", "Some fields came back empty and use defaults."), });
      } else {
        toast({ title: t("niche.created", "Niche created") });
      }
      await applyNiche(data.niche);
    } catch (err: any) {
      toast({ title: t("niche.createFailed", "Could not create niche"), description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }, [newNiche, creating, loadNiches, applyNiche, t, toast]);

  const handleDelete = useCallback(async (niche: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm(t("niche.confirmDelete", { niche, defaultValue: `Delete niche "${niche}"?` }))) return;
    try {
      const res = await apiFetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}`, { method: "DELETE" });
      if (res.status === 409) {
        const data = await res.json();
        const names = (data.campaigns ?? []).map((c: any) => c.name).join(", ");
        toast({ title: t("niche.inUse", "Niche in use"), description: names, variant: "destructive" });
        return;
      }
      if (!res.ok) throw new Error("delete failed");
      await loadNiches();
      toast({ title: t("niche.deleted", "Niche deleted") });
    } catch (err: any) {
      toast({ title: t("niche.deleteFailed", "Could not delete niche"), description: err.message, variant: "destructive" });
    }
  }, [loadNiches, t, toast]);

  const CurIcon = value ? resolveNicheIcon(value, false) : null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="la-input" autoFocus={autoFocus}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", gap: 8, boxSizing: "border-box", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, overflow: "hidden" }}>
          {status === "loading" && <Loader2 style={{ width: 14, height: 14, flexShrink: 0 }} className="animate-spin" />}
          {CurIcon && <CurIcon style={{ width: 14, height: 14, color: "var(--wine)", flexShrink: 0 }} />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || t("config.selectNichePlaceholder")}</span>
        </div>
      </SelectTrigger>
      <SelectContent>
        {niches.map((niche) => {
          const Icon = resolveNicheIcon(niche, false);
          return (
            <SelectItem key={niche} value={niche} className="group">
              <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                <Icon style={{ width: 14, height: 14, color: "var(--wine)", flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{niche}</span>
                <button
                  // Radix's SelectItem fires selection on pointerup (for mouse) before
                  // this button's onClick ever runs — stopPropagation in onClick alone
                  // is too late. Intercept at the pointer level so the item is never
                  // selected/closed when deleting.
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={(e) => handleDelete(niche, e)}
                  className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                  style={{ border: "none", background: "transparent", cursor: "pointer", padding: 2, display: "grid", placeItems: "center" }}
                  title={t("niche.delete", "Remove niche")}
                  aria-label={t("niche.delete", "Remove niche")}
                >
                  <X style={{ width: 13, height: 13, color: "var(--mute)" }} />
                </button>
              </div>
            </SelectItem>
          );
        })}

        {/* Inline create row — not a SelectItem so clicks don't select a value. */}
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 4, paddingTop: 4 }}>
          {showInput ? (
            <div style={{ display: "flex", gap: 6, padding: "4px 6px" }} onKeyDown={(e) => e.stopPropagation()}>
              <input
                autoFocus
                value={newNiche}
                onChange={(e) => setNewNiche(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                placeholder={t("niche.newPlaceholder", "e.g. Dentists")}
                className="flex-1 h-8 rounded-md border border-black/[0.125] bg-background px-2.5 text-[12px] outline-none focus:border-brand-indigo"
              />
              <button
                onClick={handleCreate}
                disabled={!newNiche.trim() || creating}
                className="h-8 px-2 rounded-md bg-brand-indigo text-white disabled:opacity-50 flex items-center gap-1 text-[11px] shrink-0"
                title={t("niche.create", "Create")}
              >
                {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {creating ? t("niche.creating", "Creating…") : t("niche.create", "Create")}
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowInput(true); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 8px", border: "none", background: "transparent", cursor: "pointer", color: "var(--wine)", fontSize: 13 }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              {t("niche.new", "New niche…")}
            </button>
          )}
        </div>
      </SelectContent>
    </Select>
  );
}
