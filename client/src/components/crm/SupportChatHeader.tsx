import { useState, useEffect } from "react";
import { X, Mail } from "lucide-react";
import founderPhoto from "@/assets/founder-photo.webp";

// ─── Header props ─────────────────────────────────────────────────────────────
export interface SupportChatHeaderProps {
  isAgencyUser: boolean;
  handleClose: () => void;
}

// ─── Header (founder chat: "Talk to Gabriel") ─────────────────────────────────
export function SupportChatHeader({ isAgencyUser, handleClose }: SupportChatHeaderProps) {
  // Founder avatar follows the owner's selected profile avatar (live), falling
  // back to the bundled photo for everyone else (e.g. clients).
  const [personalAvatar, setPersonalAvatar] = useState<string>(() => localStorage.getItem("leadawaker_user_avatar") || "");
  useEffect(() => {
    const handler = () => setPersonalAvatar(localStorage.getItem("leadawaker_user_avatar") || "");
    window.addEventListener("leadawaker-avatar-changed", handler);
    return () => window.removeEventListener("leadawaker-avatar-changed", handler);
  }, []);
  const founderSrc = isAgencyUser && personalAvatar ? personalAvatar : founderPhoto;

  return (
    <div className="shrink-0 bg-white dark:bg-card border-b border-black/[0.06] dark:border-border/30">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <img
            src={founderSrc}
            alt="Gabriel"
            className="rounded-full shrink-0 object-cover"
            style={{ width: 36, height: 36 }}
          />

          {/* Name */}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground leading-tight truncate text-[15px]">
              Gabriel Barbosa Fronza
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">Founder, Lead Awaker</p>
          </div>

          {/* Action buttons cluster */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Email Gabriel */}
            <a
              href="mailto:gabriel@leadawaker.com"
              className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[12px] font-medium border border-black/[0.125] bg-transparent text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Email Gabriel"
            >
              <Mail className="h-4 w-4" />
            </a>

            {/* Close */}
            <button
              onClick={handleClose}
              className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[12px] font-medium border border-black/[0.125] bg-transparent text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
