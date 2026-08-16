import { useEffect, useMemo, useState } from "react";
import { Copy, Megaphone, Link as LinkIcon, Check, Share2, Send, MessageCircle, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { Campaign } from "@/types/models";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiFetch } from "@/lib/apiUtils";
import { xBase, xDefault, xSpan } from "./constants";
import { useDemoClients } from "../../api/demoClientsApi";
import { DEMO_MODES, DEMO_MODE_SCENARIO, DEMO_MARKETS, type DemoMode, type DemoMarket } from "../../demoMode";

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

// Only the Universal Demo campaign runs the per-lead niche overlay
// (context_injection.py gates it on `campaign_id == 60`), so the niche and
// company fields below are shown for that campaign alone. Offering them
// elsewhere would accept input the engine then silently ignores.
const UNIVERSAL_DEMO_CAMPAIGN_ID = 60;

export function ShareButton({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation("campaigns");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"choose" | "whatsapp" | "telegram">("choose");

  // Demo-link form state
  const [firstName, setFirstName] = useState("");
  const [language, setLanguage] = useState<"en" | "nl" | "pt">("en");
  const [niche, setNiche] = useState("");
  // A saved Client, re-picked instead of generated. Wins over `niche` when set.
  const [savedClient, setSavedClient] = useState("");
  // Which conversation this minted link should open in: a lead who was never
  // quoted, or one sitting on a quote. Defaults to "scoping" (never quoted),
  // which is also what the API itself defaults to when the field is omitted
  // (server/routes/demo.ts, `scenario` defaults to "inquired"). The panel used
  // to open on "decision" to match the public homepage form, which meant the
  // one surface that always sends the field disagreed with the one that does
  // not. Most links minted here are for a lead who was never quoted anyway.
  const [demoMode, setDemoMode] = useState<DemoMode>("scoping");
  // Independent of `language`: the demo used to derive disclosure from which
  // language was picked (en->off, nl->opener, pt->second_message), which
  // conflated "what the prospect reads in" with "which jurisdiction's rules
  // apply" — see the note in server/demo-session.ts. Off by default: most
  // links minted here are for a live sales conversation, not a compliance
  // test, and Gabriel would rather opt IN to disclosure than have it sprung
  // on a call by whichever language happened to be selected.
  const [aiDisclosure, setAiDisclosure] = useState<"off" | "opener" | "second_message">("off");
  // Which market the prospect sells into. Only asked when the language is
  // English, because that is the only language whose market is ambiguous.
  // Defaults to the Netherlands rather than the UK: that is where the demos
  // are actually being run, and it was what the model got wrong on its own.
  const [market, setMarket] = useState<DemoMarket>("nl");
  const [prospectCompany, setProspectCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoLink, setDemoLink] = useState<string | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [fellBack, setFellBack] = useState(false);
  const [copied, setCopied] = useState<"demo" | "wa" | null>(null);
  // Saved personas, for the re-pick dropdown. Cheap and cached by the query
  // client, so it costs nothing when the dialog is never opened.
  const { data: savedClients } = useDemoClients();

  const campaignId = (campaign.id || (campaign as any).Id) as number;
  const canGenerateNiche = campaignId === UNIVERSAL_DEMO_CAMPAIGN_ID;

  // Which languages the picked Client can actually be minted in.
  //
  // A Client stores its opener, opener phrase, time reference and the two
  // quoted-opener halves per language, and only for the languages someone
  // generated or typed. Minting one in a language it lacks used to fall back
  // across languages and splice, say, a Portuguese noun phrase into an English
  // opener. The server refuses that pairing outright now (409 from
  // /api/demo/create-link); this list is here so the button is never offered in
  // the first place. Empty means unrestricted, matching the server's rule for
  // the curated niche packs, which have no opener in any language to splice.
  const clientLanguages = useMemo<readonly ("en" | "nl" | "pt")[]>(() => {
    if (!savedClient) return [];
    return (savedClients ?? []).find((c) => c.niche === savedClient)?.languages ?? [];
  }, [savedClient, savedClients]);

  const languageAllowed = (l: "en" | "nl" | "pt") =>
    clientLanguages.length === 0 || clientLanguages.includes(l);

  // Picking a Client that does not speak the currently-selected language moves
  // the selection rather than leaving a disabled button highlighted (and a
  // payload the server would reject). Its own first language is the only
  // sensible landing spot.
  useEffect(() => {
    if (clientLanguages.length > 0 && !clientLanguages.includes(language)) {
      setLanguage(clientLanguages[0]);
    }
  }, [clientLanguages, language]);
  const botUsername = import.meta.env.VITE_TELEGRAM_DEMO_BOT_USERNAME || "Demo_Lead_Awaker_bot";
  const telegramLink = `https://t.me/${botUsername}?start=campaign_${campaignId}`;

  const reset = () => {
    setStep("choose");
    setFirstName(""); setLanguage("en"); setNiche(""); setProspectCompany("");
    // savedClient belongs here too: it disables the niche input, so leaving it
    // set would silently hand the next prospect the previous prospect's persona
    // with no obvious way back.
    setSavedClient("");
    setDemoMode("scoping");
    setAiDisclosure("off");
    setMarket("nl");
    setLoading(false);
    setError(null); setDemoLink(null); setWaLink(null); setFellBack(false); setCopied(null);
  };

  const copy = async (value: string, which: "demo" | "wa") => {
    try { await navigator.clipboard.writeText(value); setCopied(which); setTimeout(() => setCopied(null), 2000); } catch {}
  };

  const handleGenerateWa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) { setError(t("share.nameRequired", "Fill in the prospect's first name.")); return; }
    setLoading(true); setError(null);
    try {
      const res = await apiFetch("/api/demo/create-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          language,
          campaignId,
          // Omitted entirely when blank: the endpoint only runs the generator
          // when `niche` is present, so an empty string would be a validation
          // error rather than "use the campaign as-is".
          ...(canGenerateNiche && savedClient
            ? { clientNiche: savedClient }
            : canGenerateNiche && niche.trim()
              ? { niche: niche.trim() }
              : {}),
          ...(canGenerateNiche && prospectCompany.trim() ? { companyName: prospectCompany.trim() } : {}),
          // Sent on the re-pick path too: demoClientToContext takes the scenario
          // as an argument, so the same saved Client can be minted as either
          // conversation without being re-generated.
          ...(canGenerateNiche ? { scenario: DEMO_MODE_SCENARIO[demoMode] } : {}),
          // Always sent (not omitted at "off"): this is now an explicit choice
          // made on this link, not a fallback to the campaign's own column.
          ...(canGenerateNiche ? { aiDisclosure } : {}),
          // English only, and generate-only. A saved Client's currency is
          // already baked into its stored quote text, so sending a market on
          // that path would be a field the server can do nothing with.
          ...(canGenerateNiche && !savedClient && language === "en" ? { market } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as any).message || t("share.createFailed", "Could not create link.")); setLoading(false); return;
      }
      const data = await res.json();
      setDemoLink(data.demoUrl || null);
      setWaLink(data.whatsappUrl);
      // The server only sends `generated` when a niche was requested. false
      // means the model did not run and the link carries a generic context,
      // which is worth knowing BEFORE it is sent to a named prospect.
      setFellBack(data.generated === false);
      copy(data.demoUrl || data.whatsappUrl, data.demoUrl ? "demo" : "wa");
    } catch {
      setError(t("share.networkError", "Network error. Try again."));
    } finally { setLoading(false); }
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <PopoverTrigger asChild>
        <button className="neu-raised-crisp" style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", fontSize: 13, fontWeight: 600, borderRadius: 'var(--r-button)', border: 'none', cursor: 'pointer', color: 'var(--ink)', background: 'var(--paper)', letterSpacing: '0.04em', fontFamily: 'var(--sans)', textTransform: 'uppercase' as const }}>
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
                <div className="text-[13px] font-semibold text-foreground">{t("share.demoLink", "Demo link")}</div>
                <div className="text-[11px] text-muted-foreground">{t("share.demoLinkHint", "Browser page plus a WhatsApp version")}</div>
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
                {canGenerateNiche && (
                  <>
                    {/* Re-pick a saved Client instead of generating. Skips the
                        model round-trip entirely and reuses a persona that has
                        already been read and approved, which is the difference
                        between a link you send in 20 seconds and one you have
                        to check first. See specs/demo-persona-library. */}
                    {(savedClients ?? []).length > 0 && (
                      <div>
                        <label className="block text-[12px] font-medium mb-1">{t("share.savedClient", "Saved Client")}</label>
                        <select
                          value={savedClient}
                          onChange={(e) => setSavedClient(e.target.value)}
                          className="w-full h-8 rounded-md border border-black/[0.125] bg-white px-2 text-[12px] outline-none focus:border-brand-indigo transition-colors"
                        >
                          <option value="">{t("share.savedClientNone", "Generate a new one")}</option>
                          {(savedClients ?? []).map((c) => (
                            <option key={c.id} value={c.niche}>
                              {c.label || c.niche}
                              {c.companyName ? ` — ${c.companyName}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {/* Hidden, not disabled, on the re-pick path: a saved
                        Client already carries its own vocabulary, so the field
                        can never be used there and a greyed-out input is just
                        height. "Their company" below stays, because that one
                        IS live on both paths. The typed value is deliberately
                        not cleared: the payload already ignores it while a
                        saved Client is set, so keeping it means switching back
                        to "Generate a new one" restores what was typed. */}
                    {!savedClient && (
                      <div>
                        <label className="block text-[12px] font-medium mb-1">{t("share.niche", "Their niche")}</label>
                        <input
                          type="text" value={niche} onChange={(e) => setNiche(e.target.value)}
                          placeholder={t("share.nichePlaceholder", "e.g. cabinet hardware, dental implants")}
                          maxLength={300}
                          className="w-full h-8 rounded-md border border-black/[0.125] bg-white px-2.5 text-[12px] outline-none focus:border-brand-indigo transition-colors"
                        />
                        <p className="mt-1 text-[10.5px] text-muted-foreground leading-snug">
                          {t("share.nicheHint", "Leave blank to send the campaign as it is. Filling it in generates this prospect's own vocabulary, questions and opener.")}
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="block text-[12px] font-medium mb-1">{t("share.prospectCompany", "Their company")}</label>
                      <input
                        type="text" value={prospectCompany} onChange={(e) => setProspectCompany(e.target.value)}
                        placeholder={t("share.prospectCompanyPlaceholder", "Hoffman Puxadores")}
                        maxLength={120}
                        // Applies on top of BOTH paths: the company override
                        // never writes back to the saved Client.
                        disabled={!niche.trim() && !savedClient}
                        className="w-full h-8 rounded-md border border-black/[0.125] bg-white px-2.5 text-[12px] outline-none focus:border-brand-indigo transition-colors disabled:opacity-50"
                      />
                      {!niche.trim() && !savedClient && (
                        <p className="mt-1 text-[10.5px] text-muted-foreground leading-snug">
                          {t("share.prospectCompanyHint", "Fill in their niche or pick a saved client first.")}
                        </p>
                      )}
                    </div>
                  </>
                )}
                {canGenerateNiche && (
                  <div>
                    <label className="block text-[12px] font-medium mb-1">{t("share.demoMode", "Conversation")}</label>
                    <div className="flex gap-1.5">
                      {DEMO_MODES.map((m) => (
                        <button key={m} type="button" onClick={() => setDemoMode(m)}
                          className={cn("px-3 py-1 rounded-md border text-[12px] font-medium transition-colors",
                            demoMode === m ? "border-brand-indigo bg-brand-indigo text-white" : "border-black/[0.125] bg-white hover:bg-muted/50")}>
                          {t(`share.demoModeOptions.${m}`)}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-[10.5px] text-muted-foreground leading-snug">
                      {t("share.demoModeHint", "Whether this prospect's lead was ever quoted. Decides the opener and how the AI opens the conversation.")}
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-[12px] font-medium mb-1">{t("share.language", "Language")}</label>
                  <div className="flex gap-1.5">
                    {(["en", "nl", "pt"] as const).map((l) => (
                      <button key={l} type="button" onClick={() => setLanguage(l)}
                        disabled={!languageAllowed(l)}
                        title={languageAllowed(l) ? undefined : t("share.languageMissing", "This client has no opener in this language yet.")}
                        className={cn("px-3 py-1 rounded-md border text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                          language === l ? "border-brand-indigo bg-brand-indigo text-white" : "border-black/[0.125] bg-white hover:bg-muted/50")}>
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  {clientLanguages.length > 0 && clientLanguages.length < 3 && (
                    <p className="mt-1 text-[10.5px] text-muted-foreground leading-snug">
                      {t("share.languageLimitedHint", {
                        defaultValue:
                          "This client only exists in {{langs}}. Add the missing opener fields on the Clients tab to mint it in another language.",
                        langs: clientLanguages.map((l) => l.toUpperCase()).join(", "),
                      })}
                    </p>
                  )}
                </div>
                {canGenerateNiche && !savedClient && language === "en" && (
                  <div>
                    <label className="block text-[12px] font-medium mb-1">{t("share.market", "Market")}</label>
                    <div className="flex gap-1.5">
                      {DEMO_MARKETS.map((m) => (
                        <button key={m} type="button" onClick={() => setMarket(m)}
                          className={cn("px-3 py-1 rounded-md border text-[12px] font-medium transition-colors",
                            market === m ? "border-brand-indigo bg-brand-indigo text-white" : "border-black/[0.125] bg-white hover:bg-muted/50")}>
                          {t(`share.marketOptions.${m}`)}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-[10.5px] text-muted-foreground leading-snug">
                      {t("share.marketHint", "Which market they sell into, not the language they read in. Sets the currency on the quote and the local rules the AI knows. Dutch and Portuguese set their own.")}
                    </p>
                  </div>
                )}
                {canGenerateNiche && (
                  <div>
                    <label className="block text-[12px] font-medium mb-1">{t("share.aiDisclosure", "AI disclosure")}</label>
                    <div className="flex gap-1.5">
                      {(["off", "opener", "second_message"] as const).map((mode) => (
                        <button key={mode} type="button" onClick={() => setAiDisclosure(mode)}
                          className={cn("px-3 py-1 rounded-md border text-[12px] font-medium transition-colors",
                            aiDisclosure === mode ? "border-brand-indigo bg-brand-indigo text-white" : "border-black/[0.125] bg-white hover:bg-muted/50")}>
                          {t(`config.aiDisclosureOptions.${mode}`)}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-[10.5px] text-muted-foreground leading-snug">
                      {t("share.aiDisclosureHint", "This link's own choice, independent of Language above. Off by default.")}
                    </p>
                  </div>
                )}
                {error && <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">{error}</div>}
                <button type="submit" disabled={loading}
                  className="w-full h-9 rounded-full bg-brand-indigo text-white font-medium text-[13px] hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {loading
                    ? (savedClient
                        // Re-pick skips the model, so it is near-instant. Saying
                        // "building" would be a lie the user notices.
                        ? t("share.reusing", "Preparing their demo…")
                        : niche.trim()
                          ? t("share.generatingNiche", "Building their demo…")
                          : t("share.generating", "Generating…"))
                    : t("share.generateLink", "Generate link")}
                </button>
              </form>
            ) : (
              <div className="space-y-2.5">
                {fellBack && (
                  <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 leading-snug">
                    {t("share.fellBack", "The niche generator did not run, so this link uses a generic demo. Generate another before sending it.")}
                  </div>
                )}
                {demoLink && (
                  <div>
                    <p className="text-[11px] font-medium text-foreground mb-1">{t("share.browserLink", "Browser link")}</p>
                    <div className="flex items-center gap-2">
                      <input type="text" value={demoLink} readOnly className="flex-1 h-8 px-2.5 text-[11px] border border-black/[0.125] rounded-md bg-muted/50 font-mono" />
                      <button onClick={() => copy(demoLink, "demo")} className="h-8 w-8 rounded-full bg-brand-indigo text-white hover:opacity-90 transition-opacity flex items-center justify-center shrink-0">
                        {copied === "demo" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <p className="mt-1 text-[10.5px] text-muted-foreground leading-snug">
                      {t("share.browserLinkHint", "Works on a desktop with no WhatsApp. The page offers WhatsApp itself.")}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[11px] font-medium text-foreground mb-1">{t("share.whatsappLink", "WhatsApp version")}</p>
                  <div className="flex items-center gap-2">
                    <input type="text" value={waLink} readOnly className="flex-1 h-8 px-2.5 text-[11px] border border-black/[0.125] rounded-md bg-muted/50 font-mono" />
                    <button onClick={() => copy(waLink, "wa")} className="h-8 w-8 rounded-full bg-muted text-foreground hover:bg-muted/70 transition-colors flex items-center justify-center shrink-0">
                      {copied === "wa" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <p className="text-[10.5px] text-muted-foreground leading-snug">
                  {t("share.sameSession", "Same session either way: whichever the prospect opens first claims it.")}
                </p>
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
              <button onClick={() => copy(telegramLink, "demo")} className="h-8 w-8 rounded-full bg-brand-indigo text-white hover:opacity-90 transition-opacity flex items-center justify-center shrink-0">
                {copied === "demo" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function CampaignDetailViewEmpty({ compact = false, showNoCampaigns = false }: { compact?: boolean; showNoCampaigns?: boolean }) {
  const { t } = useTranslation("campaigns");
  return (
    <div className="relative h-full flex flex-col items-center justify-center gap-5 p-8 text-center overflow-hidden bg-panel-list-bg">
      <div className="relative z-10">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 flex items-center justify-center ring-1 ring-amber-200/50 dark:ring-amber-700/30">
          <Megaphone className="h-10 w-10 text-amber-400" />
        </div>
      </div>
      <div className="relative z-10 space-y-1.5">
        <p className="text-sm font-semibold text-foreground/70">
          {showNoCampaigns ? t("empty.noCampaignsFound") : t("empty.selectCampaign")}
        </p>
        {!showNoCampaigns && (
          <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">{t("empty.selectCampaignDesc")}</p>
        )}
      </div>
      {!showNoCampaigns && (
        <div className="relative z-10 flex items-center gap-1.5 text-[11px] text-amber-500 font-medium">
          <span>{t("empty.chooseFromList")}</span>
        </div>
      )}
    </div>
  );
}
