import crypto from "crypto";
import { db } from "./db";
import { leads, campaigns, promptLibrary } from "@shared/schema";
import { eq } from "drizzle-orm";

export const UNIVERSAL_DEMO_CAMPAIGN_ID = 60;

// Latest OpenAI mini model, shared by all demo/campaign generators in this file.
// The un-dated alias auto-tracks new snapshots of this model; generation jumps
// (e.g. a future gpt-6-mini) still need a manual bump here. Note the gpt-5+
// families require `max_completion_tokens` and reject custom `temperature`.
export const NICHE_GENERATOR_MODEL = "gpt-5.4-mini";

/** Scenario picked on the homepage toggle. Maps onto Prompt 93's lead_stage. */
export type DemoScenario = "inquired" | "deciding" | "declined";

/** Canonical English phrasing per scenario; derive_lead_stage (engine) keys off these. */
const SCENARIO_WHAT_LEAD_DID: Record<DemoScenario, string> = {
  inquired: "Inquired about a quote",
  deciding: "In the decision phase",
  declined: "Declined / went with another provider",
};

export interface NicheContext {
  raw: string;
  niche_label: string;
  company_name: string;
  service_name: string;
  usp: string;
  business_description: string;
  booking_mode_call: boolean;
  what_lead_did: string;
  when_label: string;
  niche_question: string;
  first_message: string;
  // The customer's own words for what they want ("new windows or doors"),
  // reused by Prompt 93 as {opener_phrase}. Never the commercial arrangement.
  opener_phrase: string;
  // Scoping ladder for this niche, generated at demo-creation time. Same text
  // shape as Niche_Vocabulary.scoping_ladder so the prompt reads it identically.
  scoping_ladder: string;
  // What this lead already told the business, in their own words. Lands on the
  // campaign's lead_context via the demo overlay, so the ladder can skip a slot
  // it was already given instead of asking a question the lead just answered.
  // One short sentence: two facts at most, or it pre-fills the whole ladder and
  // there is nothing left for the demo to demonstrate.
  lead_context: string;
  // Knowledge-base facts for the conversation prompt ({kb}).
  kb: string;
  // Per-niche vocabulary for Prompt 93 substitution.
  advisor_term: string;
  project_term: string;
  proposal_term: string;
  visit_term: string;
  decision_term: string;
  // Niche-specific example packs. The engine APPENDS these to the generic
  // __default__ Niche_Vocabulary packs (it never replaces them), so an
  // arbitrary demo niche gets its own decision factors and objections on
  // top of the proven conversation craft. Newline-separated strings.
  niche_question_bank: string;
  niche_objection_examples: string;
  // Reactivation context. lead_stage comes from the scenario toggle; the other
  // three are fixed demo defaults applied in code, not produced by the model.
  lead_stage: DemoScenario;
  inquiry_timeframe: string;
  first_touch: string;
  ai_style: string;
  // AI disclosure mode for THIS session. Derived from the visitor's language,
  // never produced by the model. See DEMO_AI_DISCLOSURE below.
  ai_disclosure: AiDisclosureMode;
}

/** The three AI disclosure modes. Mirrors normalize_ai_disclosure() in the engine. */
export type AiDisclosureMode = "off" | "opener" | "second_message";

/**
 * AI disclosure is a per-CAMPAIGN column, but every public demo runs on campaign
 * 60 while each visitor picks their own language, and the disclosure requirement
 * is jurisdictional. One campaign row cannot serve a UK visitor (no disclosure)
 * and a Dutch visitor (opener disclosure) at the same time, which is exactly
 * what sending demo links to UK, Brazilian and Dutch prospects requires.
 *
 * So the demo session carries its own mode on the lead, in demo_niche, the same
 * way it already carries opener_phrase, scoping_ladder and the niche vocabulary.
 * The engine's _overlay_demo_niche_onto_campaign passes it through as a plain
 * value like all its siblings; it stays a dumb passthrough and learns no
 * jurisdiction rules. This map is the only place the policy exists.
 *
 * Real campaigns are unaffected: the overlay only fires for leads carrying
 * demo_niche, so for them the DB column remains the single source of truth.
 */
const DEMO_AI_DISCLOSURE: Record<string, AiDisclosureMode> = {
  en: "off", // UK: no disclosure anywhere
  nl: "opener", // Netherlands / EU (AI Act Art 50): disclose in the opener
  pt: "second_message", // Brazil: not in the opener, in the AI's first reply
};

/** Localized "six months ago" default for {inquiry_timeframe}. */
const INQUIRY_TIMEFRAME_DEFAULT: Record<string, string> = {
  en: "six months ago",
  nl: "zes maanden geleden",
  pt: "seis meses atrás",
};

/**
 * Apply the fixed reactivation defaults Gabriel specified for the universal demo:
 * AI style = Practical, inquiry timeframe = six months ago, first touch = the
 * niche's own visit term (e.g. "showroom visit" for kitchens), and the chosen
 * scenario as both lead_stage and a canonical what_lead_did the engine can map.
 */
export function applyDemoDefaults(ctx: NicheContext, language: string, scenario: DemoScenario): NicheContext {
  ctx.lead_stage = scenario;
  ctx.what_lead_did = SCENARIO_WHAT_LEAD_DID[scenario];
  ctx.inquiry_timeframe = INQUIRY_TIMEFRAME_DEFAULT[language] ?? INQUIRY_TIMEFRAME_DEFAULT.en;
  ctx.first_touch = ctx.visit_term || (language === "nl" ? "bezoek" : language === "pt" ? "visita" : "visit");
  ctx.ai_style = "Practical";
  // Set in code, never asked of the model: this is a compliance setting, and an
  // LLM-generated one would be a compliance setting that can hallucinate.
  // Both construction paths (generateNicheContext and the fallback template)
  // funnel through here, so neither can ship a session without a mode.
  ctx.ai_disclosure = DEMO_AI_DISCLOSURE[language] ?? "opener";
  return ctx;
}

/**
 * Last-resort scoping ladder for when the generator produced none.
 *
 * It must never be empty. The engine's demo overlay skips empty values and the
 * Niche_Vocabulary packs are merged BEFORE the overlay, so an empty ladder does
 * not fall through to a neutral default: it inherits the underlying demo
 * campaign's ladder (campaign 60 = Solar Panels). A generic ladder that asks
 * about scope, size and the current situation is on-topic for any trade and
 * cannot ask a dental-implant visitor about roof faces.
 *
 * Deliberately generic and only 3 slots. It claims no trade knowledge it does
 * not have, and no timing / budget / financing slots (Prompt 93 handles those).
 */
