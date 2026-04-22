import { useRef, useState, useEffect, useCallback } from "react";
import { ArrowLeft, Camera, ChevronRight, Paintbrush } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check } from "lucide-react";
import {
  ProspectRow,
  INLINE_PRIORITY_OPTIONS,
  getProspectId,
} from "./prospectTypes";
import { SignalBars } from "./ProspectListCards";
import { OUTREACH_HEX, OUTREACH_LABELS, OUTREACH_STATUSES, type OutreachStatus } from "./OutreachPipelineView";
import { ProspectAvatar } from "./ProspectAvatar";
import { ListPanelToggleButton } from "@/components/crm/ListPanelToggleButton";

interface ProspectDetailHeaderProps {
  selectedProspect: ProspectRow;
  onSave: (field: string, value: string) => Promise<void>;
  onToggleFilterNiche: (s: string) => void;
  getNicheColor: (niche: string) => { hex: string; bg: string; text: string };
  isNarrow: boolean;
  onSelectProspect: (v: ProspectRow | null) => void;
  gradientTesterOpen: boolean;
  toggleGradientTester: () => void;
}

export function ProspectDetailHeader({
  selectedProspect,
  onSave,
  onToggleFilterNiche,
  getNicheColor,
  isNarrow,
  onSelectProspect,
  gradientTesterOpen,
  toggleGradientTester,
}: ProspectDetailHeaderProps) {
  const { t } = useTranslation("prospects");

  // ── Prospect name inline edit ──────────────────────────────────────────────
  const [editingProspectName, setEditingProspectName] = useState(false);
  const [prospectNameValue, setProspectNameValue] = useState(
    selectedProspect?.name || selectedProspect?.company || ""
  );
  const prospectNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProspectNameValue(selectedProspect?.name || selectedProspect?.company || "");
  }, [selectedProspect?.name, selectedProspect?.company]);

  useEffect(() => {
    if (editingProspectName) prospectNameInputRef.current?.select();
  }, [editingProspectName]);

  const commitProspectName = async () => {
    setEditingProspectName(false);
    const trimmed = prospectNameValue.trim();
    if (trimmed && trimmed !== (selectedProspect?.name || selectedProspect?.company)) {
      await onSave("name", trimmed);
    } else {
      setProspectNameValue(selectedProspect?.name || selectedProspect?.company || "");
    }
  };

  // ── Photo upload ───────────────────────────────────────────────────────────
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoInputRef.current) photoInputRef.current.value = "";
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === "string") await onSave("company_logo_url", reader.result);
    };
    reader.readAsDataURL(file);
  }, [onSave]);

  const nicheColor = getNicheColor(String(selectedProspect.niche || ""));

  return (
    <div className="shrink-0 relative z-10">
      <div className="relative px-4 pt-3 md:pt-1 pb-4 md:pb-6 space-y-1">

        {/* Top row: back / collapse / gradient tester */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            {isNarrow && (
              <button
                onClick={() => onSelectProspect(null)}
                className="h-9 w-9 rounded-full border border-black/[0.125] bg-background grid place-items-center shrink-0 mr-2 text-foreground/70 hover:text-foreground transition-colors"
                title="Back"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <ListPanelToggleButton />
            <button
              onClick={toggleGradientTester}
              className={cn(
                "h-7 w-7 rounded-md border grid place-items-center shrink-0",
                gradientTesterOpen
                  ? "border-indigo-200 text-indigo-600 bg-indigo-100"
                  : "border-black/[0.125] text-foreground/50 hover:text-foreground hover:bg-black/[0.04]"
              )}
              title="Gradient Tester"
            >
              <Paintbrush className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Name + badges */}
        <div className="flex items-start gap-3">
          {/* Photo — company logo derived from website domain, fallback to acronym */}
          <div className="relative group/photo shrink-0">
            <ProspectAvatar
              website={selectedProspect.website}
              companyLogoUrl={selectedProspect.company_logo_url}
              name={selectedProspect.name || selectedProspect.company || ""}
              outreachStatus={selectedProspect.outreach_status || "new"}
              size={72}
              onClick={() => photoInputRef.current?.click()}
              title={t("detail.clickToUploadPhoto")}
            />
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity cursor-pointer pointer-events-none">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {editingProspectName ? (
                <input
                  ref={prospectNameInputRef}
                  value={prospectNameValue}
                  onChange={(e) => setProspectNameValue(e.target.value)}
                  onBlur={commitProspectName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    else if (e.key === "Escape") {
                      setProspectNameValue(selectedProspect?.name || selectedProspect?.company || "");
                      setEditingProspectName(false);
                    }
                  }}
                  className="text-2xl font-semibold font-heading text-foreground leading-tight bg-transparent border-b border-foreground/30 outline-none w-full"
                />
              ) : (
                <h2
                  className="text-2xl font-semibold font-heading text-foreground leading-tight truncate cursor-text hover:opacity-80 transition-opacity"
                  onClick={() => setEditingProspectName(true)}
                  title={t("detail.clickToRename", "Click to rename")}
                >
                  {selectedProspect?.name || selectedProspect?.company || ""}
                </h2>
              )}
            </div>

            {/* Outreach / Niche / Priority row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {/* Outreach status badge + advance/lost */}
              {(() => {
                const key = (selectedProspect.outreach_status || "new") as OutreachStatus;
                const hex = OUTREACH_HEX[key] || "#6B7280";
                const label = OUTREACH_LABELS[key] || key.replace(/_/g, " ");
                const currentIdx = OUTREACH_STATUSES.indexOf(key);
                const canAdvance = currentIdx >= 0 && currentIdx < OUTREACH_STATUSES.length - 2;
                const isTerminal = key === "deal_closed" || key === "lost";
                const nextStatus = canAdvance ? OUTREACH_STATUSES[currentIdx + 1] : null;
                const stageDate = key === "new"
                  ? selectedProspect.created_at
                  : (selectedProspect.last_contacted_at || selectedProspect.first_contacted_at || selectedProspect.created_at);
                const daysInStage = stageDate ? Math.floor((Date.now() - new Date(stageDate).getTime()) / 86400000) : null;
                return (
                  <div className="inline-flex items-stretch bg-white/90 dark:bg-card/90 backdrop-blur-sm border border-black/[0.06] dark:border-white/[0.08] rounded-full">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-[10px] font-semibold transition-colors leading-none"
                          style={{ color: hex }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                          {label}
                          {daysInStage !== null && (
                            <span className="opacity-50 tabular-nums">{daysInStage}d</span>
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-44">
                        {OUTREACH_STATUSES.map((s) => (
                          <DropdownMenuItem
                            key={s}
                            onClick={() => onSave("outreach_status", s)}
                            className={cn("text-[12px] flex items-center gap-2", key === s && "font-semibold")}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: OUTREACH_HEX[s] || "#6B7280" }} />
                            {OUTREACH_LABELS[s] || s.replace(/_/g, " ")}
                            {key === s && <Check className="h-3 w-3 ml-auto" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {!isTerminal && nextStatus && (
                      <button
                        onClick={() => onSave("outreach_status", nextStatus)}
                        className="inline-flex items-center justify-center pr-2 pl-0.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                        title={`Advance to ${OUTREACH_LABELS[nextStatus] || nextStatus}`}
                      >
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Niche badge */}
              {selectedProspect.niche && (
                <button
                  onClick={() => onToggleFilterNiche(String(selectedProspect.niche))}
                  className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/90 dark:bg-card/90 backdrop-blur-sm border border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.15] dark:hover:border-white/[0.15] transition-colors cursor-pointer"
                  style={{ color: nicheColor.hex }}
                  title="Filter by this niche"
                >
                  {selectedProspect.niche}
                </button>
              )}

              {/* Priority dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center px-2 py-1 rounded-full bg-white/90 dark:bg-card/90 backdrop-blur-sm border border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.15] dark:hover:border-white/[0.15] transition-colors cursor-pointer">
                    <SignalBars priority={String(selectedProspect.priority || "")} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-36">
                  {INLINE_PRIORITY_OPTIONS.map((p) => (
                    <DropdownMenuItem
                      key={p}
                      onClick={() => onSave("priority", p)}
                      className={cn("text-[12px] capitalize flex items-center gap-2", String(selectedProspect.priority) === p && "font-semibold")}
                    >
                      <SignalBars priority={p} />
                      {p}
                      {String(selectedProspect.priority) === p && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Prospect ID */}
              {getProspectId(selectedProspect) > 0 && (
                <span className="text-[11px] text-muted-foreground font-medium">
                  #{getProspectId(selectedProspect)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
