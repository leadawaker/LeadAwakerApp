// The Variables panel beside the preview: every variable the prompt's text uses,
// grouped by where its value lives, with the value for the picked context. The
// list comes from the text; the registry only adds meaning and the save target.
// The same panel serves chat prompts (a campaign or demo client) and voice
// prompts (an account's line).
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { receptionistSettingsHref } from "@/features/accounts/components/workspace/receptionist/settingsLink";
import { CARD_SECTION } from "@/features/accounts/components/workspace/voice/readiness";
import {
  KNOWN_VARIABLES, KNOWN_VOICE_VARIABLES, variableSource,
  type VarSource, type VariableContextKind, type VoiceCardLink,
} from "../../utils/variableRegistry";
import type { WriteResult, WriteTarget } from "../../utils/variableWrites";
import { VariableRow } from "./VariableRow";

type GroupKey = "campaign" | "client" | "account" | "niche" | "voice" | "elsewhere" | "auto" | "unknown";
const GROUP_ORDER: GroupKey[] = ["client", "campaign", "account", "niche", "voice", "elsewhere", "auto", "unknown"];

function groupOf(src: VarSource | undefined): GroupKey {
  if (!src) return "unknown";
  switch (src.kind) {
    case "campaign": return "campaign";
    case "account": return "account";
    case "nicheTerm": case "nichePack": return "niche";
    case "clientText": case "clientTerm": return "client";
    case "voiceLine": case "voicePopup": return "voice";
    default: return src.card ? "elsewhere" : "auto";
  }
}

const isPersonaField = (src: VarSource) => src.kind === "voiceLine" && (src.field === "companyName" || src.field === "description");

