// Reads a variable's stored value from its source and saves an edit back to
// it, then checks the saved row really holds the new value ("saves but doesn't
// stick" is the failure this guards against: Zod strips keys it does not know,
// and an UPDATE on a missing niche row changes nothing without an error).
// Timestamps are never sent: every route sets updated_at itself.
import { apiFetch } from "@/lib/apiUtils";
import { parseLangField } from "@shared/langField";
import { normalizeIntake } from "@shared/voiceIntake";
import type { VarSource, NicheTermGroup, NichePackField } from "./variableRegistry";

export type WordGroups = Record<NicheTermGroup, string[]>;
export interface VocabRow { niche: string; nl: WordGroups; en: WordGroups }
export type PackTemplates = Partial<Record<NichePackField, { nl?: string; en?: string }>>;
export interface DemoClientEditable {
  niche: string;
  label: string;
  isLive?: boolean;
  bookingModeCall?: boolean;
  text: Record<string, { en?: string; nl?: string; pt?: string }>;
  terms: Record<string, { en: string[]; nl: string[]; pt: string[] }>;
}

/** The fields of GET /api/accounts/:id/voice a variable reads or checks. */
export interface VoiceLineValues {
  persona: { companyName: string; description: string } | null;
  intake: string | null;
  extraInstructions: string | null;
}

/** Everything a write needs about the picked preview context. */
export interface WriteTarget {
  /** A voice prompt's picked account, with its line once loaded. `own`: the render really is this line's. */
  voice?: { accountId: number; accountName: string; line: VoiceLineValues | null; own: boolean } | null;
  campaignRaw: Record<string, any> | null;
  accountRaw: Record<string, any> | null;
  /** The niche key whose words are read and written ("__default__" when the campaign has none). */
  vocabNiche: string;
  vocabRow: VocabRow | null;
  packs: PackTemplates | null;
  client: DemoClientEditable | null;
  /** Language slot for {en,nl} campaign fields and niche words. */
  fieldLang: "en" | "nl";
  /** Language slot for a demo Client (en, nl or pt). */
  clientLang: "en" | "nl" | "pt";
}

export type WriteResult =
  | { ok: true; campaignRow?: any; accountRow?: any; vocabRow?: VocabRow; packs?: PackTemplates; client?: DemoClientEditable; voiceLine?: any }
  | { ok: false; reason: "http" | "notStored" | "noTarget" | "live"; message?: string };

