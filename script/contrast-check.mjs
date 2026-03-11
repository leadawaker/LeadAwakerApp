// WCAG Contrast Ratio Calculator for dark mode theme
function srgbToLinear(c) {
  c = c / 255;
  if (c <= 0.04045) c = c / 12.92;
  else c = Math.pow((c + 0.055) / 1.055, 2.4);
  return c;
}

function luminance(r, g, b) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const bg = luminance(0x11, 0x18, 0x26);       // background hsl(228, 35%, 10%)
const fg = luminance(0xe8, 0xea, 0xee);       // foreground hsl(220, 20%, 93%)
const card = luminance(0x19, 0x20, 0x36);     // card hsl(226, 32%, 14%)
const mutedFg = luminance(0x8c, 0x94, 0x9e);  // muted-foreground hsl(220, 15%, 60%)
const primary = luminance(0x5c, 0x7d, 0xff);  // primary hsl(229, 100%, 70%)

const pairs = [
  ["Foreground on Background", fg, bg, 4.5],
  ["Foreground on Card", fg, card, 4.5],
  ["Muted-fg on Background", mutedFg, bg, 3],
  ["Muted-fg on Card", mutedFg, card, 3],
  ["Primary on Background", primary, bg, 3],
];

console.log("Dark Mode WCAG Contrast Ratios:");
for (const [name, c1, c2, threshold] of pairs) {
  const ratio = contrastRatio(c1, c2);
  const label = threshold >= 4.5 ? "AA" : "AA-large";
  const pass = ratio >= threshold ? "PASS" : "FAIL";
  console.log(`  ${name}: ${ratio.toFixed(1)}:1 [${label}: ${pass}]`);
}
