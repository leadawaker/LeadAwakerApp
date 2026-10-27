import type { DemoLang } from "@/features/campaigns/api/demoClientsApi";
import type { DemoProduct } from "@shared/demoProducts";
import type { AiDisclosure, DemoMarket } from "@shared/demoProspects";
import { currentUserKey, store, type Store } from "@/lib/lastTab";

// What Gabriel has typed in the New demo panel, kept in localStorage per user so a tab
// switch or a reload never loses it. It stays until he presses Clear. Pure: storage is
// injected (like lib/lastTab.ts) and only `import type` comes from api files.

export type CreateMode = "existing" | "website";

export interface ScanReview {
  client: string;
  language: DemoLang;
  summary: string;
  products: DemoProduct[];
  city: string;
  stockUrl: string;
}

export interface DemoDraft {
  v: 1;
  mode: CreateMode;
  firstName: string;
  companyName: string;
  clientNiche: string;
  language: DemoLang;
  aiDisclosure: AiDisclosure;
  market: DemoMarket;
  moreOpen: boolean;
  websiteUrl: string;
  foldOpen: boolean;
  nicheText: string;
  notes: string;
  prospectGroup: string;
  review: ScanReview | null;
}

const MODES: readonly CreateMode[] = ["existing", "website"];
const LANGUAGES: readonly DemoLang[] = ["en", "nl", "pt"];
const DISCLOSURES: readonly AiDisclosure[] = ["", "off", "opener", "second_message"];
const MARKETS: readonly DemoMarket[] = ["", "uk", "us", "nl"];

const STRING_FIELDS = ["firstName", "companyName", "clientNiche", "websiteUrl", "nicheText", "notes"] as const;
const BOOLEAN_FIELDS = ["moreOpen", "foldOpen"] as const;

export function draftKey(user: string): string {
  return `la.demoDraft.${user}`;
}

export function emptyDraft(prospectGroup: string): DemoDraft {
  return {
    v: 1,
    mode: "existing",
    firstName: "",
    companyName: "",
    clientNiche: "",
    language: "en",
    aiDisclosure: "",
    market: "",
    moreOpen: false,
    websiteUrl: "",
    foldOpen: false,
    nicheText: "",
    notes: "",
    prospectGroup,
    review: null,
  };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function oneOf<T extends string>(list: readonly T[], x: unknown): x is T {
  return typeof x === "string" && (list as readonly string[]).includes(x);
}

function isProduct(x: unknown): x is DemoProduct {
  return isRecord(x) && typeof x.name === "string" && typeof x.detail === "string" && typeof x.price === "string";
}

function isReview(x: unknown): x is ScanReview {
  return (
    isRecord(x) &&
    typeof x.client === "string" &&
    oneOf(LANGUAGES, x.language) &&
    typeof x.summary === "string" &&
    Array.isArray(x.products) &&
    x.products.every(isProduct) &&
    typeof x.city === "string" &&
    typeof x.stockUrl === "string"
  );
}

/** The stored value as a draft, or null when it is not exactly the current shape. */
function parseDraft(raw: unknown, newId: () => string): DemoDraft | null {
  if (!isRecord(raw) || raw.v !== 1) return null;
  if (!oneOf(MODES, raw.mode) || !oneOf(LANGUAGES, raw.language)) return null;
  if (!oneOf(DISCLOSURES, raw.aiDisclosure) || !oneOf(MARKETS, raw.market)) return null;
  if (STRING_FIELDS.some((k) => typeof raw[k] !== "string")) return null;
  if (BOOLEAN_FIELDS.some((k) => typeof raw[k] !== "boolean")) return null;
  const group = raw.prospectGroup;
  if (group !== undefined && typeof group !== "string") return null;
  const review = raw.review;
  if (review !== null && !isReview(review)) return null;
  return { ...(raw as unknown as DemoDraft), prospectGroup: group || newId(), review };
}

/** Missing, throwing, unreadable or older-shaped storage all read as an empty draft. */
export function readDraft(newId: () => string, s: Store | null = store()): DemoDraft {
  try {
    const raw = s?.getItem(draftKey(currentUserKey(s)));
    if (raw) {
      const draft = parseDraft(JSON.parse(raw), newId);
      if (draft) return draft;
    }
  } catch {
    /* falls through to an empty draft */
  }
  return emptyDraft(newId());
}

export function writeDraft(d: DemoDraft, s: Store | null = store()): void {
  try {
    s?.setItem(draftKey(currentUserKey(s)), JSON.stringify(d));
  } catch {
    /* the draft just is not remembered */
  }
}

/** Store has no removeItem, so Clear overwrites the key with a fresh empty draft (new prospect group). */
export function clearDraft(newId: () => string, s: Store | null = store()): DemoDraft {
  const fresh = emptyDraft(newId());
  writeDraft(fresh, s);
  return fresh;
}

/** After a prospect is added the fields stay (until Clear); the next add is a new prospect. */
export function afterAdd(d: DemoDraft, newId: () => string): DemoDraft {
  return { ...d, prospectGroup: newId() };
}
