import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PasswordGate } from "./PasswordGate";
import { PanelBox } from "./TwoFactorPrimitives";
import { twoFactorRequest } from "./useTwoFactor";

/** Generate (or regenerate) the 10 backup codes. They are shown once. */
export function BackupCodesPanel({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const [codes, setCodes] = useState<string[] | null>(null);

  if (!codes) {
    return (
      <PanelBox>
        <PasswordGate
          title={t("twoFactor.backup.generateTitle")}
          submitLabel={t("twoFactor.backup.generate")}
          onCancel={onCancel}
          onSubmit={async (password) => {
            const r = await twoFactorRequest("POST", "/api/auth/2fa/backup-codes/generate", { password });
            if (!r.ok) return r.data?.message || t("twoFactor.genericError");
            setCodes(r.data.codes);
            return null;
          }}
        >
          <p className="text-xs text-muted-foreground">{t("twoFactor.backup.generateHelp")}</p>
        </PasswordGate>
      </PanelBox>
    );
  }

  const text = codes.join("\n");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ variant: "success", title: t("twoFactor.backup.copied") });
    } catch {
      toast({ variant: "destructive", title: t("twoFactor.genericError") });
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([`Lead Awaker backup codes\n\n${text}\n`], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "lead-awaker-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PanelBox>
      <div className="text-sm font-semibold text-foreground">{t("twoFactor.backup.yourCodes")}</div>
      <p className="text-xs text-muted-foreground">{t("twoFactor.backup.showOnce")}</p>
      <div className="grid grid-cols-2 gap-2" data-testid="list-backup-codes">
        {codes.map((c) => (
          <code key={c} className="rounded-md bg-muted px-2 py-1.5 text-center text-sm font-mono tracking-wider select-all">{c}</code>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button type="button" onClick={copy} className="la-btn la-btn--soft la-btn--lg"><Copy className="h-4 w-4" />{t("twoFactor.backup.copy")}</button>
          <button type="button" onClick={download} className="la-btn la-btn--soft la-btn--lg"><Download className="h-4 w-4" />{t("twoFactor.backup.download")}</button>
        </div>
        <button type="button" onClick={onDone} className="la-btn la-btn--wine la-btn--lg la-btn--pill" data-testid="button-backup-saved">
          {t("twoFactor.backup.saved")}
        </button>
      </div>
    </PanelBox>
  );
}
