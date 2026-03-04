/**
 * Custom tooltip component for the onboarding walkthrough.
 * Styled to match LeadAwaker's design system (Tailwind + Radix).
 */
import type { TooltipRenderProps } from "react-joyride";
import { X, ChevronRight, ChevronLeft, SkipForward } from "lucide-react";
import { STAGE_LABELS, TOTAL_STAGES } from "./steps";

interface Props extends TooltipRenderProps {
  currentStage: number;
}

export function OnboardingTooltip({
  continuous,
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
  size,
  isLastStep,
  currentStage,
}: Props) {
  return (
    <div
      {...tooltipProps}
      className="bg-background border border-border rounded-xl shadow-lg max-w-sm w-[340px] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
            Stage {currentStage}/{TOTAL_STAGES}
          </span>
          <span className="text-xs text-muted-foreground">
            {STAGE_LABELS[currentStage]}
          </span>
        </div>
        <button
          {...closeProps}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/50"
          aria-label="Close tutorial"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        {step.title && (
          <h3 className="text-sm font-semibold text-foreground mb-1">
            {step.title as string}
          </h3>
        )}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {step.content as string}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          {/* Progress dots */}
          {Array.from({ length: size }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? "w-4 bg-primary"
                  : i < index
                  ? "w-1.5 bg-primary/40"
                  : "w-1.5 bg-muted-foreground/20"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            {...skipProps}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50 flex items-center gap-1"
          >
            <SkipForward className="h-3 w-3" />
            Skip
          </button>

          {index > 0 && (
            <button
              {...backProps}
              className="text-xs font-medium text-foreground px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="h-3 w-3" />
              Back
            </button>
          )}

          {continuous && (
            <button
              {...primaryProps}
              className="text-xs font-medium text-primary-foreground bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1"
            >
              {isLastStep ? "Finish" : "Next"}
              {!isLastStep && <ChevronRight className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
