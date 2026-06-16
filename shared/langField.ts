export type Lang = "en" | "nl";
export type LangField = { en?: string; nl?: string };

export function parseLangField(raw: unknown): LangField {
  if (!raw) return {};
  if (typeof raw === "object" && raw !== null) return raw as LangField;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (s.startsWith("{")) {
      try {
        const parsed = JSON.parse(s);
        if (typeof parsed === "object" && parsed !== null) return parsed as LangField;
      } catch {
        // fall through to plain string
      }
    }
    // Plain string: mirror as "en" value (legacy)
    return { en: raw, nl: raw };
  }
  return {};
}

export function resolveLang(raw: unknown, lang: Lang): string {
  if (!raw && raw !== 0) return "";
  const field = parseLangField(raw);
  // If both keys are undefined we got a plain-string mirrored field — field.en holds it
  return field[lang] || field.en || field.nl || "";
}

export function setLang(raw: unknown, lang: Lang, val: string): string {
  const field = parseLangField(raw);
  // When a field was a mirrored plain string, collapse the mirror before writing
  const hadMirror = field.en === field.nl && field.en !== undefined;
  const updated: LangField = hadMirror ? {} : { ...field };
  updated[lang] = val;
  return JSON.stringify(updated);
}

export function isFilled(raw: unknown, lang: Lang): boolean {
  return resolveLang(raw, lang).trim().length > 0;
}
