// The initials a demo shows for a business when it has no logo. Same rules as
// initials() in client/public/social-demo/feed.js, which cannot import this.

// Legal-form suffixes carry no identity: "Acme Daken B.V." reads as "AD".
const LEGAL = /^(b\.?v\.?|n\.?v\.?|v\.?o\.?f\.?|ltd\.?|llc|inc\.?|gmbh|lda\.?|ltda\.?|s\.?a\.?|me|eireli|&)$/i;

/** "Van Dijk Roofing" -> "VD", "SolarMax" -> "SM", "hayai" -> "H". */
export function businessInitials(name: string | null | undefined): string {
  const words = String(name || "").trim().split(/\s+/).filter((w) => w && !LEGAL.test(w));
  if (!words.length) return "?";
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  const caps = words[0].match(/[A-Z]/g);
  return (caps && caps.length > 1 ? caps.slice(0, 2).join("") : words[0][0]).toUpperCase();
}
