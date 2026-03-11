/**
 * Welcome modal shown on first login after invite acceptance.
 * Introduces the onboarding tutorial stages.
 * Click any stage to jump directly to it, or "Start Tutorial" to begin from step 1.
 */
import { Settings, Megaphone, Users, BarChart3, Rocket, X, ChevronRight } from "lucide-react";

interface Props {
  onStart: () => void;
  onSkip: () => void;
  onStartAt: (stage: number) => void;
}

const STAGES = [
  { icon: Settings, label: "Profile Setup", desc: "Set your name, timezone & preferences" },
  { icon: Megaphone, label: "Explore Campaigns", desc: "See your outreach campaigns" },
  { icon: Users, label: "Your Leads", desc: "View and import your lead contacts" },
  { icon: BarChart3, label: "Conversations", desc: "Monitor replies and manage chats" },
];

export function WelcomeModal({ onStart, onSkip, onStartAt }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          <button
            onClick={onSkip}
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
              <p className="text-xs text-muted-foreground">Click any step to jump directly to it</p>
            </div>
          </div>
        </div>

        {/* Stages — click any to jump directly to that stage */}
        <div className="px-6 pb-4 space-y-2">
          {STAGES.map((stage, i) => (
            <button
              key={stage.label}
              type="button"
              onClick={() => onStartAt(i + 1)}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/60 hover:border-primary/30 transition-colors text-left group"
            >
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <stage.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Step {i + 1}</span>
                  {stage.label}
                </div>
                <div className="text-xs text-muted-foreground">{stage.desc}</div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-muted/20 border-t border-border/50 flex items-center justify-between">
          <button
            onClick={onSkip}
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
      </div>
    </div>
  );
}