export function VariablesPanel({
  kind, contextId, names, values, target, campaignName, accountName, needsContext, fullWidth, notes, justSaved,
  onSaved, onInsert, onOpenPopup, editRequest,
}: {
  kind: VariableContextKind;
  /** Changes with the picked context, so a row's edit never carries over. */
  contextId: string;
  /** Variables found in the prompt's text, in order. */
  names: string[];
  /** Resolved values for the picked context. */
  values: Record<string, string | null | undefined>;
  target: WriteTarget;
  campaignName?: string;
  accountName?: string | null;
  /** Nothing is picked: says how to get values. */
  needsContext?: boolean;
  /** On a narrow column the panel takes the text's place. */
  fullWidth?: boolean;
  /** Per variable, a remark on this render (e.g. another setting overrides it). */
  notes?: Record<string, string>;
  /** The variable whose pop-up editor just saved. */
  justSaved?: string | null;
  onSaved: (result: WriteResult) => void;
  onInsert: (name: string) => void;
  /** Opens VoiceValueEditor for a structured voice value. */
  onOpenPopup?: (value: Extract<VarSource, { kind: "voicePopup" }>["value"], name: string, rect: DOMRect) => void;
  /** A value clicked in the preview: that row opens its editor. `n` makes a repeat click count. */
  editRequest?: { name: string; n: number } | null;
}) {
  const { t, i18n } = useTranslation("prompts");

  /** Why this source can't be saved in the picked context, if so. */
  const blocked = (src: VarSource | undefined): string | null => {
    if (!src || src.kind === "readonly") return null;
    if (src.kind === "campaign" && !target.campaignRaw) return t("vars.pickContext");
    if (src.kind === "account" && !target.accountRaw) return t("vars.pickContext");
    if (src.kind === "nicheTerm" && !target.vocabRow) return t("vars.noNicheRow");
    if (src.kind === "nichePack" && !target.packs) return t("vars.noNicheRow");
    if (src.kind === "clientText" || src.kind === "clientTerm") {
      if (!target.client) return t("vars.pickContext");
      if (target.client.isLive) return t("vars.liveClient");
    }
    if (src.kind === "voiceLine" || src.kind === "voicePopup") {
      if (!target.voice) return t("vars.pickAccount");
      if (!target.voice.own) return t("vars.voiceGeneric");
      if (isPersonaField(src) && target.voice.line && !target.voice.line.persona) return t("vars.noPersona");
    }
    return null;
  };

  const savesTo = (src: VarSource | undefined): string | null => {
    if (!src) return null;
    const account = target.voice?.accountName ?? "";
    switch (src.kind) {
      case "campaign": {
        const base = t("vars.savesTo.campaign", { name: campaignName ?? "" });
        return src.lang ? t("vars.langSlot", { target: base, lang: t(`vars.lang.${target.fieldLang}`) }) : base;
      }
      case "account":
        return t("vars.savesTo.account", { name: accountName ?? "" });
      case "nicheTerm":
      case "nichePack":
        return target.vocabNiche === "__default__"
          ? t("vars.savesTo.nicheDefault")
          : t("vars.savesTo.niche", { name: target.vocabNiche });
      case "clientText":
      case "clientTerm":
        return t("vars.langSlot", {
          target: t("vars.savesTo.client", { name: target.client?.label ?? "" }),
          lang: t(`vars.lang.${target.clientLang}`),
        });
      case "voiceLine":
        return t(isPersonaField(src) ? "vars.savesTo.persona" : "vars.savesTo.voiceSetup", { name: account });
      case "voicePopup":
        return t(src.home === "profile" ? "vars.savesTo.voiceProfile" : "vars.savesTo.voiceSetup", { name: account });
      default:
        return null;
    }
  };

  /** Its card in Call settings, for the picked account. */
  const cardLink = (card: VoiceCardLink | undefined) => {
    if (!card || !target.voice) return null;
    return {
      href: receptionistSettingsHref("voice", { accountId: target.voice.accountId, section: CARD_SECTION[card], focus: card }),
      label: t("vars.editInCallSettings"),
    };
  };

  const groups = useMemo(() => {
    const out = new Map<GroupKey, string[]>();
    for (const name of names) {
      const key = groupOf(variableSource(name, kind));
      out.set(key, [...(out.get(key) ?? []), name]);
    }
    return GROUP_ORDER.filter((g) => out.has(g)).map((g) => [g, out.get(g)!] as const);
  }, [names, kind]);

  const unused = useMemo(
    () => (kind === "voice" ? KNOWN_VOICE_VARIABLES : KNOWN_VARIABLES).filter((v) => !names.includes(v)).sort(),
    [names, kind],
  );

  return (
    <div className="flex flex-col min-h-0" style={fullWidth ? { flex: 1, minWidth: 0 } : { width: 272, flexShrink: 0, borderLeft: "1px solid var(--line)" }}>
      <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin]">
        {names.length === 0 && <p style={{ fontSize: 12, color: "var(--mute)", padding: "12px" }}>{t("vars.none")}</p>}
        {needsContext && names.length > 0 && (
          <p style={{ fontSize: 11.5, color: "var(--mute)", padding: "10px 12px" }}>{t(kind === "voice" ? "vars.pickAccount" : "vars.pickContext")}</p>
        )}
        {groups.map(([group, list]) => (
          <section key={group} aria-label={t(`vars.group.${group}`)}>
            <h3 style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink)", padding: "12px 12px 6px" }}>
              {t(`vars.group.${group}`)}
            </h3>
            {list.map((name) => {
              const source = variableSource(name, kind);
              const descKey = `${kind === "voice" ? "vars.voiceDesc" : "vars.desc"}.${name}`;
              const reason = blocked(source);
              const editable = !!source && source.kind !== "readonly" && !reason;
              const note = source?.kind === "readonly" ? t(`vars.note.${source.note}`) : reason;
              return (
                <VariableRow
                  key={`${contextId}:${target.vocabNiche}:${name}`}
                  name={name}
                  description={i18n.exists(descKey, { ns: "prompts" }) ? t(descKey) : null}
                  value={String(values[name] ?? "")}
                  source={source}
                  editable={editable}
                  savesTo={savesTo(source)}
                  readOnlyNote={note}
                  remark={notes?.[name] ?? null}
                  link={source?.kind === "readonly" ? cardLink(source.card) : reason && source && isPersonaField(source) ? cardLink("persona") : null}
                  justSaved={justSaved === name}
                  target={target}
                  onSaved={onSaved}
                  onInsert={onInsert}
                  onOpenPopup={onOpenPopup}
                  editSignal={editRequest?.name === name ? editRequest.n : 0}
                />
              );
            })}
          </section>
        ))}
      </div>
      <div style={{ borderTop: "1px solid var(--line)", padding: "8px 12px" }}>
        <select
          className="neu-inset-super-crisp outline-none cursor-pointer w-full"
          style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-soft)", borderRadius: "var(--r-flush)", padding: "4px 6px", border: "none" }}
          value=""
          onChange={(e) => { if (e.target.value) onInsert(e.target.value); }}
          aria-label={t("vars.addVariable")}
        >
          <option value="">{t("vars.addVariable")}</option>
          {unused.map((v) => <option key={v} value={v}>{`{${v}}`}</option>)}
        </select>
      </div>
    </div>
  );
}
