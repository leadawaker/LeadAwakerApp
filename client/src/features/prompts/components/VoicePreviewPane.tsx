// Preview for the voice agents' prompts (use_case voice_*): the text in the
// editor, saved or not, rendered by the engine exactly as one Client's call
// receives it (server/routes/voicePrompts.ts → engine /voice/prompt-preview).
//
// Rendered by the engine rather than here because the voice layer is filled
// by Python (persona, knowledge, wizard slots, today's date, the phone-only
// transfer section); a TypeScript copy of that would drift.
//
// The Client is one of the real accounts (Accounts.type Agency or Client),
// sent as accountId so the engine uses that account's own line. An account
// without a line, or whose line speaks another language than this prompt,
// falls back to the generic render with a short note saying why.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import { usePersistedState } from "@/hooks/usePersistedState";
import { PromptPreviewSections, buildPreviewSections, escapeHtml } from "./PromptPreviewSections";
import { MARK, splitHtmlPreservingMarks } from "../utils/resolveVariables";
import { VoiceValueEditor, isEditableValue, type EditableValue } from "./VoiceValueEditor";

type Kind = "layer" | "greeting" | "backend";

/** Which builder and language a voice use_case belongs to. */
export function voicePromptTarget(useCase: string): { kind: Kind; locale: string; leanLayer?: boolean; backendLayer?: boolean } | null {
  if (!useCase.startsWith("voice_")) return null;
  // Appended to the voice layer on website demo calls only: the plain preview shows it.
  if (useCase === "voice_public_demo_closing") return null;
  // The backend's skeleton, English on every call, filled with the saved business prompt.
  if (useCase === "voice_backend_layer") return { kind: "backend", locale: "en-GB", backendLayer: true };
  // The lean GPT Live layer under A/B test: the Voice tab's Test button runs it.
  const lean = useCase.match(/^voice_lean_layer_(.+)$/);
  if (lean) return { kind: "layer", locale: lean[1]!, leanLayer: true };
  const layer = useCase.match(/^voice_layer_(.+)$/);
  if (layer) return { kind: "layer", locale: layer[1]! };
  const greeting = useCase.match(/^voice_greeting_(.+)$/);
  if (greeting) return { kind: "greeting", locale: greeting[1]! };
  // The backend rows: voice_receptionist_demo (English), _nl, _pt.
  const lang = useCase.match(/_(nl|pt)$/)?.[1];
  return { kind: "backend", locale: lang === "nl" ? "nl" : lang === "pt" ? "pt-BR" : "en-GB" };
}

// U+E000 name U+E001 value U+E002: a filled-in value in the engine's marked text.
const FILLED = /\uE000([a-z_]+)\uE001([\s\S]*?)\uE002/g;
const STRAY = /[\uE000-\uE002]/g;

function markedToHtml(raw: string): string {
  return escapeHtml(raw)
    .replace(FILLED, (_, name: string, value: string) => `<mark ${MARK} data-var="${name}">${value}</mark>`)
    // A value cut by a section heading leaves a lone marker behind.
    .replace(STRAY, "");
}

const REAL_ACCOUNT_TYPES = new Set(["agency", "client"]);
/** Stored choice: "" = not chosen yet (the agency account), "none" = no client, else an account id. */
const NO_CLIENT = "none";

interface Preview {
  text: string;
  /** The text with each filled-in value wrapped in private-use characters (engine voice_prompt_preview_routes). */
  marked?: string | null;
  company: string | null;
  phone_line: string | null;
  locale?: string;
  chars: number;
}

type Note = { key: "noLine" | "otherLocale"; line?: string };

