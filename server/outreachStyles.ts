// Outreach style/format presets for /api/prospects/:id/generate-messages

export const STYLE_PRESETS = [
  {
    key: "hormozi",
    instruction:
      "Lead with a specific, concrete offer of value. Use numbers and specificity. Frame as removing risk for them. Be direct and confident, not salesy.",
  },
  {
    key: "saraev",
    instruction:
      "Write like you're texting a friend who happens to run a business. Short sentences. Lowercase okay. Ask a micro-question that's easy to say yes to. Sound human, not AI-generated.",
  },
  {
    key: "cashvertising",
    instruction:
      "Appeal to desire or fear of loss. Paint a vivid before/after. Use sensory language. Make them feel what success looks like, not just understand it.",
  },
  {
    key: "professional",
    instruction:
      "Be direct and respectful. State who you are, why you're reaching out, and what you propose. No tricks, no pressure. Professional courtesy.",
  },
];

export const FORMAT_PRESETS = [
  {
    key: "whatsapp",
    maxLength: 300,
    instruction:
      "2-3 sentences max. Casual, first-name basis. No subject line. Like a quick text message.",
  },
  {
    key: "linkedin_note",
    maxLength: 300,
    instruction:
      "Ultra-concise. Fits a LinkedIn connection request note. One compelling reason to connect.",
  },
  {
    key: "linkedin_message",
    maxLength: 1000,
    instruction:
      "Conversational LinkedIn message. Reference their content or role. 3-5 sentences.",
  },
  {
    key: "company_message",
    maxLength: 500,
    instruction:
      "Address the company (not a person). Reference their services or market position.",
  },
  {
    key: "email",
    maxLength: 0,
    instruction:
      "Include a subject line on the first line as 'Subject: ...'. Then 3-5 short paragraphs. Professional but warm.",
  },
  {
    key: "cold_call",
    maxLength: 0,
    instruction:
      "Generate a cold call opening script following this exact structure: (1) Opening line: 'Our clients are [qualifying adjective] [their specific niche] who face one of these challenges:' — use the prospect context to name their niche precisely. (2) List 2-3 problems with their consequence, 1-2 sentences each — make them feel specific and real to that niche. (3) Pattern interrupt closer: 'I have a feeling you will tell me you have the opposite problem; [exaggerated opposite problem].' — make it self-deprecating and slightly absurd. The goal is to make the prospect laugh or nod, not to pitch.",
  },
];

export const LANGUAGES = ["en", "nl", "pt"] as const;

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  nl: "Dutch",
  pt: "Portuguese",
};