export function buildGenericScopingLadder(niche: string, language: string): string {
  const n = (niche || "").trim() || "the project";
  if (language === "nl") {
    return [
      "SLOT 1 - omvang van het werk",
      "Doel: bepaalt welke onderdelen wel en niet in de offerte komen.",
      `Vraag: "wat zou je precies gedaan willen hebben rond ${n}, in je eigen woorden?"`,
      "Opties: open.",
      "",
      "SLOT 2 - grootte of aantal",
      "Doel: bepaalt hoeveel arbeid en materiaal er in de offerte gaat.",
      'Vraag: "om hoeveel of hoe groot gaat het ongeveer?"',
      "Opties: open.",
      "",
      "SLOT 3 - huidige situatie",
      "Doel: bepaalt of er eerst iets weg moet of hersteld moet worden, meestal een aparte post op de offerte.",
      'Vraag: "is er nu al iets aanwezig dat vervangen moet worden, of beginnen we vanaf nul?"',
      "Opties: vervangen, vanaf nul, weet ik nog niet.",
    ].join("\n");
  }
  if (language === "pt") {
    return [
      "SLOT 1 - escopo",
      "Objetivo: define o que entra e o que fica fora do orçamento.",
      `Pergunta: "o que exatamente você gostaria de fazer em relação a ${n}, com suas próprias palavras?"`,
      "Opções: aberto.",
      "",
      "SLOT 2 - tamanho ou quantidade",
      "Objetivo: define quanta mão de obra e material entram no orçamento.",
      'Pergunta: "mais ou menos que tamanho tem, ou quantos seriam?"',
      "Opções: aberto.",
      "",
      "SLOT 3 - situação atual",
      "Objetivo: define se algo precisa ser retirado ou reparado antes, o que normalmente vira um item separado no orçamento.",
      'Pergunta: "já tem alguma coisa no local que precisa ser substituída, ou seria começar do zero?"',
      "Opções: substituir o que existe, começar do zero, ainda não sei.",
    ].join("\n");
  }
  return [
    "SLOT 1 - scope",
    "Purpose: sets which parts of the job are in the quote and which are not.",
    `Ask: "what exactly would you want done around ${n}, in your own words?"`,
    "Options: open.",
    "",
    "SLOT 2 - size or quantity",
    "Purpose: scales the labour and materials on the quote.",
    'Ask: "roughly what size, or how many are we talking about?"',
    "Options: open.",
    "",
    "SLOT 3 - current situation",
    "Purpose: decides whether existing work has to come out or be made good first, usually a separate line on the quote.",
    'Ask: "is there something there already that needs replacing, or is this starting from scratch?"',
    "Options: replacing existing, starting from scratch, not sure.",
  ].join("\n");
}

const NICHE_GENERATOR_SYSTEM_FALLBACK = `You generate realistic demo context for a lead reactivation AI sales demo.
Given a business niche, output a JSON object with EXACTLY these keys:

- niche_label: short 1-2 word label (e.g. "Solar", "Dental Care", "Gym")
- company_name: a realistic local company name for that niche (e.g. "SolarMax", "SmileBright Dental", "Peak Performance Gym")
- service_name: what this business wants the lead to buy: lowercase, verb in gerund (e.g. "getting solar panels installed", "booking a dental check-up", "signing up for a gym membership")
- usp: the company's key value proposition — pick ONE: price driven, premium focused, speed, convenience, customization, innovation
- business_description: 1-2 sentence company description referencing the USP (e.g. "We provide premium dental care with same-day appointments and a focus on patient comfort.")
- booking_mode_call: boolean. true if the business closes leads via a phone or video call with a specialist before the service begins (solar quote, online legal advice, coaching intake, financial planning, insurance). false if the business takes direct in-person appointments at a physical location (dental checkup, physio, hair salon, gym class, doctor visit). When unsure for a physical location business, default to false.
- what_lead_did: what the lead did in the past — do NOT include a time reference (that comes from when_label). If booking_mode_call is true, use one of: "had a consultation call with our team about [service]" / "requested a callback regarding [service]" / "spoke with one of our agents about [service]". If false: "booked a [service] appointment with us" / "made an inquiry about [service] on our website" / "signed up for a [service] trial"
- when_label: time reference only, no action (e.g. "a few months ago", "some time ago", "recently")
- kb: 4-6 concrete knowledge-base facts the AI should know about this business (numbers, timelines, guarantees, common objection rebuttals). Newline-separated, NOT an array.
- advisor_term: the human role a lead books a call/appointment with for this niche (e.g. "solar advisor", "dental hygienist", "personal trainer", "kitchen designer")
- project_term: what the engagement is about (e.g. "solar installation", "dental treatment", "fitness plan", "kitchen")
- proposal_term: what this niche calls its offer document (e.g. "quote", "treatment plan", "membership offer", "design proposal")
- visit_term: the on-location first touch for this niche (e.g. "site visit", "clinic visit", "gym tour", "showroom visit")
- decision_term: what this niche naturally calls the pending decision (e.g. "decision", "choice"; Dutch: "beslissing")
advisor_term, project_term, proposal_term, visit_term and decision_term MUST be in the output language and natural for the niche.

- niche_question_bank: 3-4 open questions probing THIS niche's real decision factors (what a lead actually weighs when choosing, e.g. dental implants: treatment comfort, insurance coverage; gym: schedule fit, coaching support). One question per line, no numbering. These supplement a generic question bank, so make them niche-specific, not generic.
- niche_objection_examples: the 2 most common objections a lead in THIS niche raises, each followed on the next line by a strong open counter-question. Blank line between the two pairs.

- lead_context: ONE short sentence, in the output language, describing what this lead already told the business when they first got in touch. Include at MOST two concrete facts, and only facts a website enquiry form would realistically capture (e.g. "enquired through the website about a new kitchen for a 3-bed terrace, no quote was ever sent"). It must be consistent with what_lead_did. Never include budget, timing or a decision: those are the payoff of the conversation, not its starting point.
- niche_question: ONE qualifying question tied to a concrete pain point or key decision factor for this niche — easy to answer over SMS. Examples — Solar: "Roughly how much are you currently paying per month on electricity?" / Dental: "Are you experiencing any discomfort, or is it more of a routine check-up?" / Gym: "Are you looking to lose weight, build muscle, or something else?"
- first_message: Write the opener as one sentence a real person would text. Use this exact shape:
"Hi it's {agent_name} {disclosure_clause}, is that the same {first_name} who was looking at <NATURAL PLURAL PHRASE> a while back?"
<NATURAL PLURAL PHRASE> is what the customer wants in their own words ("new windows or doors", "a new kitchen", "solar panels"). NEVER use the commercial arrangement ("supply and installation", "design and manufacturing"): nobody has ever described themselves as interested in supply and installation. Also return that phrase on its own as \`opener_phrase\`.
Adapt the sentence to the output language (Dutch: "Hoi, dit is {agent_name} {disclosure_clause}, ben jij dezelfde {first_name} die een tijd geleden naar <NATURAL PLURAL PHRASE> keek?") but keep the {agent_name}, {disclosure_clause} and {first_name} tokens exactly as written. {first_name} appears ONLY ONCE, in the identity question, never in the greeting.
- opener_phrase: the <NATURAL PLURAL PHRASE> from first_message on its own, in the output language, no leading article beyond what a person would say out loud
- scoping_ladder: an ordered list of 5 to 7 slots, each collecting ONE fact the company needs to quote the job. Format each slot exactly like this:

SLOT 1 - <short name>
Purpose: <what this answer changes in the quote>
Ask: "<one natural question a real employee would text>"
Options: <closed set, or "open">

Order them cheapest-to-answer first. Do NOT include slots for still-interested, timing or budget: those are universal and handled elsewhere. Every Purpose line must name something that changes the quote; "to understand their needs" is not acceptable. Include the two biggest price drivers for this specific trade.

Worked example of a correct ladder (kitchens, abridged to 3 of its 6 slots). Match this depth, specificity and formatting exactly:

SLOT 1 - room size
Purpose: sizes the job before anything else. Everything downstream scales off it.
Ask: "roughly how big is the kitchen, in metres or in steps across?"
Options: open.

SLOT 2 - layout
Purpose: drives unit count and whether the plumbing moves.
Ask: "what shape is it at the moment, galley, L-shaped, U-shaped or open plan?"
Options: galley, L-shaped, U-shaped, island, open plan.

SLOT 3 - worktop material
Purpose: the largest visible price driver, and a strong quality signal.
Ask: "any thoughts on worktops yet, laminate, quartz, granite or solid wood?"
Options: laminate, quartz, granite, solid wood, not sure.

Note what that example never contains: no timeline slot, no budget slot, no financing or payment-options slot, and no "are you still interested" slot. Those four are banned outright, however natural they feel to add. Every Purpose line names a concrete consequence in the quote (unit count, whether the plumbing moves, which price bracket), never "to understand their needs".
The slots must be the ones an experienced employee of THAT trade would ask, not generic sales questions. For dental implants that means the number of teeth being replaced, the condition of the jawbone and whether a temporary is needed while healing. It does not mean desired timeline or financing.
The whole ladder, labels included, must be in the output language. The example above is English; in Dutch the three labels are "Doel:", "Vraag:" and "Opties:", never "Purpose:", "Ask:" and "Options:". Dutch addresses the reader as "je", never "u". In Portuguese the three labels are "Objetivo:", "Pergunta:" and "Opções:". Portuguese output is ALWAYS Brazilian Portuguese, never European Portuguese: use the gerund ("está pensando em"), never "está a pensar em"; write "paradas" not "paragens", "cabine" not "cabina", "equipe" not "equipa", "trem" not "comboio", "café da manhã" not "pequeno-almoço"; address the reader as "você" in the warm, everyday tone a Brazilian company actually uses on WhatsApp, not the formal distance of European Portuguese. Spell every accent correctly. Always produce at least 5 slots, and put the two biggest price drivers among them: for a trade that installs something, the run from the existing connection point and whether the existing supply or structure can take it are usually bigger price drivers than the customer's choice of features.
- second_message: the follow-up — format: "Thank Goodness! The team asked me to go back through our older enquiries, and I'd rather drop you a message than have someone ring you out of the blue. Are you still interested in [opener_phrase]?" — never claim a manager asked you to reach out and never say you dislike phone calls: on a disclosure-on campaign the assistant must not claim anything only a human could claim

Return ONLY valid JSON, no markdown.`;

