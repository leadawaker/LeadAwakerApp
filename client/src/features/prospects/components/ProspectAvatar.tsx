import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Building2 } from "lucide-react";
import { getInitials } from "@/lib/avatarUtils";
import { cn } from "@/lib/utils";
import { getProspectAvatarColor, type OutreachStatus } from "./OutreachPipelineView";

interface ProspectAvatarProps {
  /** Company / prospect display name used for initials fallback */
  name: string;
  /** Manually uploaded company logo — takes priority over the favicon lookup */
  companyLogoUrl?: string | null;
  /** Website URL — used to derive a favicon URL when no manual logo is set */
  website?: string | null;
  /** Outreach status — drives the fallback circle color */
  outreachStatus?: string | null;
  /** Pixel size (default 40) */
  size?: number;
  /** Additional className on the outer circle */
  className?: string;
  /** Click handler. If omitted and `zoomOnClick`, clicking opens the zoom modal */
  onClick?: () => void;
  /** Show a large zoom popup when clicked */
  zoomOnClick?: boolean;
  /** Optional title attribute */
  title?: string;
}

const SIZE_CLASS: Record<number, string> = {
  24: "h-6 w-6 text-[9px]",
  28: "h-7 w-7 text-[10px]",
  32: "h-8 w-8 text-[12px]",
  34: "h-[34px] w-[34px] text-[12px]",
  36: "h-9 w-9 text-[12px]",
  39: "h-[39px] w-[39px] text-[13px]",
  40: "h-10 w-10 text-[13px]",
  46: "h-[46px] w-[46px] text-[14px]",
  48: "h-12 w-12 text-[15px]",
  72: "h-[72px] w-[72px] text-[22px]",
  80: "h-20 w-20 text-[22px]",
};

function deriveDomain(website?: string | null): string | null {
  if (!website) return null;
  try {
    return new URL(website.startsWith("http") ? website : `https://${website}`).hostname;
  } catch {
    return null;
  }
}

export function ProspectAvatar({
  name,
  companyLogoUrl,
  website,
  outreachStatus,
  size = 40,
  className,
  onClick,
  zoomOnClick,
  title,
}: ProspectAvatarProps) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const domain = deriveDomain(website);
  const faviconUrl = domain && !faviconFailed
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    : null;
  const logoUrl = companyLogoUrl || faviconUrl;
  const initials = getInitials(name);
  const color = getProspectAvatarColor((outreachStatus || "new") as OutreachStatus);

  const sizeClass = SIZE_CLASS[size] ?? "";
  const inlineSize = SIZE_CLASS[size] ? undefined : { width: size, height: size };

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
      return;
    }
    if (zoomOnClick) {
      e.stopPropagation();
      setZoomed(true);
    }
  };

  const isClickable = !!onClick || !!zoomOnClick;

  return (
    <>
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-bold shrink-0 leading-none overflow-hidden",
          sizeClass,
          isClickable && "cursor-pointer",
          className,
        )}
        style={{
          ...(inlineSize || {}),
          ...(logoUrl ? { backgroundColor: "#fff" } : { backgroundColor: color.bg, color: color.text }),
        }}
        onClick={isClickable ? handleClick : undefined}
        title={title}
      >
        {logoUrl ? (
          <img
            key={logoUrl}
            src={logoUrl}
            alt={name}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
            onLoad={(e) => {
              // Google returns a 16x16 placeholder (the globe icon) when it has no favicon for
              // the domain. Anything smaller than a real-use favicon (< 24px) is a placeholder.
              // Skip this check for manually uploaded logos — those are always valid.
              if (companyLogoUrl && logoUrl === companyLogoUrl) return;
              const img = e.currentTarget;
              if (img.naturalWidth > 0 && img.naturalWidth < 24) {
                setFaviconFailed(true);
              }
            }}
            onError={() => setFaviconFailed(true)}
          />
        ) : (
          initials || <Building2 className="w-1/2 h-1/2" />
        )}
      </div>

      {zoomed && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={() => setZoomed(false)}
        >
          <div
            className="relative max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-2xl bg-white p-6 shadow-2xl flex flex-col items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={name}
                  className="w-48 h-48 object-contain"
                  onError={() => setFaviconFailed(true)}
                />
              ) : (
                <div
                  className="w-48 h-48 rounded-full flex items-center justify-center text-5xl font-bold"
                  style={{ backgroundColor: color.bg, color: color.text }}
                >
                  {initials}
                </div>
              )}
              <p className="text-center text-foreground text-[15px] font-semibold">{name}</p>
            </div>
            <button
              onClick={() => setZoomed(false)}
              className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-white border border-border text-foreground flex items-center justify-center hover:bg-muted transition-colors shadow-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
