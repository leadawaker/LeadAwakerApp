import { useState } from "react";
import { X, Instagram, Facebook, Mail, Phone, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const SOCIAL_LINKS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/leadawaker/",
    handle: "@leadawaker",
    icon: Instagram,
    color: "text-pink-600",
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61552291063345",
    handle: "Lead Awaker",
    icon: Facebook,
    color: "text-blue-600",
  },
  {
    label: "Email",
    href: "mailto:gabriel@leadawaker.com",
    handle: "gabriel@leadawaker.com",
    icon: Mail,
    color: "text-foreground/70",
  },
  {
    label: "WhatsApp",
    href: "https://wa.me/5547974002162",
    handle: "+(55) 47 9740-02162",
    icon: Phone,
    color: "text-emerald-600",
  },
];

export function HelpMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [socialExpanded, setSocialExpanded] = useState(false);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] pointer-events-none" data-testid="overlay-help">
      <button
        type="button"
        className="absolute inset-0 bg-black/35 pointer-events-auto"
        style={{ left: '48px' }}
        onClick={() => onOpenChange(false)}
      />
      <aside className="absolute left-[48px] top-0 bottom-0 w-[400px] border-r border-border bg-background shadow-xl pointer-events-auto">
        <div className="h-14 px-4 border-b border-border flex items-center justify-between">
          <div className="font-semibold">Help & Resources</div>
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 w-9 rounded-xl hover:bg-muted/30 grid place-items-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <MenuItem href="https://docs.example.com" label="Documentation" testId="link-help-docs" />

          {/* Social media — expandable */}
          <div>
            <button
              type="button"
              onClick={() => setSocialExpanded((v) => !v)}
              className="w-full rounded-xl px-4 py-3 text-sm hover:bg-muted/30 transition-colors border border-transparent hover:border-border font-medium flex items-center justify-between"
              data-testid="link-help-social"
            >
              Social media
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", socialExpanded && "rotate-180")} />
            </button>

            {socialExpanded && (
              <div className="mt-1 ml-2 space-y-0.5">
                {SOCIAL_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted/30 transition-colors group"
                  >
                    <link.icon className={cn("h-4 w-4 shrink-0", link.color)} />
                    <div className="min-w-0">
                      <span className="font-medium text-foreground">{link.label}</span>
                      <span className="block text-[12px] text-muted-foreground truncate">{link.handle}</span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          <MenuItem href="#" label="What's new" testId="link-help-whatsnew" />
        </div>
      </aside>
    </div>
  );
}

function MenuItem({ href, label, testId }: { href: string; label: string; testId: string }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className="block rounded-xl px-4 py-3 text-sm hover:bg-muted/30 transition-colors border border-transparent hover:border-border font-medium"
      data-testid={testId}
    >
      {label}
    </a>
  );
}