export async function generateNicheContext(
  niche: string,
  language: "en" | "nl" | "pt",
  scenario: DemoScenario = "inquired",
): Promise<NicheContext | null> {
  const apiKey = process.env.OPEN_AI_API_KEY;
  if (!apiKey) {
    // Every return-null path in this function logs. A silent null is
    // indistinguishable at the call site (server/routes/demo.ts) from a
    // successful generation, so the demo quietly serves the generic template
    // and nobody notices for hours. Log loudly, grep later.
    console.error("[demo-niche] no OPEN_AI_API_KEY set, falling back to the generic template");
    return null;
  }

  // "Brazilian Portuguese", not bare "Portuguese": asking for "Portuguese"
  // reliably yields EUROPEAN Portuguese ("esta a pensar", "paragens", "cabina"),
  // which a Brazilian reader clocks instantly as foreign. Brazilian PT is the
  // standing project rule and pt is a live demo market.
  const langLabel = { en: "English", nl: "Dutch", pt: "Brazilian Portuguese" }[language];

  // Load system prompt from Prompt Library so it's editable from the UI.
  // Falls back to the hardcoded string if the DB entry is missing.
  let system = NICHE_GENERATOR_SYSTEM_FALLBACK;
  try {
    const [row] = await db
      .select({ promptText: promptLibrary.promptText })
      .from(promptLibrary)
      .where(eq(promptLibrary.useCase, "universal_demo_niche_generator"))
      .limit(1);
    if (row?.promptText) system = row.promptText;
  } catch (err) {
    console.error(
      "[demo-niche] Prompt_Library read failed, using the in-file fallback:",
      (err as Error)?.message,
    );
  }
  system = system + `\n\nOutput language: ${langLabel}.`;

  // Hint the model so what_lead_did / first_message / niche_question match the
  // scenario the visitor chose. lead_stage itself is set authoritatively in code.
  const scenarioHint = {
    inquired: "The lead only INQUIRED and has NOT received a quote/proposal yet.",
    deciding: "The lead already received a quote/proposal and is actively deciding between options.",
    declined: "The lead leaned toward another provider or went quiet after comparing.",
  }[scenario];

  try {
    const controller = new AbortController();
    // 60s, was 20s. gpt-5.6-luna reasons before it answers, so this call got much
    // slower: measured 15.6s (en), 18.8s (nl), 20.1s (pt) on the real row 91
    // prompt. The Portuguese run ALREADY EXCEEDED the old 20s abort, i.e. bumping
    // the model without this line would have aborted pt demos outright.
    const timer = setTimeout(() => controller.abort(), 60000);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // gpt-5.6-luna, was gpt-4o-mini. 4o-mini was the residual quality ceiling
        // on this path: it wrote formal Dutch "u" against campaign 60's "je" and
        // missed real price drivers even after two rounds of explicit instruction
        // were added to row 91. The reviewed Niche_Vocabulary ladders were
        // generated with gpt-5.4-mini and came out clean first time.
        model: "gpt-5.6-luna",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Business niche: ${niche}\nOutput language: ${langLabel}\nLead scenario: ${scenarioHint}` },
        ],
        // Row 91 (universal_demo_niche_generator) asks for ~20 keys including
        // niche_question_bank, niche_objection_examples and the 5-7 slot
        // scoping_ladder. Measured need for a full non-truncated response: ~706
        // completion tokens (dental implants, en). 600 truncated every response
        // mid-JSON (finish_reason "length"), silently discarding the whole
        // generation (JSON.parse throws, caught below, falls back to the generic
        // template).
        // Why 6000: see the max_completion_tokens note below. Historical: 1400 was sized on ENGLISH.
        // The same 7-slot ladder in Dutch measures ~478 tokens against ~418 in
        // English, so the real margin in the primary market language was only
        // ~1.2-1.4x, not the 2x the old comment claimed.
        //
        // max_completion_tokens, NOT max_tokens: gpt-5.6-luna rejects max_tokens
        // outright ("Unsupported parameter ... use max_completion_tokens instead").
        // 6000 and not 2500 because this model spends REASONING tokens that also
        // count against this budget. Measured on the real row 91 prompt for
        // "home lifts": en 1620 completion / 485 reasoning, nl 2105 / 853,
        // pt 2139 / 890. At the old 2500 the Portuguese path had only ~1.17x
        // headroom and reasoning spend is variable, so a truncated demo was a
        // matter of time. 6000 restores ~2.8x on the worst measured language.
        // Row 91's own max_tokens DB column (400) is not read anywhere in this
        // file; this literal is the only knob.
        max_completion_tokens: 6000,
        // temperature is DELIBERATELY ABSENT: gpt-5.6-luna accepts only the
        // default (1) and 400s on any explicit value, including the 0.7 that
        // used to be here.
        // Guarantees parseable JSON. Without it a fenced ```json response
        // (which this file, unlike scripts/prompt93/generate_ladders.js, never
        // strips) throws in JSON.parse and silently discards the generation.
        // Deliberately json_object and NOT json_schema: a strict schema would
        // freeze row 91's key set into this file, so adding a key from the
        // prompt-library UI would silently drop it. That trades one silent
        // failure for a worse one. Shape drift within valid JSON is still
        // handled by the kb / scoping_ladder coercions below.
        response_format: { type: "json_object" },
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.error(
        `[demo-niche] OpenAI HTTP ${res.status} for niche "${niche}" (${language}), falling back to the generic template:`,
        (await res.text().catch(() => "")).slice(0, 300),
      );
      return null;
    }
    const json = await res.json() as any;
    const finishReason = json?.choices?.[0]?.finish_reason;
    if (finishReason === "length") {
      // The response is truncated mid-JSON, so the JSON.parse below will throw
      // and the catch will return null. Name the real cause here: without this
      // line the only symptom is a demo that quietly serves generic copy.
      console.error(
        `[demo-niche] response truncated (finish_reason=length) for niche "${niche}" (${language}). Raise max_tokens.`,
      );
    }
    const raw = (json?.choices?.[0]?.message?.content || "").trim();
    const parsed = JSON.parse(raw) as NicheContext;
    parsed.raw = niche;
    // Coerce kb from array to newline string if the model returned a list.
    if (Array.isArray((parsed as any).kb)) (parsed as any).kb = (parsed as any).kb.join("\n");
    // The generator prompt asks for scoping_ladder as a plain SLOT-1/Purpose/Ask/
    // Options text block, but the model sometimes returns it as a JSON array of
    // per-slot objects instead (it IS already writing JSON, so this drifts easily).
    // Reformat back into the same plain-text shape Niche_Vocabulary.scoping_ladder
    // uses, rather than a bare Array.prototype.toString() ("[object Object],...").
    if (Array.isArray((parsed as any).scoping_ladder)) {
      (parsed as any).scoping_ladder = (parsed as any).scoping_ladder
        .map((slot: unknown, i: number) => {
          if (typeof slot === "string") return slot;
          if (slot && typeof slot === "object") {
            return Object.entries(slot as Record<string, unknown>)
              .map(([key, value]) => {
                const val = typeof value === "string" ? value : JSON.stringify(value);
                return /^slot/i.test(key) ? `SLOT ${i + 1} - ${val}` : `${key}: ${val}`;
              })
              .join("\n");
          }
          return String(slot);
        })
        .join("\n\n");
    }
    // Ensure {agent_name} and {first_name} placeholders are present
    if (parsed.first_message && !parsed.first_message.includes("{agent_name}")) {
      parsed.first_message = parsed.first_message.replace(/\bSophie\b/, "{agent_name}");
    }
    if (parsed.first_message && !parsed.first_message.includes("{first_name}")) {
      // Try to replace a literal name in the "same <word> who/die/que" pattern first.
      // GPT sometimes writes "same Alex who" instead of "same {first_name} who".
      const fixed = parsed.first_message.replace(
        /\b(same|zelfde|mesmo|mesma)\s+\S+\s+(who|die|que)\b/gi,
        "$1 {first_name} $2",
      );
      if (fixed.includes("{first_name}")) {
        parsed.first_message = fixed;
      } else {
        parsed.first_message = parsed.first_message.trimEnd().replace(/\??\s*$/, "") +
          `, is this {first_name}?`;
      }
    }
    // Guarantee niche-term keys exist even if the model omitted them.
    parsed.advisor_term = (parsed.advisor_term || "").trim();
    parsed.project_term = (parsed.project_term || parsed.niche_label || niche).trim();
    parsed.proposal_term = (parsed.proposal_term || "").trim();
    parsed.visit_term = (parsed.visit_term || "").trim();
    parsed.decision_term = (parsed.decision_term || "").trim();
    // {opener_phrase} is substituted into Prompt 93's examples as well as the
    // opener, so an undefined here would render as an empty gap mid-sentence.
    parsed.opener_phrase = (parsed.opener_phrase || parsed.niche_label || niche).trim();
    // NEVER leave this empty. The comment that used to sit here claimed a blank
    // ladder lets the engine's __default__ (kitchen) ladder take over. It does
    // not, and the truth is worse: the demo overlay in the engine
    // (src/automations/conversation/prompt_builder.py, `_set`) skips empty
    // values, and the Niche_Vocabulary packs are merged onto the campaign
    // BEFORE the overlay runs. So an empty ladder here inherits whatever ladder
    // the underlying demo campaign carries, which for campaign 60 is Solar
    // Panels. A failed dental-implants generation would then interrogate the
    // visitor about roof faces and battery storage.
    // A generic on-topic ladder is strictly better than another trade's ladder.
    parsed.scoping_ladder =
      (parsed.scoping_ladder || "").toString().trim() ||
      buildGenericScopingLadder(parsed.niche_label || niche, language);
    parsed.kb = (parsed.kb || "").toString();
    // Empty is fine here, unlike scoping_ladder: the engine's overlay skips
    // empty values, so a missing lead_context just leaves the campaign's own
    // (usually blank), and the ladder starts from slot one. That is the
    // pre-existing behaviour, not a broken demo.
    parsed.lead_context = (parsed.lead_context || "").toString().trim();
    // Example packs: coerce array output to newline strings; empty is fine
    // (the engine then keeps the __default__ packs untouched).
    for (const key of ["niche_question_bank", "niche_objection_examples"] as const) {
      const v = (parsed as any)[key];
      (parsed as any)[key] = (Array.isArray(v) ? v.join("\n") : (v || "").toString()).trim();
    }
    return applyDemoDefaults(parsed, language, scenario);
  } catch (err) {
    // Covers the abort timeout, network failures and (most often) JSON.parse on
    // a truncated or fenced response. If finish_reason was "length" the line
    // above already named the real cause.
    console.error(
      `[demo-niche] generation failed for niche "${niche}" (${language}), falling back to the generic template:`,
      (err as Error)?.message,
    );
    return null;
  }
}

