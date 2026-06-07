import { useState } from "react";
import { Copy, Megaphone, Link as LinkIcon, Check, Share2, Send, MessageCircle, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { Campaign } from "@/types/models";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiFetch } from "@/lib/apiUtils";
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
  const botUsername = import.meta.env.VITE_TELEGRAM_DEMO_BOT_USERNAME || "Demo_Lead_Awaker_bot";
  const demoLink = `https://t.me/${botUsername}?start=campaign_${campaignId}`;

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
        title="Generate Telegram demo link for this campaign"
      >
        <LinkIcon className="h-4 w-4 shrink-0" />
        <span className={xSpan}>Telegram Link</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Telegram Demo Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share this Telegram link — the bot asks for language and name on first message. No message cap.
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

// ── WhatsApp Demo Link Button ─────────────────────────────────────────────────
// Generates a pre-filled WhatsApp demo link for a demo campaign. Opens a small
// form for the prospect's name + language, calls the admin endpoint which
// pre-creates a pending Lead, then displays + copies the wa.me link.

export function WhatsAppDemoLinkButton({
  campaign,
}: {
  campaign: Campaign;
}) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [language, setLanguage] = useState<"en" | "nl" | "pt">("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const campaignId = (campaign.id || (campaign as any).Id) as number;
  const isDemo = (campaign as any).is_demo || (campaign as any).isDemo;
  if (!isDemo) return null;

  const reset = () => {
    setFirstName("");
    setLanguage("en");
    setLink(null);
    setError(null);
    setCopied(false);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError("Fill in the prospect's first name.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/demo/create-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          language,
          campaignId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Could not create link.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setLink(data.whatsappUrl);
      try {
        await navigator.clipboard.writeText(data.whatsappUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard may be blocked; user can still copy manually.
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className={cn(xBase, "hover:max-w-[180px]", xDefault)}
        title="Generate a pre-filled WhatsApp demo link for this campaign"
      >
        <LinkIcon className="h-4 w-4 shrink-0" />
        <span className={xSpan}>WhatsApp Link</span>
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>WhatsApp Demo Link</DialogTitle>
          </DialogHeader>

          {!link ? (
            <form onSubmit={handleGenerate} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Personalize the demo for a specific prospect. They get a one-tap WhatsApp link with their session already primed.
              </p>
              <div>
                <label className="block text-sm font-medium mb-1.5">Prospect first name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="João"
                  className="w-full px-3 py-2 text-sm rounded-md border border-black/[0.125] bg-white text-gray-900"
                  maxLength={80}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Language</label>
                <div className="flex gap-2">
                  {(["en", "nl", "pt"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLanguage(l)}
                      className={cn(
                        "px-3 py-1.5 rounded-md border text-sm font-medium transition",
                        language === l
                          ? "border-brand-indigo bg-brand-indigo text-white"
                          : "border-black/[0.125] bg-white text-gray-900 hover:bg-muted/50",
                      )}
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 px-4 rounded-full text-muted-foreground text-sm hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-9 px-4 rounded-full bg-brand-indigo text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {loading ? "Generating…" : "Generate link"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Share this link with <span className="font-semibold text-foreground">{firstName}</span>. It auto-copied to your clipboard.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={link}
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
                Link expires in 7 days if the prospect doesn't click. Campaign ID: <span className="font-mono font-semibold">{campaignId}</span>
              </p>
              <div className="flex justify-between pt-2">
                <button
                  onClick={reset}
                  className="h-9 px-4 rounded-full text-muted-foreground text-sm hover:text-foreground transition-colors"
                >
                  Generate another
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="h-9 px-4 rounded-full bg-muted text-foreground text-sm hover:bg-muted/80 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Share button (WhatsApp / Telegram demo links) ─────────────────────────────
// One prominent button. Opens a popover: choose a channel, then generate/copy
// the demo link inline. WhatsApp needs a name + language (pre-primes a Lead);
// Telegram is an instant deep link.

export function ShareButton({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation("campaigns");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"choose" | "whatsapp" | "telegram">("choose");

  // WhatsApp form state
  const [firstName, setFirstName] = useState("");
  const [language, setLanguage] = useState<"en" | "nl" | "pt">("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const campaignId = (campaign.id || (campaign as any).Id) as number;
  const botUsername = import.meta.env.VITE_TELEGRAM_DEMO_BOT_USERNAME || "Demo_Lead_Awaker_bot";
  const telegramLink = `https://t.me/${botUsername}?start=campaign_${campaignId}`;

  const reset = () => {
    setStep("choose");
    setFirstName(""); setLanguage("en"); setLoading(false);
    setError(null); setWaLink(null); setCopied(false);
  };

  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  const handleGenerateWa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) { setError(t("share.nameRequired", "Fill in the prospect's first name.")); return; }
    setLoading(true); setError(null);
    try {
      const res = await apiFetch("/api/demo/create-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), language, campaignId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as any).message || t("share.createFailed", "Could not create link.")); setLoading(false); return;
      }
      const data = await res.json();
      setWaLink(data.whatsappUrl);
      copy(data.whatsappUrl);
    } catch {
      setError(t("share.networkError", "Network error. Try again."));
    } finally { setLoading(false); }
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <PopoverTrigger asChild>
        <button className="btn-neu" style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", fontSize: 13, fontWeight: 600 }}>
          <Share2 className="h-4 w-4 shrink-0" />
          {t("toolbar.share", "Share")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        {step === "choose" && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground mb-1 px-1">{t("share.choosePrompt", "Choose a channel to share the demo link.")}</p>
            <button
              onClick={() => setStep("whatsapp")}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
            >
              <span className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(37,211,102,0.12)", color: "#25D366" }}>
                <MessageCircle className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-foreground">WhatsApp</div>
                <div className="text-[11px] text-muted-foreground">{t("share.whatsappHint", "Pre-fills a prospect's session")}</div>
              </div>
            </button>
            <button
              onClick={() => setStep("telegram")}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
            >
              <span className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(36,161,222,0.12)", color: "#24A1DE" }}>
                <Send className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-foreground">Telegram</div>
                <div className="text-[11px] text-muted-foreground">{t("share.telegramHint", "Instant deep link, no message cap")}</div>
              </div>
            </button>
          </div>
        )}

        {step === "whatsapp" && (
          <div className="space-y-3">
            <button onClick={() => { reset(); }} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="h-3 w-3" /> {t("share.back", "Back")}
            </button>
            {!waLink ? (
              <form onSubmit={handleGenerateWa} className="space-y-3">
                <div>
                  <label className="block text-[12px] font-medium mb-1">{t("share.prospectName", "Prospect first name")}</label>
                  <input
                    type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    placeholder="João" maxLength={80} required
                    className="w-full h-8 rounded-md border border-black/[0.125] bg-white px-2.5 text-[12px] outline-none focus:border-brand-indigo transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium mb-1">{t("share.language", "Language")}</label>
                  <div className="flex gap-1.5">
                    {(["en", "nl", "pt"] as const).map((l) => (
                      <button key={l} type="button" onClick={() => setLanguage(l)}
                        className={cn("px-3 py-1 rounded-md border text-[12px] font-medium transition-colors",
                          language === l ? "border-brand-indigo bg-brand-indigo text-white" : "border-black/[0.125] bg-white hover:bg-muted/50")}>
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                {error && <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">{error}</div>}
                <button type="submit" disabled={loading}
                  className="w-full h-9 rounded-full bg-brand-indigo text-white font-medium text-[13px] hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {loading ? t("share.generating", "Generating…") : t("share.generateLink", "Generate link")}
                </button>
              </form>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">{t("share.copiedHint", "Link copied to clipboard.")}</p>
                <div className="flex items-center gap-2">
                  <input type="text" value={waLink} readOnly className="flex-1 h-8 px-2.5 text-[11px] border border-black/[0.125] rounded-md bg-muted/50 font-mono" />
                  <button onClick={() => copy(waLink)} className="h-8 w-8 rounded-full bg-brand-indigo text-white hover:opacity-90 transition-opacity flex items-center justify-center shrink-0">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "telegram" && (
          <div className="space-y-3">
            <button onClick={() => setStep("choose")} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="h-3 w-3" /> {t("share.back", "Back")}
            </button>
            <p className="text-[11px] text-muted-foreground">{t("share.telegramShare", "Share this Telegram link — the bot asks for language and name on first message.")}</p>
            <div className="flex items-center gap-2">
              <input type="text" value={telegramLink} readOnly className="flex-1 h-8 px-2.5 text-[11px] border border-black/[0.125] rounded-md bg-muted/50 font-mono" />
              <button onClick={() => copy(telegramLink)} className="h-8 w-8 rounded-full bg-brand-indigo text-white hover:opacity-90 transition-opacity flex items-center justify-center shrink-0">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function CampaignDetailViewEmpty({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("campaigns");
  return (
    <div className="relative h-full flex flex-col items-center justify-center gap-5 p-8 text-center overflow-hidden">
      <div className="absolute inset-0 bg-popover dark:bg-background" />
      <>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_6%_5%,#F5EEE0_0%,transparent_30%)] dark:opacity-[0.08]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_103%_130%_at_35%_85%,rgba(150,80,100,0.3)_0%,transparent_69%)] dark:opacity-[0.08]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_52%_48%_at_0%_0%,#EFE4CF_5%,transparent_30%)] dark:opacity-[0.08]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_102%_at_78%_50%,rgba(200,160,140,0.5)_0%,transparent_66%)] dark:opacity-[0.08]" />
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