/** The API's db column name for a camelCase field (First_Message is the one odd one). */
export function dbKey(field: string): string {
  if (field === "firstMessage") return "First_Message";
  return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

const rowValue = (row: Record<string, any> | null, field: string) =>
  row ? (row[dbKey(field)] ?? row[field]) : undefined;

/** The stored value an edit starts from. */
export function readStored(src: VarSource, tg: WriteTarget): string {
  switch (src.kind) {
    case "campaign": {
      const raw = rowValue(tg.campaignRaw, src.field);
      if (src.lang) return parseLangField(raw)[tg.fieldLang] ?? "";
      return raw == null ? "" : String(raw);
    }
    case "account": {
      const raw = rowValue(tg.accountRaw, src.field);
      return raw == null ? "" : String(raw);
    }
    case "nicheTerm": {
      const words = tg.vocabRow?.[tg.fieldLang]?.[src.group] ?? [];
      return src.list ? words.join(", ") : (words[0] ?? "");
    }
    case "nichePack":
      return tg.packs?.[src.field]?.[tg.fieldLang] ?? "";
    case "clientText":
      return tg.client?.text?.[src.field]?.[tg.clientLang] ?? "";
    case "clientTerm": {
      const words = tg.client?.terms?.[src.group]?.[tg.clientLang] ?? [];
      return src.list ? words.join(", ") : (words[0] ?? "");
    }
    case "voiceLine":
      return voiceField(tg.voice?.line ?? null, src.field);
    default:
      return "";
  }
}

function voiceField(line: VoiceLineValues | null, field: Extract<VarSource, { kind: "voiceLine" }>["field"]): string {
  if (field === "companyName") return line?.persona?.companyName ?? "";
  if (field === "description") return line?.persona?.description ?? "";
  return line?.[field] ?? "";
}

async function send(url: string, method: string, body: unknown): Promise<{ ok: boolean; status: number; json: any }> {
  const res = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

const fail = (status: number, json: any): WriteResult => ({
  ok: false, reason: status === 409 ? "live" : "http", message: json?.message || json?.error || `HTTP ${status}`,
});

const splitList = (v: string) => Array.from(new Set(v.split(",").map((w) => w.trim()).filter(Boolean)));
/** A new first word in front of the rest of the list. */
const withFirst = (list: string[], word: string) => (word ? [word, ...list.slice(1).filter((w) => w !== word)] : list.slice(1));
const sameList = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every((w, i) => w === b[i]);

/** Saves `value` where the variable lives and confirms the saved row holds it. */
export async function writeVariable(src: VarSource, tg: WriteTarget, value: string): Promise<WriteResult> {
  const v = value.trim();
  switch (src.kind) {
    case "campaign": {
      const id = tg.campaignRaw?.id ?? tg.campaignRaw?.Id;
      if (!id) return { ok: false, reason: "noTarget" };
      let next: unknown = v || null;
      if (src.lang) {
        // Merge into the {en,nl} object; a legacy plain string keeps its other language.
        const field = parseLangField(rowValue(tg.campaignRaw, src.field));
        const merged: Record<string, string> = {};
        for (const [k, s] of Object.entries(field)) if (s) merged[k] = s;
        if (v) merged[tg.fieldLang] = v; else delete merged[tg.fieldLang];
        next = Object.keys(merged).length ? JSON.stringify(merged) : null;
      } else if (src.input === "int") {
        next = v === "" ? null : Number.parseInt(v, 10);
        if (next !== null && !Number.isFinite(next)) return { ok: false, reason: "http", message: "Not a number" };
      }
      const r = await send(`/api/campaigns/${id}`, "PATCH", { [src.field]: next });
      if (!r.ok) return fail(r.status, r.json);
      const stored = rowValue(r.json, src.field);
      const held = src.lang ? (parseLangField(stored)[tg.fieldLang] ?? "") === v : String(stored ?? "") === String(next ?? "");
      return held ? { ok: true, campaignRow: r.json } : { ok: false, reason: "notStored" };
    }
    case "account": {
      const id = tg.accountRaw?.id ?? tg.accountRaw?.Id;
      if (!id) return { ok: false, reason: "noTarget" };
      const r = await send(`/api/accounts/${id}`, "PATCH", { [src.field]: v || null });
      if (!r.ok) return fail(r.status, r.json);
      return String(rowValue(r.json, src.field) ?? "") === v ? { ok: true, accountRow: r.json } : { ok: false, reason: "notStored" };
    }
    case "nicheTerm": {
      if (!tg.vocabRow) return { ok: false, reason: "noTarget" };
      const both = { nl: { ...tg.vocabRow.nl }, en: { ...tg.vocabRow.en } };
      const current = both[tg.fieldLang][src.group] ?? [];
      const nextList = src.list ? splitList(v) : withFirst(current, v);
      both[tg.fieldLang] = { ...both[tg.fieldLang], [src.group]: nextList };
      const r = await send(`/api/niche-vocabulary/${encodeURIComponent(tg.vocabNiche)}`, "PUT", both);
      if (!r.ok) return fail(r.status, r.json);
      const saved = r.json?.[tg.fieldLang]?.[src.group] as string[] | undefined;
      if (!sameList(saved, nextList)) return { ok: false, reason: "notStored" };
      return { ok: true, vocabRow: { niche: tg.vocabNiche, nl: r.json.nl, en: r.json.en } };
    }
    case "nichePack": {
      // Through the Clients route, not /niche-vocabulary/:niche/template: that one rewrites a pack
      // as { nl, en } and would drop its pt slot. This one merges one slot and answers with the row.
      const r = await send(`/api/demo/clients/${encodeURIComponent(tg.vocabNiche)}`, "PATCH", {
        text: { [src.field]: { [tg.fieldLang]: v } },
      });
      if (!r.ok) return fail(r.status, r.json);
      const slot = r.json?.client?.text?.[src.field] as { nl?: string; en?: string } | undefined;
      if ((slot?.[tg.fieldLang] ?? "") !== v) return { ok: false, reason: "notStored" };
      return { ok: true, packs: { ...tg.packs, [src.field]: slot } };
    }
    case "voiceLine": {
      if (!tg.voice?.own) return { ok: false, reason: "noTarget" };
      const body = src.field === "companyName" || src.field === "description"
        ? { persona: { [src.field]: v } }
        : { [src.field]: v };
      const r = await send(`/api/accounts/${tg.voice.accountId}/voice`, "PUT", body);
      // The route's own sentence, whatever the status (a 409 here is not a live persona).
      if (!r.ok) return { ok: false, reason: "http", message: r.json?.message || `HTTP ${r.status}` };
      // The server keeps intake to 6 lines of 120 characters, so compare with what it would keep.
      const expected = src.field === "intake" ? normalizeIntake(v) : v;
      return voiceField(r.json, src.field).trim() === expected ? { ok: true, voiceLine: r.json } : { ok: false, reason: "notStored" };
    }
    case "clientText":
    case "clientTerm": {
      if (!tg.client) return { ok: false, reason: "noTarget" };
      if (tg.client.isLive) return { ok: false, reason: "live" };
      const lang = tg.clientLang;
      let body: unknown;
      let nextList: string[] = [];
      if (src.kind === "clientText") body = { text: { [src.field]: { [lang]: v } } };
      else {
        const current = tg.client.terms?.[src.group]?.[lang] ?? [];
        nextList = src.list ? splitList(v) : withFirst(current, v);
        body = { terms: { [src.group]: { [lang]: nextList } } };
      }
      const r = await send(`/api/demo/clients/${encodeURIComponent(tg.client.niche)}`, "PATCH", body);
      if (!r.ok) return fail(r.status, r.json);
      const client = r.json?.client as DemoClientEditable | null;
      const held = src.kind === "clientText"
        ? (client?.text?.[src.field]?.[lang] ?? "") === v
        : sameList(client?.terms?.[src.group]?.[lang], nextList);
      return held && client ? { ok: true, client } : { ok: false, reason: "notStored" };
    }
    default:
      return { ok: false, reason: "noTarget" };
  }
}