export function buildFallbackNicheContext(
  niche: string,
  language: "en" | "nl" | "pt",
  scenario: DemoScenario = "inquired",
): NicheContext {
  const templates = {
    en: {
      first_message: `Hi, this is {agent_name} from our ${niche} team. Is this the same {first_name} who reached out about ${niche} recently?`,
      niche_question: `Are you still looking for ${niche} services?`,
    },
    nl: {
      first_message: `Hi, dit is {agent_name} van ons ${niche} team. Ben jij dezelfde {first_name} die onlangs contact had over ${niche}?`,
      niche_question: `Ben je nog op zoek naar ${niche} diensten?`,
    },
    pt: {
      first_message: `Oi, aqui é {agent_name} da nossa equipe de ${niche}. Você é o mesmo {first_name} que entrou em contato sobre ${niche} recentemente?`,
      niche_question: `Você ainda está procurando serviços de ${niche}?`,
    },
  };
  const t = templates[language] ?? templates.en;
  const visit = language === "nl" ? "bezoek" : language === "pt" ? "visita" : "visit";
  return applyDemoDefaults({
    raw: niche,
    company_name: "",
    service_name: niche,
    usp: "",
    business_description: "",
    booking_mode_call: true,
    what_lead_did: `showed interest in ${niche}`,
    when_label: language === "nl" ? "onlangs" : language === "pt" ? "recentemente" : "recently",
    niche_label: niche,
    niche_question: t.niche_question,
    first_message: t.first_message,
    // No model ran, so the raw niche the visitor typed is the closest thing we
    // have to "what the customer wants in their own words".
    opener_phrase: niche,
    // No model ran, so there is no niche-specific ladder. It must still not be
    // empty: an empty ladder does NOT fall through to the engine's __default__
    // (see the note at the same assignment in generateNicheContext). It inherits
    // the demo campaign's own ladder, which is Solar Panels on campaign 60.
    scoping_ladder: buildGenericScopingLadder(niche, language),
    // Deliberately empty: no model ran, so inventing what this lead "already
    // said" would put words in a real prospect's mouth on the very first screen.
    lead_context: "",
    kb: "",
    advisor_term: language === "nl" ? "adviseur" : language === "pt" ? "consultor" : "advisor",
    project_term: niche,
    proposal_term: language === "nl" ? "offerte" : language === "pt" ? "orçamento" : "quote",
    visit_term: visit,
    decision_term: language === "nl" ? "beslissing" : language === "pt" ? "decisão" : "decision",
    niche_question_bank: "",
    niche_objection_examples: "",
    lead_stage: scenario,
    inquiry_timeframe: "",
    first_touch: "",
    ai_style: "",
  }, language, scenario);
}

