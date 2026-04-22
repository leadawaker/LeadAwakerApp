import { useState, useEffect, useCallback, useRef, type ReactElement } from "react";
import { Building2, Globe, MapPin, FileText, Lightbulb, CheckSquare, Mail, MessageSquare, Clock, Plus, Layers, ChevronLeft, Linkedin, RefreshCw, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { EnrichmentPanel } from "./EnrichmentPanel";
import { MessageGenerator } from "./MessageGenerator";
import { ProspectBusinessIdeas, type ProspectBusinessIdeasHandle } from "./ProspectBusinessIdeas";
import { ProspectTasks } from "./ProspectTasks";
import { EmailComposer } from "./EmailComposer";
import { WhatsAppComposer } from "./WhatsAppComposer";
import { LinkedInComposer } from "./LinkedInComposer";
import { OutreachTimeline } from "./OutreachTimeline";
import { ProspectRow, getProspectId } from "./prospectTypes";
import { OUTREACH_HEX as OUTREACH_HEX_PIPELINE, type OutreachStatus } from "./OutreachPipelineView";

interface ProspectDetailPanelsProps {
  selectedProspect: ProspectRow;
  onSave: (field: string, value: string) => Promise<void>;
  onRefreshProspect?: () => void;
  onToggleFilterNiche: (s: string) => void;
  editableField: (field: string, value: string, placeholder: string, className: string) => ReactElement;
  editableMultiline: (field: string, value: string, placeholder: string, className: string) => ReactElement;
  converting: boolean;
  handleConvertToAccount: () => void;
}

export function ProspectDetailPanels({
  selectedProspect,
  onSave,
  onRefreshProspect,
  onToggleFilterNiche,
  editableField,
  editableMultiline,
  converting,
  handleConvertToAccount,
}: ProspectDetailPanelsProps) {
  const { t } = useTranslation("prospects");
  const [emailOpen, setEmailOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const ideasRef = useRef<ProspectBusinessIdeasHandle>(null);

  function readPanelCollapsed(key: string) {
    try { return localStorage.getItem(key) === "true"; } catch { return false; }
  }
  const [interactionRefreshKey, setInteractionRefreshKey] = useState(0);
  const handleSent = useCallback(() => {
    setInteractionRefreshKey((k) => k + 1);
    onRefreshProspect?.();
  }, [onRefreshProspect]);
  const [col1Collapsed, setCol1Collapsed] = useState(() => readPanelCollapsed("panel-col1-collapsed"));
  const [col2Collapsed, setCol2Collapsed] = useState(() => readPanelCollapsed("panel-col2-collapsed"));
  const [col3Collapsed, setCol3Collapsed] = useState(() => readPanelCollapsed("panel-col3-collapsed"));

  function togglePanel(key: string, val: boolean, setter: (v: boolean) => void) {
    setter(val);
    try { localStorage.setItem(key, String(val)); } catch {}
  }

  useEffect(() => {
    setEmailOpen(false);
    setWaOpen(false);
  }, [selectedProspect?.id ?? selectedProspect?.Id]);

  const pid = getProspectId(selectedProspect);

  // Parse offer ideas for MessageGenerator
  const offerIdeas = (() => {
    const raw = selectedProspect.offer_ideas;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item: any) =>
        typeof item === "string" ? { text: item, checked: false } : { text: item.text, checked: !!item.checked }
      );
    } catch {
      return raw.split("\n").filter(Boolean).map((t: string) => ({ text: t, checked: false }));
    }
  })();

  const savedMessages = (() => {
    const raw = selectedProspect.generated_messages;
    if (!raw) return [];
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
  })();


  return (
    <div className="flex-1 min-h-0 overflow-hidden px-1.5 pb-1.5 pt-3 relative z-10 flex flex-col md:flex-row gap-1.5">

      {/* Panel 1: Contact */}
      <div className={cn("min-h-0 overflow-hidden bg-white/60 dark:bg-card/60 backdrop-blur-sm rounded-lg flex flex-col transition-all duration-200", col1Collapsed ? "w-8 shrink-0 flex-none" : "flex-1 min-w-0")}>
        <div className={cn("shrink-0 border-b border-border/30 flex items-center", col1Collapsed ? "flex-col py-3 px-1 gap-2 border-b-0 h-full justify-start" : "pl-3 pr-2 pt-2.5 pb-2")}>
          {col1Collapsed ? (
            <>
              <button onClick={() => togglePanel("panel-col1-collapsed", false, setCol1Collapsed)} className="text-muted-foreground/50 hover:text-foreground transition-colors p-1">
                <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
              </button>
              <span className="text-[11px] font-semibold text-foreground/40 tracking-wide" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>Info</span>
            </>
          ) : (
            <>
              <span className="text-[15px] font-semibold text-foreground/70 flex-1">Info</span>
              <button onClick={() => togglePanel("panel-col1-collapsed", true, setCol1Collapsed)} className="text-muted-foreground/30 hover:text-muted-foreground transition-colors p-1">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
        {!col1Collapsed && <>

        {/* Scrollable: EnrichmentPanel + Notes */}
        <div className="flex-1 min-h-0 overflow-y-auto px-0 pb-6 scroll-fade-bottom">
          <EnrichmentPanel
            key={selectedProspect.Id ?? selectedProspect.id}
            prospect={selectedProspect}
            onRefresh={onRefreshProspect}
            hideMessageGenerator
          />
          <div className="px-3">
            <CollapsibleSection id="contact-notes" title={t("sections.notes")} icon={FileText} hasData={!!selectedProspect.notes}>
              {editableMultiline("notes", String(selectedProspect.notes || ""), "No notes yet", "text-[12px] leading-relaxed text-foreground")}

              <div className="mt-4 pt-3 border-t border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="h-4 w-4 text-brand-indigo/60" />
                  <span className="text-sm font-medium text-foreground/80">Source</span>
                </div>
                {editableField("source", String(selectedProspect.source || ""), "Add source", "text-[12px] text-muted-foreground")}

                {/* Create Account Button - only show if demo has been sent (status is contacted, qualified, or converted) */}
                {!selectedProspect.Accounts_id && selectedProspect.status && !["new", "researching"].includes(selectedProspect.status.toLowerCase()) && (
                  <div className="mt-3">
                    <button
                      onClick={handleConvertToAccount}
                      disabled={converting}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] font-medium bg-brand-indigo/10 text-brand-indigo hover:bg-brand-indigo/20 border border-brand-indigo/20 transition-colors disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create Account
                    </button>
                  </div>
                )}

                {/* Show Account link if already converted */}
                {selectedProspect.Accounts_id && (
                  <div className="mt-3">
                    <a
                      href="/accounts"
                      onClick={(e) => {
                        e.preventDefault();
                        localStorage.setItem("selectedAccountId", String(selectedProspect.Accounts_id));
                        window.location.href = "/accounts";
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] font-medium bg-muted/60 text-muted-foreground border border-border/40 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      Account #{selectedProspect.Accounts_id}
                    </a>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          </div>
        </div>
        </>}
      </div>

      {/* Panel 2: Offer Ideas + Message Generator */}
      <div className={cn("min-h-0 overflow-hidden bg-white/60 dark:bg-card/60 backdrop-blur-sm rounded-lg flex flex-col transition-all duration-200", col2Collapsed ? "w-8 shrink-0 flex-none" : "flex-1 min-w-0")}>
        <div className={cn("shrink-0 border-b border-border/30 flex items-center", col2Collapsed ? "flex-col py-3 px-1 gap-2 border-b-0 h-full justify-start" : "pl-3 pr-2 pt-2.5 pb-2")}>
          {col2Collapsed ? (
            <>
              <button onClick={() => togglePanel("panel-col2-collapsed", false, setCol2Collapsed)} className="text-muted-foreground/50 hover:text-foreground transition-colors p-1">
                <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
              </button>
              <span className="text-[11px] font-semibold text-foreground/40 tracking-wide" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>Proposal</span>
            </>
          ) : (
            <>
              <span className="text-[15px] font-semibold text-foreground/70 flex-1">Proposal</span>
              <button onClick={() => togglePanel("panel-col2-collapsed", true, setCol2Collapsed)} className="text-muted-foreground/30 hover:text-muted-foreground transition-colors p-1">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
        {!col2Collapsed && <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-6 scroll-fade-bottom">
          <CollapsibleSection
            id="p2-ideas"
            title={t("sections.offerIdeas")}
            icon={Lightbulb}
            hasData={!!selectedProspect.offer_ideas}
            hideDivider
            trailing={
              <>
                <button
                  onClick={() => ideasRef.current?.triggerRefresh()}
                  className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Regenerate offers"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => ideasRef.current?.triggerAdd()}
                  className="h-6 px-2 rounded flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-[11px]"
                  title="Add offer"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              </>
            }
          >
            <ProspectBusinessIdeas
              ref={ideasRef}
              offerIdeas={selectedProspect.offer_ideas}
              compact
              hideHeader
              prospectId={pid}
              onRefresh={onRefreshProspect}
            />
          </CollapsibleSection>
          <div className="mt-2">
            <MessageGenerator
              key={selectedProspect.Id ?? selectedProspect.id}
              prospectId={pid}
              offerIdeas={offerIdeas}
              contactName={selectedProspect.contact_name}
              contact2Name={selectedProspect.contact2_name}
              niche={selectedProspect.niche}
              savedMessages={savedMessages}
              onRefresh={onRefreshProspect}
            />
          </div>
        </div>}
      </div>

      {/* Panel 3: Actions */}
      <div className={cn("min-h-0 overflow-hidden bg-white/70 dark:bg-card/70 backdrop-blur-sm rounded-lg flex flex-col transition-all duration-200", col3Collapsed ? "w-8 shrink-0 flex-none" : "flex-1 min-w-0")}>
        <div className={cn("shrink-0 border-b border-border/30 flex items-center", col3Collapsed ? "flex-col py-3 px-1 gap-2 border-b-0 h-full justify-start" : "pl-3 pr-2 pt-2.5 pb-2")}>
          {col3Collapsed ? (
            <>
              <button onClick={() => togglePanel("panel-col3-collapsed", false, setCol3Collapsed)} className="text-muted-foreground/50 hover:text-foreground transition-colors p-1">
                <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
              </button>
              <span className="text-[11px] font-semibold text-foreground/40 tracking-wide" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>Channels</span>
            </>
          ) : (
            <>
              <span className="text-[15px] font-semibold text-foreground/70 flex-1">Channels</span>
              <button onClick={() => togglePanel("panel-col3-collapsed", true, setCol3Collapsed)} className="text-muted-foreground/30 hover:text-muted-foreground transition-colors p-1">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
        {!col3Collapsed && <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-6 scroll-fade-bottom">
          <CollapsibleSection id="actions-tasks" title={t("sections.nextActions", "Next Actions")} icon={CheckSquare} hasData hideDivider>
            <ProspectTasks
              prospectCompanyName={selectedProspect.company || ""}
              accountsId={1}
              compact
            />
          </CollapsibleSection>

          <CollapsibleSection id="actions-emails" title={t("sections.emails")} icon={Mail} hasData open={emailOpen} onOpenChange={setEmailOpen}>
            <EmailComposer
              prospectId={pid}
              prospect={selectedProspect}
              onSent={handleSent}
            />
          </CollapsibleSection>

          <CollapsibleSection id="actions-whatsapp" title={t("sections.whatsApp")} icon={MessageSquare} activeIconClass="text-emerald-500" hasData open={waOpen} onOpenChange={setWaOpen}>
            <WhatsAppComposer
              prospectId={pid}
              prospect={selectedProspect}
              onSent={handleSent}
            />
          </CollapsibleSection>

          <CollapsibleSection id="actions-linkedin" title="LinkedIn" icon={Linkedin} activeIconClass="text-[#0A66C2]" hasData>
            <LinkedInComposer
              prospectId={pid}
              prospect={selectedProspect}
              onSent={handleSent}
            />
          </CollapsibleSection>

          <CollapsibleSection id="actions-interactions" title={t("sections.interactions")} icon={Clock} hasData>
            <OutreachTimeline prospectId={pid} refreshKey={interactionRefreshKey} />
          </CollapsibleSection>

          {/* Pipeline info */}
          {selectedProspect.outreach_status && selectedProspect.outreach_status !== "new" && (
            <>
              <div className="h-px bg-border/30 mt-3" />
              <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-gradient-to-br from-brand-indigo/[0.04] to-transparent border border-brand-indigo/[0.08] mt-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">Pipeline Stage</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: OUTREACH_HEX_PIPELINE[(selectedProspect.outreach_status as OutreachStatus)] || "#6B7280" }}
                  />
                  <span className="text-[13px] font-medium text-foreground capitalize">{selectedProspect.outreach_status.replace(/_/g, " ")}</span>
                </div>
                {selectedProspect.first_contacted_at && (
                  <span className="text-[10px] text-muted-foreground">
                    First contact: {new Date(selectedProspect.first_contacted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            </>
          )}
        </div>}
      </div>

    </div>
  );
}
