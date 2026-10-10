// Number, date and name formatting for the Traffic page, in the app's language.

export function num(lang: string, value: number): string {
  return new Intl.NumberFormat(lang).format(value);
}

/** A search position, one decimal ("9.4"). */
export function position(lang: string, value: number | null): string {
  if (value === null) return "";
  return new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

/** "Oct 8" from a YYYY-MM-DD day or an ISO timestamp. Days are shown as written, without a time-zone shift. */
export function shortDate(lang: string, value: string | null): string {
  if (!value) return "";
  const isDay = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(isDay ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang, { month: "short", day: "numeric", ...(isDay ? { timeZone: "UTC" } : {}) }).format(date);
}

// Search Console names countries with three letters; the browser's own country
// names need two. The countries the site realistically hears from.
const ALPHA2: Record<string, string> = {
  nld: "NL", bel: "BE", deu: "DE", fra: "FR", gbr: "GB", irl: "IE", esp: "ES", prt: "PT", ita: "IT", che: "CH",
  aut: "AT", lux: "LU", dnk: "DK", swe: "SE", nor: "NO", fin: "FI", pol: "PL", cze: "CZ", rou: "RO", grc: "GR",
  tur: "TR", ukr: "UA", usa: "US", can: "CA", mex: "MX", bra: "BR", arg: "AR", col: "CO", chl: "CL", per: "PE",
  aus: "AU", nzl: "NZ", ind: "IN", pak: "PK", bgd: "BD", phl: "PH", idn: "ID", vnm: "VN", tha: "TH", mys: "MY",
  sgp: "SG", jpn: "JP", kor: "KR", chn: "CN", hkg: "HK", are: "AE", sau: "SA", isr: "IL", egy: "EG", mar: "MA",
  nga: "NG", ken: "KE", zaf: "ZA", sur: "SR", cuw: "CW", abw: "AW", ago: "AO", moz: "MZ", cpv: "CV",
};

export function countryName(lang: string, alpha3: string): string {
  const code = ALPHA2[alpha3.toLowerCase()];
  if (!code) return alpha3.toUpperCase();
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function languageName(lang: string, code: string): string {
  try {
    const name = new Intl.DisplayNames([lang], { type: "language" }).of(code);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : code;
  } catch {
    return code;
  }
}

/** "Europe/Amsterdam" reads as "Amsterdam", "America/Sao_Paulo" as "Sao Paulo". */
export function zoneName(zone: string): string {
  return (zone.split("/").pop() || zone).replace(/_/g, " ");
}
