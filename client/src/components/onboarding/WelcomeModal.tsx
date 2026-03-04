/**
 * Welcome modal shown on first login after invite acceptance.
 * Introduces the onboarding tutorial stages.
 */
import { useState } from "react";
import { Settings, Megaphone, Users, BarChart3, Rocket, X } from "lucide-react";

interface Props {
  onStart: () => void;
  onSkip: () => void;
}

const STAGES = [
  { icon: Settings, label: "Profile Setup", desc: "Set your name, timezone & preferences" },
  { icon: Megaphone, label: "Explore Campaigns", desc: "See your outreach campaigns" },
  { icon: Users, label: "Your Leads", desc: "View and import your lead contacts" },
  { icon: BarChart3, label: "Conversations", desc: "Monitor replies and manage chats" },
];

export function WelcomeModal({ onStart, onSkip }: Props) {
  const [showConfirmSkip, setShowConfirmSkip] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          <button
            onClick={() => setShowConfirmSkip(true)}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Welcome to LeadAwaker!</h2>
              <p className="text-xs text-muted-foreground">Let's get you set up in a few minutes</p>
            </div>
          </div>
        </div>

        {/* Stages preview */}
        <div className="px-6 pb-4 space-y-2">
          {STAGES.map((stage, i) => (
            <div
              key={stage.label}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/50"
            >
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <stage.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Step {i + 1}</span>
                  {stage.label}
                </div>
                <div className="text-xs text-muted-foreground">{stage.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-muted/20 border-t border-border/50 flex items-center justify-between">
          <button
            onClick={() => setShowConfirmSkip(true)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
          >
            Skip for now
          </button>
          <button
            onClick={onStart}
            className="text-sm font-medium text-primary-foreground bg-primary px-5 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Start Tutorial
          </button>
        </div>

        {/* Skip confirmation */}
        {showConfirmSkip && (
          <div className="absolute inset-0 bg-background/95 rounded-2xl flex flex-col items-center justify-center px-6 text-center animate-in fade-in duration-150">
            <p className="text-sm font-medium text-foreground mb-1">Skip the tutorial?</p>
            <p className="text-xs text-muted-foreground mb-4">
              You can restart it anytime from Settings.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmSkip(false)}
                className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                Go back
              </button>
              <button
                onClick={onSkip}
                className="text-sm px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-muted/70 transition-colors"
              >
                Yes, skip
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
