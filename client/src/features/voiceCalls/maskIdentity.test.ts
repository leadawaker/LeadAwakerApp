import test from "node:test";
import assert from "node:assert/strict";
import { maskNumber, maskName, maskSpoken } from "./maskIdentity";

test("number keeps country-ish prefix and last 2 digits", () => {
  assert.equal(maskNumber("+31612345647"), "+31 6 ••• ••• 47");
  assert.equal(maskNumber("+44 7700 900123"), "+44 7 ••• ••• 23");
  assert.equal(maskNumber("0612345678"), "06 1 ••• ••• 78");
});

test("short or odd numbers never reveal the middle", () => {
  assert.equal(maskNumber("12345"), "••• 45");
  assert.equal(maskNumber("1234567"), "••• 67");
  assert.equal(maskNumber("12"), "•••");
  assert.equal(maskNumber("web"), "web");
  assert.equal(maskNumber("wa-demo:abc1234"), "•••");
  assert.equal(maskNumber(null), null);
  assert.equal(maskNumber(undefined), null);
  assert.equal(maskNumber(""), null);
  assert.equal(maskNumber("   "), null);
});

test("masked output never contains the hidden digits", () => {
  const raw = "+31698765432";
  const masked = maskNumber(raw) as string;
  const visible = masked.replace(/\D/g, "");
  assert.equal(visible, "316" + "32");
  assert.ok(!masked.includes("9876543"));
});

test("name is first name plus initial of the last word", () => {
  assert.equal(maskName("Jan de Vries"), "Jan V.");
  assert.equal(maskName("Maria Silva"), "Maria S.");
  assert.equal(maskName("  jan   bakker "), "jan B.");
  assert.equal(maskName("Madonna"), "M.");
  assert.equal(maskName("gabriel"), "G.");
  assert.equal(maskName("  "), null);
  assert.equal(maskName(""), null);
  assert.equal(maskName(null), null);
  assert.equal(maskName(undefined), null);
});

test("spoken names and numbers are masked in transcript text", () => {
  assert.equal(maskSpoken("Hoi, met Gabriel.", "Gabriel"), "Hoi, met G..");
  assert.equal(maskSpoken("I'm Jan de Vries, de eigenaar", "Jan de Vries"), "I'm Jan V., de eigenaar");
  assert.equal(maskSpoken("Vries here, Jan Vries", "Jan de Vries"), "V. here, Jan V.");
  assert.equal(maskSpoken("gabrielle is not gabriel", "Gabriel"), "gabrielle is not G.");
  assert.equal(maskSpoken("bel me op 06-28139119 graag", null), "bel me op 06 2 ••• ••• 19 graag");
  assert.equal(maskSpoken("om 14:30 of 3 uur", null), "om 14:30 of 3 uur");
  assert.equal(maskSpoken("", "Gabriel"), "");
});