/**
 * Curated context for the solar landing page (leadawaker.com).
 *
 * The universal flow asks an LLM to invent this on every submit, which is the
 * right trade when the niche is unknown. On the solar page it isn't: we already
 * know the trade, so an LLM call per visitor buys nothing and costs latency
 * before the WhatsApp redirect, a token spend per visitor, and the ability to
 * QA what the demo actually says. Curated wins on all three.
 *
 * Covers solar, storage and heat pumps together, which is what these companies
 * actually sell, so the AI can follow the lead wherever the conversation goes.
 * companyName is the visitor's own firm when they give one.
 */
export function buildSolarNicheContext(
  language: "en" | "nl" | "pt",
  scenario: DemoScenario = "deciding",
  companyName?: string,
): NicheContext {
  const company = (companyName || "").trim();
  const nl = language === "nl";
  const fallbackCompany = nl ? "ons team" : "our team";
  const displayCompany = company || fallbackCompany;

  const kb = nl
    ? [
        "Hybride omvormers zijn duurder dan string-omvormers, maar zijn voorbereid op een batterij; achteraf ombouwen kost meestal meer dan de besparing vooraf.",
        "De salderingsregeling stopt op 1 januari 2027, waarna zelf verbruiken zwaarder weegt dan terugleveren.",
        "Een thuisbatterij loont vooral bij verbruik in de avond en weinig verbruik overdag.",
        "Een warmtepomp vraagt een dak en beglazing in redelijke staat; volledige isolatie is vaak niet nodig bij een hybride opstelling.",
        "Wachttijd voor installatie is op dit moment ongeveer negen weken.",
        "Een schouw is gratis en vrijblijvend; er wordt niets opnieuw geoffreerd zonder overleg.",
      ].join("\n")
    : [
        "Hybrid inverters cost more than string inverters but are battery-ready; retrofitting storage later usually costs more than the upfront saving.",
        "Export pays a fraction of what electricity costs to buy back, so self-consumption drives the payback more than panel count.",
        "Battery storage pays off most for households that use power in the evening and little during the day.",
        "A heat pump needs the roof and glazing in reasonable condition; full insulation often isn't required with a hybrid setup.",
        "Installation lead time is currently around nine weeks.",
        "The site survey is free and carries no obligation; nothing gets re-quoted without discussing it first.",
      ].join("\n");

  const questionBank = nl
    ? [
        "Wanneer verbruiken jullie de meeste stroom, overdag of 's avonds?",
        "Was de offerte met of zonder thuisbatterij, en speelde dat mee in de twijfel?",
        "Wat zou er moeten kloppen voordat jullie hier wel mee doorgaan?",
        "Speelt naast zonnepanelen ook verwarming of een warmtepomp mee?",
      ].join("\n")
    : [
        "When do you use most of your electricity, during the day or in the evening?",
        "Was the quote with or without battery storage, and did that factor into the hesitation?",
        "What would have to be true before you'd go ahead with this?",
        "Is heating or a heat pump part of the picture alongside the panels?",
      ].join("\n");

  const objections = nl
    ? "We hebben een goedkopere offerte gekregen.\nWeet u wat er in dat verschil zit? Bij de meeste offertes zit het grootste deel in de omvormer, en dat bepaalt of u later nog een batterij kunt aansluiten.\n\nWe wachten liever nog even af.\nBegrijpelijk. Wat zou er tussen nu en dan moeten veranderen om het wel het juiste moment te maken?"
    : "We got a cheaper quote.\nDo you know what sits inside that difference? On most quotes the bulk of it is the inverter, and that decides whether you can add a battery later.\n\nWe'd rather wait a bit longer.\nUnderstandable. What would need to change between now and then to make it the right time?";

  return applyDemoDefaults(
    {
      raw: "solar panels, battery storage, heat pumps and HVAC",
      niche_label: nl ? "zonne-energie" : "solar",
      company_name: displayCompany,
      service_name: nl
        ? "zonnepanelen, thuisbatterijen en warmtepompen"
        : "solar panels, battery storage and heat pumps",
      usp: nl
        ? "installaties die zijn doorgerekend op het werkelijke verbruik, niet op een standaardprofiel"
        : "systems sized on actual usage rather than a standard profile",
      business_description: nl
        ? `${displayCompany} installeert zonnepanelen, thuisbatterijen en warmtepompen, en rekent elke installatie door op het werkelijke verbruik van de klant.`
        : `${displayCompany} installs solar, battery storage and heat pumps, and sizes every system on the customer's actual usage rather than a standard profile.`,
      booking_mode_call: true,
      what_lead_did: "",
      when_label: nl ? "een tijdje geleden" : "some time ago",
      niche_question: nl
        ? "Is het plan voor zonnepanelen nog actueel, of is dat inmiddels van tafel?"
        : "Is the solar plan still on the table, or has it come off?",
      first_message: nl
        ? `Hi, dit is {agent_name} van ${displayCompany}. Ben jij dezelfde {first_name} die {what_lead_did} {when_label}?`
        : `Hi, this is {agent_name} from ${displayCompany}. Is this the same {first_name} who {what_lead_did} {when_label}?`,
      kb,
      // The solar preset is the public homepage demo: a stranger who typed
      // nothing but a first name. Claiming they already told us something
      // specific would be a lie on the first screen, so the ladder starts cold.
      lead_context: "",
      advisor_term: nl ? "adviseur" : "advisor",
      project_term: nl ? "installatie" : "installation",
      proposal_term: nl ? "offerte" : "quote",
      visit_term: nl ? "schouw" : "site survey",
      decision_term: nl ? "beslissing" : "decision",
      niche_question_bank: questionBank,
      niche_objection_examples: objections,
      lead_stage: scenario,
      inquiry_timeframe: "",
      first_touch: "",
      ai_style: "",
    },
    language,
    scenario,
  );
}

