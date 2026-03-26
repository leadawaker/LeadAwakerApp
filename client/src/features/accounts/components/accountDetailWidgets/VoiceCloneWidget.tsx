import { useState, useCallback, useRef } from "react";
import { Mic, Upload, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

// ── Constants ─────────────────────────────────────────────────────────────────

export const VOICE_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
export const VOICE_ACCEPT = "audio/*";

// ── VoiceCloneWidget ──────────────────────────────────────────────────────────

export function VoiceCloneWidget({
  voiceFileData,
  voiceFileName,
  accountId,
  onSave,
}: {
  voiceFileData: string | null;
  voiceFileName: string | null;
  accountId: number;
  onSave: (field: string, value: string) => Promise<void>;
}) {
  const { t } = useTranslation("accounts");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasVoice = Boolean(voiceFileData);
  const voiceId = `account_${accountId}`;

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      alert(t("detail.pleaseUploadAudio"));
      return;
    }
    if (file.size > VOICE_MAX_SIZE) {
      alert(t("detail.fileSizeLimit"));
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      await onSave("voice_file_data", dataUrl);
      await onSave("voice_file_name", file.name);
    } catch (e) {
      console.error("Voice upload failed", e);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [onSave, t]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleRemove = useCallback(async () => {
    setUploading(true);
    try {
      await onSave("voice_file_data", "");
      await onSave("voice_file_name", "");
    } catch (e) {
      console.error("Voice remove failed", e);
    } finally {
      setUploading(false);
    }
  }, [onSave]);

  return (
    <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 flex flex-col min-h-full" data-testid="account-widget-voice">
      <div className="flex items-center gap-2 mb-3">
        <Mic className="w-5 h-5 text-foreground/50" />
        <p className="text-[18px] font-semibold font-heading text-foreground">{t("detail.voiceClone")}</p>
      </div>

      {hasVoice ? (
        <div className="space-y-3">
          {/* File info + remove */}
          <div className="flex items-center gap-2 rounded-lg bg-foreground/[0.03] border border-foreground/[0.06] px-3 py-2">
            <Mic className="w-4 h-4 text-brand-indigo shrink-0" />
            <span className="text-[13px] text-foreground/70 truncate flex-1">
              {voiceFileName || t("detail.voiceFile")}
            </span>
            <button
              onClick={handleRemove}
              disabled={uploading}
              className="ml-auto p-1 rounded hover:bg-red-50 text-foreground/40 hover:text-red-500 transition-colors"
              title={t("detail.removeVoice")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Audio player */}
          <audio
            controls
            src={voiceFileData ?? undefined}
            className="w-full h-10 rounded-lg"
            style={{ colorScheme: "light" }}
          />

          {/* Voice ID hint */}
          <div className="rounded-lg bg-brand-indigo/5 border border-brand-indigo/10 px-3 py-2">
            <p className="text-[11px] text-foreground/40 uppercase tracking-wider font-medium mb-0.5">
              {t("detail.voiceIdForCampaigns")}
            </p>
            <p className="text-[13px] font-mono text-brand-indigo font-medium">{voiceId}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Drop zone */}
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              "flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors cursor-pointer min-h-[200px]",
              dragOver
                ? "border-brand-indigo bg-brand-indigo/5"
                : "border-foreground/[0.08] hover:border-foreground/20 hover:bg-foreground/[0.01]",
              uploading && "pointer-events-none opacity-50",
            )}
          >
            {uploading ? (
              <RefreshCw className="w-8 h-8 text-foreground/20 animate-spin" />
            ) : (
              <>
                <Upload className="w-8 h-8 text-foreground/20 mb-2" />
                <p className="text-[13px] text-foreground/40 font-medium">
                  {t("detail.clickOrDragAudio")}
                </p>
                <p className="text-[11px] text-foreground/25 mt-1">
                  {t("detail.voiceFormats")}
                </p>
              </>
            )}
          </div>

          {/* Voice ID hint (shown even before upload) */}
          <div className="rounded-lg bg-foreground/[0.02] border border-foreground/[0.06] px-3 py-2 mt-3">
            <p className="text-[11px] text-foreground/30 uppercase tracking-wider font-medium mb-0.5">
              {t("detail.voiceIdWillBe")}
            </p>
            <p className="text-[13px] font-mono text-foreground/40 font-medium">{voiceId}</p>
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={VOICE_ACCEPT}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
