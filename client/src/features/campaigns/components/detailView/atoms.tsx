import { useState } from "react";
import { Copy, Megaphone, Link as LinkIcon, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { Campaign } from "@/types/models";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { xBase, xDefault, xSpan } from "./constants";

// ── Duplicate button (inline confirm) ─────────────────────────────────────────
export function DuplicateButton({
  campaign, onDuplicate, t,
}: {
  campaign: Campaign;
  onDuplicate: (campaign: Campaign) => Promise<void>;
  t: (key: string) => string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  if (confirming) {
    return (
      <div className="inline-flex items-center gap-1.5 h-9 rounded-full border border-black/[0.125] bg-card px-2.5 text-[12px] shrink-0">
        <span className="text-foreground/60 mr-0.5 whitespace-nowrap">{t("toolbar.duplicate")}?</span>
        <button
          className="h-7 px-3 rounded-full bg-brand-indigo text-white font-semibold text-[11px] hover:opacity-90 disabled:opacity-50 transition-opacity"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try { await onDuplicate(campaign); } finally { setLoading(false); setConfirming(false); }
          }}
        >
          {loading ? "…" : t("confirm.yes")}
        </button>
        <button
          className="h-7 px-3 rounded-full text-muted-foreground text-[11px] hover:text-foreground transition-colors"
          onClick={() => setConfirming(false)}
        >
          {t("confirm.no")}
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      className={cn(xBase, "hover:max-w-[110px]", xDefault)}
    >
      <Copy className="h-4 w-4 shrink-0" />
      <span className={xSpan}>{t("toolbar.duplicate")}</span>
    </button>
  );
}

// ── Demo Link Button ──────────────────────────────────────────────────────────

export function DemoLinkButton({
  campaign,
}: {
  campaign: Campaign;
}) {
  const { t } = useTranslation("campaigns");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const campaignId = campaign.id || campaign.Id;
  const demoLink = `https://t.me/Demo_Lead_Awaker_bot?start=campaign_${campaignId}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(demoLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Only show for demo campaigns — check multiple field name variations
  const isDemo = campaign.is_demo || (campaign as any).isDemo || (campaign as any).is_demo === true;
  if (!isDemo) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(xBase, "hover:max-w-[140px]", xDefault)}
        title="Generate demo link for this campaign"
      >
        <LinkIcon className="h-4 w-4 shrink-0" />
        <span className={xSpan}>Demo Link</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Demo Campaign Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share this link with prospects to start the demo:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={demoLink}
                readOnly
                className="flex-1 px-3 py-2 text-sm border border-black/[0.125] rounded-md bg-muted/50 font-mono"
              />
              <button
                onClick={handleCopy}
                className="h-9 px-4 rounded-full bg-brand-indigo text-white font-medium text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Campaign ID: <span className="font-mono font-semibold">{campaignId}</span>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function CampaignDetailViewEmpty({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("campaigns");
  return (
    <div className="relative h-full flex flex-col items-center justify-center gap-5 p-8 text-center overflow-hidden">
      <div className="absolute inset-0 bg-popover dark:bg-background" />
      <>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_6%_5%,#fff8c6_0%,transparent_30%)] dark:opacity-[0.08]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_103%_130%_at_35%_85%,rgba(255,134,134,0.4)_0%,transparent_69%)] dark:opacity-[0.08]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_52%_48%_at_0%_0%,#fff6ba_5%,transparent_30%)] dark:opacity-[0.08]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_102%_at_78%_50%,rgba(255,194,165,0.6)_0%,transparent_66%)] dark:opacity-[0.08]" />
      </>
      <div className="relative z-10">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 flex items-center justify-center ring-1 ring-amber-200/50 dark:ring-amber-700/30">
          <Megaphone className="h-10 w-10 text-amber-400" />
        </div>
      </div>
      <div className="relative z-10 space-y-1.5">
        <p className="text-sm font-semibold text-foreground/70">{t("empty.selectCampaign")}</p>
        <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">{t("empty.selectCampaignDesc")}</p>
      </div>
      <div className="relative z-10 flex items-center gap-1.5 text-[11px] text-amber-500 font-medium">
        <span>{t("empty.chooseFromList")}</span>
      </div>
    </div>
  );
}