export const DEMO_ACCOUNT_ID = 1;
export const DEMO_WHATSAPP_NUMBER = "+31627458300";

export const DEMO_CAMPAIGNS: Array<{ id: number; key: string; niche: string; emoji: string }> = [
  { id: 47, key: "solar", niche: "Solar installer follow-up", emoji: "☀️" },
  { id: 50, key: "coaching", niche: "Coaching enrollment", emoji: "🎓" },
  { id: 57, key: "gym", niche: "Gym membership reactivation", emoji: "🏋️" },
  { id: 58, key: "dental", niche: "Dental checkup reactivation", emoji: "🦷" },
  { id: 59, key: "legal", niche: "Accident claim reactivation", emoji: "⚖️" },
];

export function isValidDemoCampaignId(id: number): boolean {
  return DEMO_CAMPAIGNS.some((c) => c.id === id);
}

/**
 * Broader check used by the admin /create-link endpoint: ANY campaign flagged
 * is_demo=true is valid, not just the 5 hardcoded for the public /try page.
 * Lets an admin mint links for custom per-prospect demo campaigns.
 */
export async function isDemoCampaign(campaignId: number): Promise<boolean> {
  const rows = await db
    .select({ id: campaigns.id, isDemo: campaigns.isDemo })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  const row = rows[0];
  return !!(row && (row as any).isDemo === true);
}

type RateEntry = { count: number; firstAt: number };
const rateLimits = new Map<string, RateEntry>();
let globalCount = 0;
let globalWindowStart = Date.now();

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX_PER_IP = 5;
const RATE_MAX_GLOBAL = 100;

/**
 * Whitelist of IP or phone identifiers that bypass all demo rate limits.
 * Currently used for the founder's own testing and his girlfriend's number
 * which acts as an always-on demo harness. Matched loose (substring) so we
 * don't care about IPv4/IPv6 shape on the IP side.
 */
export const DEMO_VIP_IPS: string[] = [];
export const DEMO_VIP_PHONES = new Set<string>([
  "+31617862359", // Danique (girlfriend) — unlimited demo uses for internal dogfooding
  "+554774002162", // Gabriel (founder) — unlimited demos + /commands from his phone
]);

export function isVipPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const normalized = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;
  return DEMO_VIP_PHONES.has(normalized);
}

function rotateGlobalWindow(now: number) {
  if (now - globalWindowStart > RATE_WINDOW_MS) {
    globalWindowStart = now;
    globalCount = 0;
  }
}

export type RateDenyReason = "ip" | "global";

export function checkRateLimit(ip: string): { ok: true } | { ok: false; reason: RateDenyReason } {
  const now = Date.now();
  rotateGlobalWindow(now);

  if (DEMO_VIP_IPS.some((v) => ip.includes(v))) return { ok: true };

  if (globalCount >= RATE_MAX_GLOBAL) return { ok: false, reason: "global" };

  const entry = rateLimits.get(ip);
  if (!entry || now - entry.firstAt > RATE_WINDOW_MS) {
    rateLimits.set(ip, { count: 0, firstAt: now });
  }
  const cur = rateLimits.get(ip)!;
  if (cur.count >= RATE_MAX_PER_IP) return { ok: false, reason: "ip" };

  cur.count += 1;
  globalCount += 1;
  return { ok: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimits.entries()) {
    if (now - entry.firstAt > RATE_WINDOW_MS) rateLimits.delete(ip);
  }
  rotateGlobalWindow(now);
}, 10 * 60 * 1000).unref?.();

