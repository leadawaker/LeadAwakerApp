import React from "react";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import type { DateRangeValue } from "@/components/crm/DateRangeFilter";
import { useCampaignDetail, getCampaignMetrics } from "../useCampaignDetail";
import { CampaignMetricsPanel } from "../CampaignMetricsPanel";
import { CampaignStageEditor } from "../CampaignStageEditor";
import { GradientTester, DEFAULT_LAYERS, type GradientLayer } from "@/components/ui/gradient-tester";
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
import { Button } from "@/components/ui/button";
import type { Tag as TagType } from "@/features/tags/types";
import type { SavedTemplate } from "./types";

interface DetailViewBodyProps {
  activeTab: "summary" | "configurations";
  campaign: Campaign;
  filteredMetrics: CampaignMetricsHistory[];
  agg: ReturnType<typeof getCampaignMetrics>;
  animTrigger: number;
  dateRange: DateRangeValue;
  onDateRangeChange: (v: DateRangeValue) => void;
  campaignCreatedAt: string | null;
  detail: ReturnType<typeof useCampaignDetail>;
  compact: boolean;
  isAgencyUser: boolean;
  goToConfig: () => void;
  // Template state
  templateDialogOpen: boolean;
  selectedTemplate: SavedTemplate | null;
  templateApplying: boolean;
  applyTemplate: () => Promise<void>;
  setTemplateDialogOpen: (v: boolean) => void;
  setSelectedTemplate: (v: SavedTemplate | null) => void;
  // Save dialog state
  saveDialogOpen: boolean;
  setSaveDialogOpen: (v: boolean) => void;
  saveTemplateName: string;
  setSaveTemplateName: (v: string) => void;
  handleSaveTemplate: () => void;
  tagsDataRef: React.RefObject<TagType[] | null>;
  // Gradient state
  gradientTesterOpen: boolean;
  setGradientTesterOpen: (v: boolean) => void;
  gradientLayers: GradientLayer[];
  updateGradientLayer: (id: number, patch: Partial<GradientLayer>) => void;
  resetGradientLayers: () => void;
  gradientDragMode: boolean;
  setGradientDragMode: React.Dispatch<React.SetStateAction<boolean>>;
  handleApplyGradient: () => void;
}

export function DetailViewBody({
  activeTab,
  campaign,
  filteredMetrics,
  agg,
  animTrigger,
  dateRange,
  onDateRangeChange,
  campaignCreatedAt,
  detail,
  compact,
  isAgencyUser,
  goToConfig,
  templateDialogOpen,
  selectedTemplate,
  templateApplying,
  applyTemplate,
  setTemplateDialogOpen,
  setSelectedTemplate,
  saveDialogOpen,
  setSaveDialogOpen,
  saveTemplateName,
  setSaveTemplateName,
  handleSaveTemplate,
  tagsDataRef,
  gradientTesterOpen,
  setGradientTesterOpen,
  gradientLayers,
  updateGradientLayer,
  resetGradientLayers,
  gradientDragMode,
  setGradientDragMode,
  handleApplyGradient,
}: DetailViewBodyProps) {
  return (
    <>
      {/* ── Body ── */}
      <div
        className="relative flex-1 px-[3px] pb-[3px] -mt-[80px] pt-[83px] overflow-y-auto"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0px, black 83px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0px, black 83px)",
        }}
      >
        {activeTab === "summary" && (
          <CampaignMetricsPanel
            campaign={campaign}
            filteredMetrics={filteredMetrics}
            agg={agg}
            animTrigger={animTrigger}
            dateRange={dateRange}
            onDateRangeChange={onDateRangeChange}
            campaignCreatedAt={campaignCreatedAt}
            dailyStats={detail.dailyStats}
            linkedContract={detail.linkedContract}
            contractLoading={detail.contractLoading}
            aiCosts={detail.aiCosts}
            localAiSummary={detail.localAiSummary}
            localAiSummaryAt={detail.localAiSummaryAt}
            onAiSummaryRefreshed={detail.handleAiSummaryRefreshed}
            isAgencyUser={isAgencyUser}
            onGoToConfig={goToConfig}
            compact={compact}
          />
        )}

        {activeTab === "configurations" && (
          <CampaignStageEditor
            campaign={campaign}
            isEditing={detail.isEditing}
            draft={detail.draft}
            setDraft={detail.setDraft}
            linkedPrompt={detail.linkedPrompt}
            conversationPrompts={detail.conversationPrompts}
            linkedContract={detail.linkedContract}
            compact={compact}
          />
        )}
      </div>

      {/* ── Apply template confirmation dialog ── */}
      <AlertDialog open={templateDialogOpen} onOpenChange={(open) => { setTemplateDialogOpen(open); if (!open) setSelectedTemplate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply {selectedTemplate?.name} Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create {selectedTemplate?.tags.length ?? 0} tags from the {selectedTemplate?.name} template
              for <span className="font-medium text-foreground">{campaign.name}</span>.
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

      {/* ── Save template dialog ── */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Save Tags as Template</DialogTitle></DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            Save the {tagsDataRef.current?.length ?? 0} tags from{" "}
            <span className="font-medium text-foreground">{campaign.name}</span> as a reusable template.
          </p>
          <input
            type="text"
            placeholder="Template name"
            value={saveTemplateName}
            onChange={(e) => setSaveTemplateName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveTemplate(); }}
            className="w-full h-9 px-3 text-[12px] rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveTemplate} disabled={!saveTemplateName.trim()}>Save Template</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gradient Tester (agency-only) */}
      {isAgencyUser && (
        <GradientTester
          open={gradientTesterOpen}
          onClose={() => setGradientTesterOpen(false)}
          layers={gradientLayers}
          onUpdateLayer={updateGradientLayer}
          onResetLayers={resetGradientLayers}
          dragMode={gradientDragMode}
          onToggleDragMode={() => setGradientDragMode(prev => !prev)}
          onApply={handleApplyGradient}
        />
      )}
    </>
  );
}
