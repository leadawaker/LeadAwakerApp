/**
 * Edit one saved demo persona.
 *
 * The layout encodes a tested finding (specs/demo-persona-library/plan.md, "A
 * Client is ENGLISH, except its terms"): everything the MODEL reads works in
 * whatever language it was authored in alone, because the model translates as
 * it writes (the engine's pick() resolves it lead-language-first, English
 * next). Only the five term lists are substituted verbatim into the opener
 * with no model in the loop, so only those get a slot per language.
 *
 * Persona fields still show a SINGLE box (not one per language): a Client is
 * authored once, in one language (English by convention, but the
 * website-scrape flow writes directly in the demo's own language: Zonneplan
 * is NL-only, Moniz de Sá PT-only). The box defaults to whichever language
 * actually has content instead of hardcoding "en", with a small toggle above
 * it to switch languages when more than one is filled in. Without this, a
 * non-English-only Client looks entirely empty here even though the engine
 * reads it fine at runtime.
 *
 * Autosaves 1.5s after the last edit (mirrors useCampaignDetail.ts). Duplicate
 * and Delete live in the "..." menu (ClientActionsMenu.tsx), which the parent
 * hands in as `actions` or keeps in its own topbar.
 *
 * The form is split over three views (persona, wording, media). All three stay
 * mounted and the inactive ones are only hidden, so switching view never drops
 * what was typed, including the Instagram post's own unsaved draft.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDemoClient,
  useDemoClients,
  useUpdateDemoClient,
  type ClientTextField,
  type DemoLang,
  type TermGroup,
} from "../../api/demoClientsApi";
import { ClientPanelHeader } from "./ClientPanelHeader";
import { IdentitySection, OpenerSection, PersonaSection, WordsSection } from "./ClientEditorSections";
import { ClientScreenshot } from "./ClientScreenshot";
import { SocialPostSection } from "./SocialPostSection";
import { LiveClientView } from "./LiveClientView";
import { LANGS } from "./clientDisplay";
import { TEXT_FIELDS, buildDraft, buildPatch, draftsEqual, type Draft } from "./clientDraft";

type View = "persona" | "wording" | "media";
const VIEWS: View[] = ["persona", "wording", "media"];

interface ClientEditorProps {
  niche: string;
  onBack: () => void;
  /** The "..." menu, when the parent wants it in the panel header. */
  actions?: ReactNode;
}

