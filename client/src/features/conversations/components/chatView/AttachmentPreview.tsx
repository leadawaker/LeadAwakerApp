import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Video, FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAttachmentType } from "./utils";
import { VoiceMemoPlayer } from "./VoiceMemoPlayer";

export function AttachmentPreview({ url, outbound, voiceColor }: { url: string; outbound: boolean; voiceColor?: string }) {
  const { t } = useTranslation("conversations");
  const [imgError, setImgError] = useState(false);
  const type = getAttachmentType(url);
  const filename = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "attachment");

  const linkClasses = cn(
    "inline-flex items-center gap-1.5 mt-1 text-xs underline underline-offset-2 opacity-90 hover:opacity-100 break-all text-green-800",
  );

  if (type === "image" && !imgError) {
    return (
      <div className="mt-2" data-testid="attachment-image">
        <img
          src={url}
          alt={t("chat.attachment")}
          className="max-w-full max-h-60 rounded-lg object-cover border border-white/20 cursor-pointer"
          onError={() => setImgError(true)}
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          title={t("chat.clickToOpenFullSize")}
        />
        <a href={url} target="_blank" rel="noopener noreferrer" className={linkClasses} data-testid="attachment-link">
          <ExternalLink className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[200px]">{filename}</span>
        </a>
      </div>
    );
  }

  if (type === "video") {
    return (
      <div className="mt-2" data-testid="attachment-video">
        <video src={url} controls className="max-w-full max-h-48 rounded-lg border border-white/20" preload="metadata" />
        <a href={url} target="_blank" rel="noopener noreferrer" className={linkClasses} data-testid="attachment-link">
          <Video className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[200px]">{filename}</span>
        </a>
      </div>
    );
  }

  if (type === "audio") {
    return (
      <div className="mt-2" data-testid="attachment-audio">
        <VoiceMemoPlayer url={url} outbound={outbound} color={voiceColor} />
      </div>
    );
  }

  return (
    <div className="mt-2" data-testid="attachment-document">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-black/[0.15] text-xs font-medium text-foreground/70 bg-transparent hover:bg-black/[0.04]"
        data-testid="attachment-link"
        download
      >
        <FileText className="w-4 h-4 shrink-0" />
        <span className="truncate max-w-[200px]">{filename}</span>
        <Download className="w-3 h-3 shrink-0 opacity-70" />
      </a>
    </div>
  );
}