export function generateToken(): { token: string } {
  // 16 hex chars = 64 bits of entropy. Treated as a secret — never log it,
  // never display it, never put it in URLs or UI other than the pre-filled
  // WhatsApp text the user sends to claim their pending session.
  return { token: crypto.randomBytes(8).toString("hex") };
}

export async function createPendingDemoLead(params: {
  token: string;
  firstName: string;
  language: string;
  campaignId: number;
  demoNiche?: string;
}): Promise<number> {
  const { token, firstName, language, campaignId, demoNiche } = params;
  const now = new Date();
  const [row] = await db
    .insert(leads)
    .values({
      accountsId: DEMO_ACCOUNT_ID,
      campaignsId: campaignId,
      firstName,
      language,
      source: "WhatsApp Demo",
      channelIdentifier: `wa-demo:${token}`,
      conversionStatus: "New",
      // Explicitly NOT 'queued' so the campaign launcher never picks it up.
      // The demo flow sends First_Message itself in demo_recap.py.
      automationStatus: "demo_pending",
      ...(demoNiche ? { demoNiche } : {}),
      createdAt: now,
      updatedAt: now,
    } as any)
    .returning({ id: leads.id });
  return row.id as number;
}

export async function findPendingLeadByToken(token: string) {
  const rows = await db
    .select()
    .from(leads)
    .where(eq(leads.channelIdentifier, `wa-demo:${token}`))
    .limit(1);
  return rows[0] ?? null;
}

// Public origin for the browser demo page. Overridable so a Pi-only test can
// point at app.leadawaker.com, but the default is the host a prospect should
// ever see in a pasted link.
const DEMO_PAGE_ORIGIN = (process.env.DEMO_PAGE_ORIGIN || "https://leadawaker.com").replace(/\/+$/, "");

/**
 * The browser demo link: /demo/<token>, served by client/public/premium/demo.html.
 * Same token as the wa.me link, so one minted session serves both surfaces and
 * whichever the prospect opens first claims it.
 */
export function buildDemoPageLink(params: { token: string }): string {
  return `${DEMO_PAGE_ORIGIN}/demo/${params.token}`;
}