export function VoicePreviewPane({
  useCase,
  text,
  font,
  fontSize,
}: {
  useCase: string;
  /** The editor's current text; a new value re-renders after a short pause. */
  text: string;
  font: string;
  /** The editor's font size, so the preview reads like the normal one. */
  fontSize: number;
}) {
  const { t } = useTranslation("prompts");
  const target = useMemo(() => voicePromptTarget(useCase), [useCase]);
  const [accounts, setAccounts] = useState<{ id: number; name: string; type: string }[]>([]);
  // True once /api/accounts answered (or failed): with no real account the pane renders without a client.
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [choice, setChoice] = usePersistedState<string>("prompts-voice-preview-account", "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [folded, setFolded] = useState<Set<number>>(new Set());
  // A clicked highlight: its value opens in the pop-up; a save renders the preview again.
  const [editing, setEditing] = useState<{ name: EditableValue; rect: DOMRect } | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  // Accounts whose line cannot render this locale: skip the first request next time.
  const fallbackRef = useRef(new Map<string, Note>());

  useEffect(() => {
    apiFetch("/api/accounts")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: any[]) => {
        const real = (Array.isArray(rows) ? rows : [])
          .map((a) => ({ id: Number(a.id ?? a.Id), name: String(a.name ?? a.Name ?? ""), type: String(a.type ?? "") }))
          .filter((a) => a.id && REAL_ACCOUNT_TYPES.has(a.type.toLowerCase()));
        // The agency first (Gabriel's own line answers as Lead Awaker), then by name.
        real.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type.toLowerCase() === "agency" ? -1 : 1));
        setAccounts(real);
      })
      .catch(() => setAccounts([]))
      .finally(() => setAccountsLoaded(true));
  }, []);

  const account = useMemo(() => {
    if (choice === NO_CLIENT) return null;
    return accounts.find((a) => String(a.id) === choice) ?? accounts[0] ?? null;
  }, [accounts, choice]);

  useEffect(() => {
    if (!target) return;
    // Wait for the account list unless "no client" was chosen. If it failed or
    // came back without an Agency/Client row, `account` is null: render without one.
    if (choice !== NO_CLIENT && !accountsLoaded) return;
    let cancelled = false;
    const base = { kind: target.kind, text, locale: target.locale, leanLayer: target.leanLayer, backendLayer: target.backendLayer, mark: target.kind === "layer" || target.kind === "backend" };
    const post = (body: object) => apiFetch("/api/voice-prompts/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const fallbackKey = account ? `${account.id}|${target.locale}` : "";
        let nextNote: Note | null = account ? fallbackRef.current.get(fallbackKey) ?? null : null;
        let res: Response;
        if (account && !nextNote) {
          res = await post({ ...base, accountId: account.id });
          if (res.status === 404 || res.status === 409) {
            nextNote = { key: "noLine" };
          } else if (res.ok) {
            const body = (await res.clone().json().catch(() => ({}))) as Preview;
            // The line's own locale wins on the engine side, so a prompt in another
            // language would be rendered inside that line's setup: not what a call hears.
            if (body.locale && body.locale !== target.locale) nextNote = { key: "otherLocale", line: body.locale };
          }
          if (nextNote) {
            fallbackRef.current.set(fallbackKey, nextNote);
            res = await post({ ...base, niche: null });
          }
        } else {
          res = await post({ ...base, niche: null });
        }
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(body?.message || t("voicePreview.failed"));
        } else {
          setPreview(body as Preview);
          setNote(nextNote);
          setError(null);
        }
      } catch {
        if (!cancelled) setError(t("voicePreview.failed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [target, text, account, choice, accountsLoaded, savedTick, t]);

  // The values the engine filled in (company, agent, business, tone...) get the same highlight as the normal preview.
  const sections = useMemo(
    () => preview?.marked
      ? buildPreviewSections(preview.marked, markedToHtml, splitHtmlPreservingMarks)
      : buildPreviewSections(preview?.text ?? "", escapeHtml, (html) => html.split("\n")),
    [preview?.text, preview?.marked],
  );

  if (!target) return null;
  // Values are editable only when they are this account's own (not the generic render).
  const editable = !!account && !note && !!preview?.marked;

  const toggleFold = (lineIndex: number) => setFolded((prev) => {
    const next = new Set(prev);
    if (next.has(lineIndex)) next.delete(lineIndex); else next.add(lineIndex);
    return next;
  });

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: "var(--paper)" }}>
      <div
        className="flex items-center gap-2 shrink-0 px-5 pt-3 pb-2 flex-wrap"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <span className="eyebrow eyebrow-sm" style={{ color: "var(--mute-2)" }}>
          {t("voicePreview.client")}
        </span>
        <select
          className="neu-inset-super-crisp px-2 py-1 text-xs"
          value={account ? String(account.id) : NO_CLIENT}
          onChange={(e) => setChoice(e.target.value)}
          style={{ maxWidth: 220 }}
          aria-label={t("voicePreview.client")}
        >
          <option value={NO_CLIENT}>{t("voicePreview.noClient")}</option>
          {accounts.map((a) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
        </select>
        <span style={{ fontSize: 11, color: "var(--mute)" }}>
          {t(`voicePreview.kind.${target.kind}`)} · {target.locale}
        </span>
        <span className="ml-auto flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--mute)" }}>
          {loading && <Loader2 size={12} className="animate-spin" />}
          {preview && t("voicePreview.chars", { count: preview.chars })}
        </span>
      </div>
      {note && account && (
        <div className="shrink-0 px-5 pt-2" style={{ fontSize: 11, color: "var(--warn)" }}>
          {note.key === "noLine"
            ? t("voicePreview.noLine", { name: account.name })
            : t("voicePreview.otherLocale", { name: account.name, line: note.line, prompt: target.locale })}
        </div>
      )}
      {!note && preview?.phone_line && (
        <div className="shrink-0 px-5 pt-2" style={{ fontSize: 11, color: "var(--mute)" }}>
          {t("voicePreview.phoneLine", { number: preview.phone_line })}
        </div>
      )}
      <div
        className={cn("flex-1 min-h-0 overflow-y-auto px-5 py-4 [scrollbar-width:thin]", editable && "la-voice-editable")}
        onClick={editable ? (e) => {
          const mark = (e.target as HTMLElement).closest("mark[data-var]") as HTMLElement | null;
          const name = mark?.dataset.var;
          if (mark && name && isEditableValue(name)) setEditing({ name, rect: mark.getBoundingClientRect() });
        } : undefined}
      >
        {error ? (
          <span style={{ fontSize: 12, color: "hsl(var(--destructive))" }}>{error}</span>
        ) : (
          <PromptPreviewSections sections={sections} folded={folded} onToggleFold={toggleFold} fontSize={fontSize} font={font} />
        )}
      </div>
      {editing && account && (
        <VoiceValueEditor
          key={`${editing.name}-${editing.rect.top}`}
          accountId={account.id}
          name={editing.name}
          rect={editing.rect}
          onClose={() => setEditing(null)}
          onSaved={() => setSavedTick((n) => n + 1)}
        />
      )}
    </div>
  );
}
