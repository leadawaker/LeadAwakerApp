/**
 * Best-effort E.164 for the numbers we actually store: Telnyx sends E.164, but
 * the web demo stores whatever the presenter typed ("06-28139119"). Used for
 * tel: and wa.me links and the HubSpot push. Returns null when the input is
 * not a usable number, never a guess that could dial a stranger.
 */

export type PhoneCountry = "NL" | "GB" | "BR";

const COUNTRIES: Record<PhoneCountry, { cc: string; trunk: string | null; national: [number, number] }> = {
  NL: { cc: "31", trunk: "0", national: [9, 9] },
  GB: { cc: "44", trunk: "0", national: [9, 10] },
  // Brazil has no trunk zero in everyday writing: "(11) 98765-4321".
  BR: { cc: "55", trunk: null, national: [10, 11] },
};

const E164_MAX_DIGITS = 15;
const E164_MIN_DIGITS = 8;

export function toE164(raw: string | null | undefined, country: PhoneCountry = "NL"): string | null {
  const value = (raw ?? "").trim();
  if (!value || !/^[+\d\s().-]+$/.test(value)) return null;
  // "+31 (0)6 ..." writes the trunk zero in brackets: drop it.
  let digits = value.replace(/\(0\)/g, "").replace(/\D/g, "");
  let international = value.startsWith("+");
  if (!international && digits.startsWith("00")) {
    digits = digits.slice(2);
    international = true;
  }
  if (!international) {
    const c = COUNTRIES[country];
    let national = digits;
    if (c.trunk) {
      if (!national.startsWith(c.trunk)) return null;
      national = national.slice(c.trunk.length);
    }
    if (national.length < c.national[0] || national.length > c.national[1]) return null;
    digits = c.cc + national;
  }
  if (digits.length < E164_MIN_DIGITS || digits.length > E164_MAX_DIGITS) return null;
  return `+${digits}`;
}