export function ClientEditor({ niche, onBack, actions }: ClientEditorProps) {
  const { t } = useTranslation("campaigns");
  const { data: client, isLoading } = useDemoClient(niche);
  // The list is already cached, so the header can name the persona while its detail loads.
  const { data: clients } = useDemoClients();
  const summary = clients?.find((c) => c.niche === niche);
  const update = useUpdateDemoClient();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [originalDraft, setOriginalDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  // Which language slot the Persona section currently shows/edits. Reset
  // below whenever a different Client loads, defaulting to whichever
  // language its content actually lives in.
  const [personaLang, setPersonaLang] = useState<DemoLang>("en");
  const [view, setView] = useState<View>("persona");
  // The three views share one scroll area: each view, and each persona, starts at its top.
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [view, niche]);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const originalDraftRef = useRef(originalDraft);
  originalDraftRef.current = originalDraft;
  const nicheRef = useRef(niche);
  nicheRef.current = niche;

  // Load this Client's data into the draft. Re-fires only when the Client
  // IDENTITY changes (a different niche opened), never on a same-entity
  // refetch: reseeding on `updatedAt` would replace the user's live draft
  // with the server's just-saved (and server-trimmed) copy ~200-500ms after
  // every autosave, mangling text under the cursor (trailing space/newline
  // eaten mid-keystroke). Mirrors useCampaignDetail.ts, which reseeds only
  // on identity change too.
  useEffect(() => {
    if (!client) return;
    const d = buildDraft(client);
    setDraft(d);
    setOriginalDraft(d);
    const withContent = LANGS.filter((l) => TEXT_FIELDS.some(({ field }) => (d.text[field]?.[l] ?? "").trim()));
    setPersonaLang(withContent.includes("en") ? "en" : withContent[0] ?? "en");
  }, [client?.niche]);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(
    (d: Draft) => {
      const savedNiche = nicheRef.current;
      setSaving(true);
      update.mutate(
        { niche: savedNiche, patch: buildPatch(d) },
        {
          onSuccess: () => {
            // Only reconcile `originalDraft` if we're still looking at the
            // Client this save was for: the parent may have swapped `niche`
            // in place (no remount) while this PATCH was in flight.
            if (nicheRef.current === savedNiche) setOriginalDraft(d);
            setSaving(false);
          },
          onError: () => setSaving(false),
        },
      );
    },
    [update],
  );

  // Fire-and-forget variant for the flush paths below: the component is
  // switching to a different Client (or unmounting), so there is no local
  // state left to reconcile an onSuccess into.
  const flushSave = useCallback(
    (targetNiche: string, d: Draft) => {
      update.mutate({ niche: targetNiche, patch: buildPatch(d) });
    },
    [update],
  );

  // Debounced autosave: 1.5s after the last edit, mirrors useCampaignDetail.ts.
  useEffect(() => {
    if (draftsEqual(draft, originalDraft)) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      // Clear first: once this fires, no timer is pending anymore, so the
      // switch/unmount flush paths below must not treat it as still pending.
      autoSaveTimer.current = null;
      if (draftRef.current) doSave(draftRef.current);
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [draft, originalDraft, doSave]);

  // Flush a pending save for the PREVIOUS niche when the parent switches which
  // Client is open (no remount: ClientsTab swaps the `niche` prop in place).
  const prevNicheRef = useRef(niche);
  useEffect(() => {
    if (autoSaveTimer.current && prevNicheRef.current !== niche) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
      const prevNiche = prevNicheRef.current;
      const d = draftRef.current;
      const orig = originalDraftRef.current;
      if (d && !draftsEqual(d, orig)) flushSave(prevNiche, d);
    }
    prevNicheRef.current = niche;
  }, [niche, flushSave]);

  // Flush on unmount (navigating off the Clients tab entirely).
  const flushSaveRef = useRef(flushSave);
  flushSaveRef.current = flushSave;
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        const d = draftRef.current;
        const orig = originalDraftRef.current;
        if (d && !draftsEqual(d, orig)) flushSaveRef.current(nicheRef.current, d);
      }
    };
  }, []);

  const setTextSlot = (field: ClientTextField, lang: DemoLang, value: string) => {
    setDraft((d) => (d ? { ...d, text: { ...d.text, [field]: { ...(d.text[field] ?? {}), [lang]: value } } } : d));
  };

  const setTermSlot = (group: TermGroup, lang: DemoLang, value: string) => {
    setDraft((d) => (d ? { ...d, terms: { ...d.terms, [group]: { ...(d.terms[group] ?? {}), [lang]: value } } } : d));
  };

  const setCategory = (value: string) => setDraft((d) => (d ? { ...d, category: value } : d));
  const setEmoji = (value: string) => setDraft((d) => (d ? { ...d, emoji: value } : d));

  if (isLoading || !client || !draft) {
    return (
      <>
        {summary && <ClientPanelHeader client={summary} category={summary.category} actions={actions} onBack={onBack} />}
        <div className="dp-panel-body">
          <div className="dp-panel-inner" aria-busy>
            <div className="h-[132px] bg-primary/10 rounded-xl animate-pulse" />
            <div className="h-[420px] bg-primary/10 rounded-xl animate-pulse" />
          </div>
        </div>
      </>
    );
  }

  // A live client's persona is managed in Account > Voice, never edited here.
  // Rendered after every hook above so the early return cannot change hook order.
  // The server also refuses PATCH/DELETE/duplicate on a live persona (409).
  if (client.isLive) return <LiveClientView client={client} onBack={onBack} actions={actions} />;

  return (
    <>
      <ClientPanelHeader
        client={{ ...client, emoji: draft.emoji.trim() || null }}
        category={draft.category}
        actions={actions}
        onBack={onBack}
        status={
          saving ? (
            <span className="inline-flex items-center gap-1.5" style={{ color: "var(--ink-soft)" }}>
              <RefreshCw className="h-3 w-3 animate-spin" />
              {t("clients.saving", "Saving...")}
            </span>
          ) : (
            <span>{t("clients.autosave")}</span>
          )
        }
      >
        <div className="la-seg la-seg--fill" role="tablist" aria-label={t("clients.viewsLabel")} style={{ maxWidth: 420 }}>
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={cn("la-seg-btn", view === v && "on")}
              onClick={() => setView(v)}
            >
              {t(`clients.views.${v}`)}
            </button>
          ))}
        </div>
      </ClientPanelHeader>

      <div className="dp-panel-body" ref={bodyRef}>
        {/* ── Everything the model reads, and where the persona is filed ── */}
        <div className="dp-panel-inner" hidden={view !== "persona"}>
          <IdentitySection category={draft.category} emoji={draft.emoji} onCategory={setCategory} onEmoji={setEmoji} />
          <PersonaSection text={draft.text} lang={personaLang} onLang={setPersonaLang} onChange={setTextSlot} />
        </div>

        {/* ── Pasted as typed, so one slot per language ── */}
        <div className="dp-panel-inner" hidden={view !== "wording"}>
          <WordsSection terms={draft.terms} onChange={setTermSlot} />
          <OpenerSection text={draft.text} onChange={setTextSlot} />
        </div>

        {/* ── What the widget and Instagram demos are dressed in ── */}
        <div className="dp-panel-inner" hidden={view !== "media"}>
          <ClientScreenshot key={`shot-${niche}`} niche={niche} screenshot={client?.screenshot ?? null} />
          <SocialPostSection
            key={`post-${niche}`}
            niche={niche}
            socialPost={client?.socialPost ?? null}
            socialImage={client?.socialImage ?? null}
          />
        </div>
      </div>
    </>
  );
}