export function buildWhatsAppLink(params: { token: string }): string {
  const number = DEMO_WHATSAPP_NUMBER.replace(/\D/g, "");
  const text = `Press Send to start the demo (code #${params.token})`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export interface CampaignContext {
  company_name: string;
  niche_label: string;
  service_name: string;
  usp: string;
  business_description: string;
  booking_mode_call: boolean;
  what_lead_did: string;
  niche_question: string;
  agent_name: string;
  first_message: string;
  bump_1_template: string;
  bump_2_template: string;
  kb: string;
}

const CAMPAIGN_GENERATOR_SYSTEM = `You generate a complete demo campaign configuration for a lead reactivation AI tool.
Given a business niche, output a JSON object with these exact keys:
- company_name: a realistic company name for that niche (e.g. "BrightSmile Dentistry", "SolarMax", "PeakFit Gym")
- niche_label: 2-3 word label (e.g. "dental care", "solar energy", "gym membership")
- service_name: the specific service being offered (e.g. "dental checkup", "solar panel installation", "gym membership reactivation")
- usp: one sentence unique selling point for this business
- business_description: 2 sentences describing what the business does and who it serves
- booking_mode_call: boolean. true if closing requires a phone or video call with a specialist (solar, coaching, online consulting, financial services, insurance). false if the client books a direct in-person appointment at a physical location (dental checkup, physio, hair salon, gym class, doctor visit).
- what_lead_did: what a typical lapsed lead did in the past (e.g. "had a dental checkup scheduled", "requested a solar quote on our website", "signed up for a free trial class")
- niche_question: ONE sharp qualifying question that reconnects the lead with their original intent (e.g. "Have you found another dentist in the meantime, or are you still looking?", "Are you still thinking about going solar this year?")
- agent_name: a realistic first name for the AI outreach agent (e.g. "Sarah", "Emily", "Alex", "Jordan")
- first_message: the opener — format exactly: "Hi, this is {agent_name} from [company_name]. Is this the same {first_name} who [what_lead_did] a while back?" — {first_name} appears ONLY ONCE in the identity question, never in the greeting
- bump_1_template: a gentle follow-up for no response after 24h. Short, curious tone, reference the service. No greeting.
- bump_2_template: a second follow-up 48h later, different angle, slight urgency or a soft offer. Short.
- kb: a single string of 4-6 specific, detailed facts the AI should know when talking to leads about this business. Each line should be a concrete talking point the AI can use — include numbers, timelines, guarantees, differentiators, and common objections with rebuttals. Example for solar: "Average savings: 40% on energy bills with payback in 4-6 years.\n25-year panel warranty + 10-year inverter warranty included.\nFree site survey and quote within 48h, no obligation.\nGovernment feed-in tariff still available — we handle all paperwork.\nCommon objection: 'too expensive upfront' — rebuttal: $0-down financing available, payments start lower than current power bill." Separate each point with a newline. NOT an array.

Return ONLY valid JSON, no markdown.`;

export async function generateCampaignContext(niche: string): Promise<CampaignContext | null> {
  const apiKey = process.env.OPEN_AI_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: NICHE_GENERATOR_MODEL,
        messages: [
          { role: "system", content: CAMPAIGN_GENERATOR_SYSTEM },
          { role: "user", content: `Business niche: ${niche}` },
        ],
        max_completion_tokens: 600,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json() as any;
    const raw = (json?.choices?.[0]?.message?.content || "").trim();
    const parsed = JSON.parse(raw) as CampaignContext;

    // Enforce {agent_name} placeholder in first_message
    if (parsed.first_message && !parsed.first_message.includes("{agent_name}")) {
      parsed.first_message = parsed.first_message.replace(/\bSophie\b|\bEmily\b|\bSarah\b|\bAlex\b|\bJordan\b/g, "{agent_name}");
    }
    // Enforce {first_name} placeholder in first_message
    if (parsed.first_message && !parsed.first_message.includes("{first_name}")) {
      const fixed = parsed.first_message.replace(
        /\b(same|same person)\s+\S+\s+(who)\b/gi,
        "$1 {first_name} $2",
      );
      parsed.first_message = fixed.includes("{first_name}")
        ? fixed
        : parsed.first_message.trimEnd().replace(/\??\s*$/, "") + ", is this {first_name}?";
    }
    // Coerce kb from array to string if the model returned one
    if (Array.isArray((parsed as any).kb)) {
      (parsed as any).kb = (parsed as any).kb.join("\n");
    }

    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Bilingual context generation (Phase 4)
// ---------------------------------------------------------------------------

/** Index-aligned dropdown options (mirrors fieldLocale.ts client-side). */
const DROPDOWN_OPTIONS = {
  campaign_usp: {
    en: ["", "Naturally sourced materials", "Smart technology integration", "Fast delivery: kitchen ready in 6 weeks", "Made in Germany", "Made in Italy", "Dedicated designer: start to finish", "Extended warranty: 10 years"],
    nl: ["", "Natuurlijke materialen", "Slimme technologie-integratie", "Snelle levering: keuken klaar in 6 weken", "Made in Germany", "Made in Italy", "Eigen ontwerper: van begin tot eind", "Verlengde garantie: 10 jaar"],
  },
  ai_style_override: {
    en: ["", "Professional & consultative", "Warm & educational", "Direct & results-focused", "Friendly & reassuring", "Premium & exclusive"],
    nl: ["", "Professioneel & adviserend", "Warm & informatief", "Direct & resultaatgericht", "Vriendelijk & geruststellend", "Premium & exclusief"],
  },
  what_lead_did: {
    en: ["", "Inquired about a quote", "Received a quote", "Had a site visit / assessment", "In the decision phase", "Declined / went with another provider"],
    nl: ["", "Heeft een offerte aangevraagd", "Heeft een offerte ontvangen", "Heeft een bezoek / keuring gehad", "In de beslissingsfase", "Afgewezen / naar een andere aanbieder"],
  },
  service_name: {
    en: ["", "Design and manufacturing including installation", "Design and manufacturing not including installation", "Supply and installation", "Design consultancy only"],
    nl: ["", "Ontwerp en productie inclusief installatie", "Ontwerp en productie exclusief installatie", "Levering en installatie", "Alleen ontwerpadvies"],
  },
};

/** Given an EN dropdown value, return the stored {en, nl} JSON string. */
function dropdownStore(field: keyof typeof DROPDOWN_OPTIONS, enValue: string): string {
  const table = DROPDOWN_OPTIONS[field];
  const idx = table.en.indexOf(enValue);
  if (idx !== -1) return JSON.stringify({ en: table.en[idx], nl: table.nl[idx] });
  return JSON.stringify({ en: enValue, nl: enValue });
}

/** Parse a stored field (plain string or JSON) to {en?, nl?}. */
export function parseLang(raw: unknown): { en?: string; nl?: string } {
  if (!raw) return {};
  const s = String(raw).trim();
  if (s.startsWith("{")) {
    try {
      const p = JSON.parse(s);
      if (typeof p === "object" && p !== null) return p;
    } catch { /* ok */ }
  }
  return { en: s, nl: s };
}

export interface BilingualFields {
  description?: string;
  niche_question?: string;
  kb?: string;
  campaign_usp?: string;
  ai_style_override?: string;
  what_lead_did?: string;
  service_name?: string;
}

const BILINGUAL_GENERATOR_SYSTEM = `You generate campaign context fields in both English and Dutch for a B2B/B2C lead reactivation AI tool.

Given a business niche, output a JSON object with these exact keys:
- description_en / description_nl: 2-sentence business description
- niche_question_en / niche_question_nl: one sharp qualifying question for lapsed leads
- kb_en / kb_nl: 4-6 specific knowledge base facts the AI should know (numbers, timelines, objection rebuttals). Newline-separated, NOT an array.
- usp_en: one of these exact options: "Naturally sourced materials", "Smart technology integration", "Fast delivery: kitchen ready in 6 weeks", "Made in Germany", "Made in Italy", "Dedicated designer: start to finish", "Extended warranty: 10 years"
- ai_style_en: one of: "Professional & consultative", "Warm & educational", "Direct & results-focused", "Friendly & reassuring", "Premium & exclusive"
- what_lead_did_en: one of: "Inquired about a quote", "Received a quote", "Had a site visit / assessment", "In the decision phase"
- service_name_en: one of: "Design and manufacturing including installation", "Design and manufacturing not including installation", "Supply and installation", "Design consultancy only"

Return ONLY valid JSON, no markdown.`;

const TRANSLATE_SYSTEM = `You translate campaign context fields between English and Dutch.
Return ONLY valid JSON with the translated values — same keys as the input, no extra keys.`;

export async function generateBilingualContext(niche: string): Promise<BilingualFields | null> {
  const apiKey = process.env.OPEN_AI_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: NICHE_GENERATOR_MODEL,
        messages: [
          { role: "system", content: BILINGUAL_GENERATOR_SYSTEM },
          { role: "user", content: `Business niche: ${niche}` },
        ],
        max_completion_tokens: 900,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json() as any;
    const raw = (json?.choices?.[0]?.message?.content || "").trim();
    const data = JSON.parse(raw) as Record<string, string>;

    return {
      description: JSON.stringify({ en: data.description_en ?? "", nl: data.description_nl ?? "" }),
      niche_question: JSON.stringify({ en: data.niche_question_en ?? "", nl: data.niche_question_nl ?? "" }),
      kb: JSON.stringify({ en: data.kb_en ?? "", nl: data.kb_nl ?? "" }),
      campaign_usp: dropdownStore("campaign_usp", data.usp_en ?? ""),
      ai_style_override: dropdownStore("ai_style_override", data.ai_style_en ?? ""),
      what_lead_did: dropdownStore("what_lead_did", data.what_lead_did_en ?? ""),
      service_name: dropdownStore("service_name", data.service_name_en ?? ""),
    };
  } catch {
    return null;
  }
}

/** Translate a set of plain-string values from one lang to the other. Returns {field: translatedValue}. */
export async function translateFields(
  values: Record<string, string>,
  fromLang: "en" | "nl",
  toLang: "en" | "nl",
): Promise<Record<string, string>> {
  const apiKey = process.env.OPEN_AI_API_KEY;
  if (!apiKey || !Object.keys(values).length) return {};

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const langName = (l: string) => (l === "nl" ? "Dutch" : "English");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: NICHE_GENERATOR_MODEL,
        messages: [
          { role: "system", content: TRANSLATE_SYSTEM },
          { role: "user", content: `Translate from ${langName(fromLang)} to ${langName(toLang)}:\n${JSON.stringify(values, null, 2)}` },
        ],
        max_completion_tokens: 600,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return {};
    const json = await res.json() as any;
    const raw = (json?.choices?.[0]?.message?.content || "").trim();
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}