export function buildOutreachPrompt(
  prospect: any,
  styleKey: string,
  formatKey: string,
  language: string = "en",
  interactions?: Array<{ content: string; direction: string; sentAt: string | Date | null }>,
  options?: { selectedOffer?: string; selectedContact?: "1" | "2" | "generic" | "company"; customInstructions?: string; templateBody?: string; styleOverride?: string; formatOverride?: string }
): string {
  const style = STYLE_PRESETS.find((s) => s.key === styleKey);
  const format = FORMAT_PRESETS.find((f) => f.key === formatKey);

  if (!style) throw new Error(`Unknown style: ${styleKey}`);
  if (!format) throw new Error(`Unknown format: ${formatKey}`);

  const langName = LANGUAGE_NAMES[language] || "English";

  const selectedContact = options?.selectedContact;

  // Section 1: Context block
  const contextLines = [
    `You are writing outreach messages for a lead generation agency.`,
    `Write all messages in ${langName}.`,
    "",
    "PROSPECT CONTEXT:",
  ];
  if (prospect.companyName)
    contextLines.push(`- Company: ${prospect.companyName}`);

  // Contact info depends on selectedContact
  if (selectedContact === "2") {
    if (prospect.contact2Name) {
      const role = prospect.contact2Role ? ` (${prospect.contact2Role})` : "";
      contextLines.push(`- Contact: ${prospect.contact2Name}${role}`);
    }
    if (prospect.contact2Headline)
      contextLines.push(`- Headline: ${prospect.contact2Headline}`);
  } else if (selectedContact === "generic" || selectedContact === "company") {
    // Company only, no personal contact data
  } else {
    if (prospect.contactName) {
      const role = prospect.contactRole ? ` (${prospect.contactRole})` : "";
      contextLines.push(`- Contact: ${prospect.contactName}${role}`);
    }
    if (prospect.headline)
      contextLines.push(`- Headline: ${prospect.headline}`);
  }

  if (prospect.aiSummary)
    contextLines.push(`- Summary: ${prospect.aiSummary}`);
  if (prospect.topPost)
    contextLines.push(`- Top post/content: ${prospect.topPost}`);
  if (prospect.pageSummaries) {
    const trimmed = String(prospect.pageSummaries).slice(0, 2000);
    contextLines.push(`- Page summaries: ${trimmed}`);
  }
  if (prospect.personBrief)
    contextLines.push(`- Person brief: ${prospect.personBrief}`);
  if (prospect.offerIdeas)
    contextLines.push(`- Offer ideas: ${prospect.offerIdeas}`);

  // FOCUS ANGLE block (when a specific offer is selected)
  if (options?.selectedOffer) {
    contextLines.push("");
    contextLines.push(`FOCUS ANGLE: Build your message around this specific offer: ${options.selectedOffer}`);
  }

  // Interactions history
  if (interactions && interactions.length > 0) {
    contextLines.push("");
    contextLines.push("PREVIOUS INTERACTIONS (most recent first):");
    let charCount = 0;
    const maxInteractions = interactions.slice(0, 10);
    for (const ix of maxInteractions) {
      const date = ix.sentAt ? new Date(ix.sentAt).toISOString().split("T")[0] : "unknown";
      const line = `[${ix.direction}] (${date}): ${ix.content}`;
      if (charCount + line.length > 3000) break;
      contextLines.push(line);
      charCount += line.length;
    }
  }

  const contextBlock = contextLines.join("\n");

  // Section 2: Style instruction (DB override takes precedence)
  const styleBlock = options?.styleOverride ?? style.instruction;

  // Section 3: Format instruction (DB override takes precedence)
  let formatBlock = options?.formatOverride ?? format.instruction;
  if (format.maxLength > 0) {
    formatBlock += ` Keep under ${format.maxLength} characters.`;
  }

  // Section 4: Output instruction
  let outputBlock: string;
  if (formatKey === "cold_call") {
    outputBlock = `Generate exactly 5 cold call talking point anchors. Each is 1-2 sentences. Return ONLY valid JSON: [{"title":"Anchor Name","text":"The talking point..."}]`;
  } else {
    outputBlock = `Generate exactly 5 different variations. Each must take a unique angle or hook.
Each variation should combine a personal reference (to their specific situation), a hook (attention-grabbing element), and a pitch (clear value proposition) into one cohesive message.
Give each variation a short, descriptive title (2-4 words) that captures the angle used.
Return ONLY valid JSON, no markdown fences, no explanation. Format:
[{"title":"The Industry Insider","text":"..."},{"title":"Pain Point Angle","text":"..."},{"title":"Mutual Connection","text":"..."},{"title":"Data-Driven","text":"..."},{"title":"Bold Offer","text":"..."}]`;
  }

  outputBlock += `\nIMPORTANT: Never use em dashes or en dashes in the output. Use commas, colons, or short sentences instead.`;

  // Template block (structural skeleton the AI should follow)
  if (options?.templateBody) {
    outputBlock = `Use the following template as the STRUCTURAL SKELETON for your messages. Follow its exact structure, tone, and flow, but replace all bracketed placeholders (like [Name], [Company reference], [Day], [Time], etc.) with real, personalized content based on the prospect context above. Do not copy the template literally; adapt and personalize every section while keeping the same overall shape and progression.\n\nTEMPLATE:\n${options.templateBody}\n\n` + outputBlock;
  }

  // Custom instructions block
  const blocks = [contextBlock, styleBlock, formatBlock, outputBlock];
  if (options?.customInstructions) {
    blocks.push(`ADDITIONAL INSTRUCTIONS: ${options.customInstructions}`);
  }

  return blocks.join("\n\n");
}
